/**
 * The theme switch: the storage key, the pre-paint script, and the one function
 * that writes it.
 *
 * ## This is deliberately the ONLY module in `src/` that knows any of it
 *
 * The attribute name and the storage key appear here and nowhere else — not in
 * the toggle, not in the layout, not in a test helper. `guardrails.test.ts`
 * fails the build the moment a second file mentions either. A theme written
 * from two places drifts, and it drifts silently: the page looks right until a
 * reader's stored preference stops being read by whichever half was updated
 * last.
 *
 * ## Why an attribute rather than `prefers-color-scheme`
 *
 * A media query cannot express "the operating system says dark, the reader
 * chose light". `data-theme` on `<html>` can, and it is what the CSS in
 * `globals.css` binds its dark styles to.
 *
 * ## Why the `dark` class is written alongside it
 *
 * Because Kapwa's two stylesheets disagree with each other. `dist/kapwa.css`
 * binds its tokens to `.dark, [data-theme='dark']` and accepts either — but
 * `dist/index.css`, where the component utilities live, declares
 * `@custom-variant dark (&:is(.dark *))`, which is CLASS ONLY.
 *
 * Writing only the attribute would therefore leave Kapwa's components in the
 * wrong theme while ours are correct — half a page, and the half that a
 * screenshot of our own components would never show. The two are written
 * together, always, and a unit test fails if either is written without the
 * other.
 *
 * ⚠️ Neither Kapwa stylesheet is imported yet — `globals.css` only `@source`s
 * the dist so Tailwind picks up its class names — so the class is inert today
 * and becomes load-bearing the moment `index.css` is imported. Reading only
 * `kapwa.css`, finding the attribute there and concluding the class is
 * redundant is the specific mistake this note exists to prevent.
 */

/** Where the reader's choice is remembered. */
export const THEME_STORAGE_KEY = 'bettertago-theme';

/** The attribute `globals.css` binds every dark style to. */
export const THEME_ATTRIBUTE = 'data-theme';

export type Theme = 'light' | 'dark';

/**
 * The pre-paint script, injected into `<head>` by the root layout.
 *
 * ## Three things about it are load-bearing
 *
 * **It is a static literal, and must stay one.** It reaches the document
 * through `dangerouslySetInnerHTML`, which is safe here for exactly one reason:
 * nothing is interpolated into it. A unit test fails on the first `${`. This is
 * the one and only permitted `dangerouslySetInnerHTML` in the app.
 *
 * **It runs before first paint**, so no route renders in the wrong theme for a
 * frame — the flash that a `useEffect` version cannot avoid by construction.
 *
 * **It also corrects `<html lang>`.** The root layout owns `<html>` and is not
 * re-rendered when only the `[locale]` segment changes, so on a first load of
 * `/fil` the document would otherwise carry `lang="en"` — which sends a screen
 * reader into the wrong pronunciation rules for the whole page. The locale list
 * is hardcoded because interpolating it would break the rule above; a unit test
 * fails if it drifts from `routing.locales`.
 *
 * Every step is wrapped: `localStorage` throws outright in some private-browsing
 * modes, and a theme is not worth a blank page.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var d=document.documentElement;
var stored=null;
try{stored=localStorage.getItem('bettertago-theme');}catch(e){}
var theme=(stored==='light'||stored==='dark')?stored:
(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
d.setAttribute('data-theme',theme);
d.classList.toggle('dark',theme==='dark');
var seg=location.pathname.split('/')[1];
if(seg==='en'||seg==='fil'){d.setAttribute('lang',seg);}
}catch(e){}})();`;

/**
 * Persists the choice, and shrugs if it cannot.
 *
 * Private-browsing modes throw on `setItem` rather than returning false. The
 * theme still applies for the session; only the memory of it is lost, which is
 * the correct thing to degrade to.
 */
function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Nothing to do, and nothing worth telling the reader about. */
  }
}

/** The theme the document is currently in. Light unless it says otherwise. */
export function currentTheme(): Theme {
  return document.documentElement.getAttribute(THEME_ATTRIBUTE) === 'dark'
    ? 'dark'
    : 'light';
}

/** Writes the attribute, the class and the stored preference — all three. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute(THEME_ATTRIBUTE, theme);
  root.classList.toggle('dark', theme === 'dark');
  storeTheme(theme);
}

/** Flips the theme and returns the one now in force, for the announcement. */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
