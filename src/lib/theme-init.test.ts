import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routing } from '@/i18n/routing';
import {
  applyTheme,
  currentTheme,
  toggleTheme,
  THEME_ATTRIBUTE,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from './theme-init';

/**
 * The theme's failure modes are all invisible in a screenshot.
 *
 * A stored preference that stops being honoured looks identical to a reader who
 * happens to agree with their operating system. An attribute written without
 * its class leaves only Kapwa's own components in the wrong theme. And an
 * interpolated init script is a script injection that renders perfectly right
 * up until someone passes it a value. All three are pinned here.
 */

const root = document.documentElement;

/** Runs the pre-paint script the way the browser would, in this document. */
function runInitScript(): void {
  new Function(THEME_INIT_SCRIPT)();
}

/** jsdom implements no `matchMedia`, so the OS preference has to be stated. */
function osPrefers(scheme: 'dark' | 'light'): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('dark') && scheme === 'dark',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  );
}

beforeEach(() => {
  window.localStorage.clear();
  root.removeAttribute(THEME_ATTRIBUTE);
  root.classList.remove('dark');
  root.setAttribute('lang', routing.defaultLocale);
  window.history.replaceState({}, '', '/');
  osPrefers('light');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the pre-paint script', () => {
  it('is a static literal, with nothing interpolated into it', () => {
    /*
     * The whole safety argument for `dangerouslySetInnerHTML` in the root
     * layout is this one property. Asserted against the SOURCE as well as the
     * value, because a template literal that interpolates a constant produces a
     * runtime string with no `${` left in it — the value alone cannot tell you.
     */
    expect(THEME_INIT_SCRIPT).not.toContain('${');

    const source = readFileSync(
      path.join(process.cwd(), 'src', 'lib', 'theme-init.ts'),
      'utf8'
    );
    const start = source.indexOf('export const THEME_INIT_SCRIPT');
    expect(start).toBeGreaterThan(-1);

    const rest = source.slice(start);
    const declaration = rest.slice(0, rest.indexOf('`;') + 2);
    expect(declaration).not.toContain('${');
    // Nor assembled by concatenation, which would sidestep the check above.
    expect(declaration).not.toMatch(/`\s*\+|\+\s*`/);
  });

  it('hardcodes exactly the locales the routing configuration declares', () => {
    // The list cannot be interpolated from `routing.locales` without breaking
    // the rule above, so it is duplicated — and this is what stops it drifting.
    const hardcoded = [...THEME_INIT_SCRIPT.matchAll(/seg===('[a-z-]+')/g)].map(
      match => JSON.parse(match[1].replace(/'/g, '"')) as string
    );

    expect(hardcoded).toEqual([...routing.locales]);
  });

  it('uses the same storage key as the module that reads it back', () => {
    expect(THEME_INIT_SCRIPT).toContain(`'${THEME_STORAGE_KEY}'`);
  });

  it('writes the attribute and the class in the same breath', () => {
    // Kapwa's dark variant is class-bound and ours is attribute-bound. One
    // without the other is half a page in the wrong theme.
    expect(THEME_INIT_SCRIPT).toContain(`setAttribute('${THEME_ATTRIBUTE}'`);
    expect(THEME_INIT_SCRIPT).toContain(`classList.toggle('dark'`);
  });

  it('honours the operating system on a first visit', () => {
    osPrefers('dark');
    runInitScript();

    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('lets a stored preference beat the operating system', () => {
    osPrefers('dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    runInitScript();

    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('ignores a stored value that is not a theme', () => {
    osPrefers('dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    runInitScript();

    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('still resolves a theme when storage throws, as it does in private mode', () => {
    osPrefers('dark');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied');
    });

    expect(() => runInitScript()).not.toThrow();
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('corrects `lang` from the first path segment', () => {
    // The root layout owns <html> and cannot know the locale, so a first load
    // of /fil would otherwise ship lang="en" — and a wrong `lang` sends a
    // screen reader into the wrong pronunciation rules for the whole page.
    window.history.replaceState({}, '', '/fil');
    runInitScript();

    expect(root.getAttribute('lang')).toBe('fil');
  });

  it('leaves `lang` alone on a path that names no locale', () => {
    window.history.replaceState({}, '', '/no-such-page');
    runInitScript();

    expect(root.getAttribute('lang')).toBe(routing.defaultLocale);
  });
});

describe('applying a theme', () => {
  it('never writes the attribute without the class, or the class without it', () => {
    applyTheme('dark');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);

    applyTheme('light');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('remembers the choice', () => {
    applyTheme('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('applies the theme even when it cannot remember it', () => {
    // Private-browsing modes throw on setItem rather than returning false. The
    // theme is worth applying for the session; only the memory of it is lost.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => applyTheme('dark')).not.toThrow();
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('reads light when the document says nothing', () => {
    expect(currentTheme()).toBe('light');
  });
});

describe('toggling', () => {
  it('flips the theme and reports the one now in force', () => {
    applyTheme('light');

    expect(toggleTheme()).toBe('dark');
    expect(currentTheme()).toBe('dark');

    expect(toggleTheme()).toBe('light');
    expect(currentTheme()).toBe('light');
  });

  it('survives a reload, because it persists on the way through', () => {
    applyTheme('light');
    toggleTheme();

    // What a reload actually does: the document resets, the script re-runs.
    root.removeAttribute(THEME_ATTRIBUTE);
    root.classList.remove('dark');
    osPrefers('light');
    runInitScript();

    expect(currentTheme()).toBe('dark');
  });
});
