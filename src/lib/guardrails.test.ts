import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REPO_ROOT,
  filesMatching,
  matchesIn,
  sourceFilesIn,
  type ScannedFile,
} from './file-scan';

/**
 * Project rules that would otherwise be enforced only by review.
 *
 * Each block is a rule from docs/coding-standards.md that has nothing keeping
 * it true. These are cheap source scans — they cannot prove the portal is
 * correct, only that the specific ways it is known to rot have not happened
 * yet.
 */

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const APP = path.join(SRC, 'app');

type SourceFile = ScannedFile;

const SRC_FILES = sourceFilesIn(SRC);
const APP_FILES = sourceFilesIn(APP);

/** Every string leaf in a parsed JSON tree, keyed by its dotted path. */
function flatten(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key)
  );
}

/** Files whose text matches, reported as paths so a failure names the culprit. */
const offenders = (files: SourceFile[], pattern: RegExp): string[] =>
  matchesIn(files, pattern);

describe('the source scan itself', () => {
  it('is actually reading files', () => {
    // Without this, a broken walker turns every scan below into a green no-op.
    expect(SRC_FILES.length).toBeGreaterThan(10);
    expect(APP_FILES.length).toBeGreaterThan(3);
  });
});

describe('self-containment', () => {
  /*
   * This repository must not depend on anything outside itself — not in code,
   * not in a comment, not in a doc. Anyone who clones only this repository has
   * to get a complete project, and a path that resolves only on one
   * maintainer's machine is a dead link for everyone else.
   *
   * What that rules out is a reference to a SIBLING directory. Relative imports
   * that stay inside the repo (`../../package.json` from `src/lib/`) are fine
   * and are not matched here.
   */
  const OUTWARD =
    /(?:^|[\s('"`[])(?:\.\.\/)*(?:context|references|better-tandag)\//;

  it('references no directory outside this repository', () => {
    expect(offenders(SRC_FILES, OUTWARD)).toEqual([]);
  });

  it('holds for the checked-in docs and dotfiles too', () => {
    // The docs are where this slips first: a contributor-facing file pointing
    // at a workspace path is a dead link for anyone who cloned just this repo.
    //
    // `docs/` is swept rather than listed. A hardcoded list only covers the
    // files somebody remembered to add to it, and the doc most likely to carry
    // an outward path is the one just written by someone reading a workspace
    // file at the time.
    const named = [
      'README.md',
      'CONTRIBUTING.md',
      'CODE_OF_CONDUCT.md',
      'content/README.md',
      // The mark's notes are imported from a design project that lives outside
      // this repo, so this is the one doc most likely to carry a path back to
      // it. Anyone who cloned only this repo has to be able to follow it.
      'brand/logo/README.md',
      '.env.example',
      '.gitignore',
    ].map(name => ({
      path: name,
      text: readFileSync(path.join(ROOT, name), 'utf8'),
    }));

    // Swept rather than listed, so the next doc or script cannot escape the
    // scan by nobody remembering to add it. scripts/ is committed tooling and
    // is reached by neither the src/ scan above nor the markdown sweep.
    const swept = [
      ...filesMatching(path.join(ROOT, 'docs'), /\.md$/),
      ...filesMatching(path.join(ROOT, 'inventory'), /\.md$/),
      ...filesMatching(path.join(ROOT, 'scripts'), /\.mjs$/),
    ];

    // Same reasoning as the source-scan check above: a walker that silently
    // returns nothing turns this whole assertion into a green no-op.
    const paths = swept.map(file => file.path);
    expect(swept.length).toBeGreaterThanOrEqual(5);
    expect(paths).toContain('docs/coding-standards.md');
    expect(paths).toContain('inventory/README.md');
    expect(paths).toContain('scripts/harvest.mjs');

    expect(offenders([...named, ...swept], OUTWARD)).toEqual([]);
  });

  it('holds for the e2e specs, which neither scan above reaches', () => {
    const specs = readdirSync(path.join(ROOT, 'e2e'))
      .filter(name => /\.spec\.ts$/.test(name))
      .map(name => ({
        path: `e2e/${name}`,
        text: readFileSync(path.join(ROOT, 'e2e', name), 'utf8'),
      }));

    expect(specs.length).toBeGreaterThan(0);
    expect(offenders(specs, OUTWARD)).toEqual([]);
  });
});

describe('the route set is the one that was reviewed', () => {
  /*
   * ⚠️ THIS BLOCK REPLACED THE PHASE 0 ROUTE FREEZE ON 2026-08-10.
   *
   * What was here asserted that NO public route existed beyond the holding
   * page, and that nothing in `src/` imported the content loader — the
   * mechanical half of `PROG-104`, which says no route ships until the
   * municipality has been told this project exists.
   *
   * 🔓 The gate was opened by explicit instruction before that happened. The
   * decision, and what did not change with it, is recorded on `PROG-104`; it is
   * not restated here, because a test is the wrong place to argue a position.
   *
   * The freeze is gone. What replaces it is the same idea one step weaker: the
   * route set is still ENUMERATED, so adding a public surface is still a diff
   * somebody reviews rather than a file that appears. A civic portal gaining a
   * route nobody noticed is the failure this list still exists to prevent.
   */

  /** Every route file this application publishes. */
  const ROUTES = [
    'src/app/[locale]/charter/documents/[slug]/page.tsx',
    // The contact and emergency directories, each on its own URL. Both were
    // `#contact` / `#emergency` sections of the home page and still are; these
    // routes render the SAME two directory components under a masthead, so a
    // phone number cannot be current on one surface and stale on the other.
    // The header's Contact and Emergency entries now point here rather than
    // sending a reader on any other page back to the front door to scroll.
    'src/app/[locale]/contact/page.tsx',
    'src/app/[locale]/emergency/page.tsx',
    'src/app/[locale]/error.tsx',
    // The gap register. Added 2026-08-10 with the portal chrome: every
    // `GapNotice` on every surface links here, which is what turns "we do not
    // know" from an apology into a request for help.
    'src/app/[locale]/gaps/page.tsx',
    'src/app/[locale]/layout.tsx',
    'src/app/[locale]/not-found.tsx',
    'src/app/[locale]/page.tsx',
    // Search. The form posts to the route handler, which turns `?q=` into a
    // path segment and redirects; the results render from that segment with no
    // Suspense boundary, which is what makes them reachable with JavaScript
    // disabled. All three are `noindex` — a crawler indexing every query
    // produces thousands of near-duplicate URLs of a civic site.
    // Narrowing a result set by category. A filter value, so an unknown one
    // falls back to the unfiltered results rather than 404ing.
    'src/app/[locale]/search/[query]/[category]/page.tsx',
    'src/app/[locale]/search/[query]/page.tsx',
    'src/app/[locale]/search/page.tsx',
    'src/app/api/search/route.ts',
    /*
     * The visit counter's write endpoint (`TAGO-116`). It earns a handler
     * differently from the search one: every route here is prerendered, so
     * there is no server render at the moment a reader arrives, and a per-visit
     * write has nowhere else to live.
     *
     * 🔒 It reads no IP, no cookie and no identifier. Deduplication is the
     * browser's, against a timestamp only the reader holds.
     */
    'src/app/api/visits/route.ts',
    'src/app/[locale]/services/[category]/[slug]/page.tsx',
    'src/app/[locale]/services/[category]/page.tsx',
    // The office facet. A FILTER over resident tasks, prerendered one page per
    // office — not the office directory, which is TAGO-107 and is a different
    // route with a different job. It is a route segment rather than `?office=`
    // because a filtered view has to survive JavaScript being off, and a
    // Suspense boundary streams as a hidden div; see the file's own note.
    'src/app/[locale]/services/office/[office]/page.tsx',
    'src/app/[locale]/services/page.tsx',
    'src/app/layout.tsx',
    'src/app/not-found.tsx',
    'src/app/robots.ts',
    'src/app/sitemap.ts',
  ];

  it('publishes exactly the routes on the list', () => {
    // Both directions. An added route is a surface nobody reviewed; a removed
    // one means this list has stopped describing the application.
    expect(APP_FILES.map(file => file.path).sort()).toEqual([...ROUTES].sort());
  });

  it('fires on a route that is not on the list', () => {
    // A guardrail that has never gone red is not known to work.
    const withExtra = [
      ...APP_FILES.map(file => file.path),
      'src/app/[locale]/transparency/page.tsx',
    ].sort();
    expect(withExtra).not.toEqual([...ROUTES].sort());
  });

  it('🔴 keeps the completeness ledger, and keeps it out of the application', () => {
    /*
     * `inventory/charter-completeness.json` holds every line of a source
     * document that the rendered markdown does not carry. It is REFERENCE
     * MATERIAL for a verifier reading against the PDF — never rendered, never
     * served, and never shown to a resident.
     *
     * Three things have to stay true, and none of them is obvious to somebody
     * tidying up:
     *
     *   · it EXISTS. Deleting it turns the completeness guarantee in
     *     `transcription-integrity.test.ts` from a proof into a claim;
     *   · it is NOT under `content/`, which is the data layer this application
     *     renders — a file there is a file a route can reach;
     *   · nothing in `src/` reads it, so it cannot arrive on a page by accident.
     */
    const ledger = path.join(
      REPO_ROOT,
      'inventory',
      'charter-completeness.json'
    );
    expect(
      existsSync(ledger),
      'inventory/charter-completeness.json is missing'
    ).toBe(true);

    const parsed = JSON.parse(readFileSync(ledger, 'utf8')) as {
      services: Record<string, unknown>;
    };
    expect(Object.keys(parsed.services).length).toBeGreaterThan(160);

    expect(
      existsSync(path.join(REPO_ROOT, 'content', 'charter-completeness.json')),
      'the ledger must not be under content/, which is what the app renders'
    ).toBe(false);

    const readers = SRC_FILES.filter(file =>
      /charter-completeness/.test(file.text)
    ).map(file => file.path);
    expect(readers.filter(file => !file.endsWith('.test.ts'))).toEqual([]);
  });

  it('reads the content layer only through the loader', () => {
    /*
     * `content/` is the data layer and `src/lib/content.ts` is the only module
     * allowed to touch the filesystem. This survives the gate opening unchanged
     * — it was never about the gate. A component reading `node:fs` directly is
     * how a page starts rendering unvalidated YAML.
     */
    const direct = SRC_FILES.filter(
      file =>
        file.path !== 'src/lib/content.ts' &&
        file.path !== 'src/lib/file-scan.ts' &&
        /from 'node:fs/.test(file.text)
    ).map(file => file.path);

    expect(direct).toEqual([]);
  });
});

describe('the tab icon is the delivered mark, not a copy of it', () => {
  it('🔴 keeps src/app/icon.svg byte-identical to brand/logo/better-tago-color.svg', () => {
    /*
     * Next's icon convention needs the file inside `src/app/`, so the mark
     * exists twice in this repository. Two copies of one piece of artwork drift
     * the first time either is revised — and the one that drifts is always the
     * one nobody looks at, which is the favicon.
     *
     * There is no build step that could dedupe them (the convention is a file
     * path, not an import), so this is the thing that keeps them equal. If it
     * fails, `cp brand/logo/better-tago-color.svg src/app/icon.svg` — do not
     * edit the copy.
     */
    const brand = readFileSync(
      path.join(ROOT, 'brand', 'logo', 'better-tago-color.svg'),
      'utf8'
    );
    const icon = readFileSync(path.join(APP, 'icon.svg'), 'utf8');

    expect(icon).toBe(brand);
  });
});

describe('design tokens', () => {
  /*
   * Colour belongs to the @theme layer in globals.css and reaches components
   * only through named tokens. globals.css is where the ramp is DECLARED, so it
   * is deliberately not scanned; every other source file is.
   */
  it('declares no colour literal outside globals.css', () => {
    expect(
      offenders(SRC_FILES, /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/)
    ).toEqual([]);
  });

  it('calls no colour function in a component', () => {
    expect(
      offenders(SRC_FILES, /\b(?:rgba?|hsla?|oklch|oklab|color-mix)\(/)
    ).toEqual([]);
  });

  it('uses no arbitrary Tailwind value', () => {
    // `bg-[#16643c]`, `text-[13px]`, `w-[42rem]`. Anything the theme cannot
    // express is a missing token, not a one-off utility.
    expect(
      offenders(
        SRC_FILES,
        /\b(?:bg|text|border|w|h|min-h|min-w|max-w|p|px|py|m|mx|my|gap|rounded|size)-\[/
      )
    ).toEqual([]);
  });
});

describe('theming', () => {
  /*
   * Colour flips through the semantic ROLES in globals.css, resolved at the
   * element. A component that branches on the theme has bypassed the role layer
   * — and it will be the one surface that stays wrong when a role changes,
   * because nothing else in the codebase looks like it.
   */
  it('carries no `dark:` colour utility in any component', () => {
    expect(
      offenders(
        SRC_FILES,
        /\bdark:(?:bg|text|border|divide|outline|ring|fill|stroke|decoration|shadow|from|via|to|placeholder|caret|accent)-/
      )
    ).toEqual([]);
  });

  it('writes the theme from exactly one module', () => {
    /*
     * The attribute name and the storage key live in `theme-init.ts` and
     * nowhere else — the toggle calls into it rather than touching `document`,
     * and the layout only imports the script string.
     *
     * A theme written from two places drifts silently: the page looks right
     * until a reader's stored preference stops being read by whichever half was
     * updated last.
     */
    const touching = SRC_FILES.filter(file =>
      /data-theme|bettertago-theme/.test(file.text)
    ).map(file => file.path);

    expect(touching).toEqual(['src/lib/theme-init.ts']);
  });

  it('resolves the theme before first paint, from the root layout', () => {
    // If this injection is dropped, nothing fails — every route just renders
    // in the wrong theme for a frame, on the reader's very first impression.
    const layout = SRC_FILES.find(file => file.path === 'src/app/layout.tsx');
    expect(layout?.text).toContain('THEME_INIT_SCRIPT');
  });

  it('permits `dangerouslySetInnerHTML` for that script and nothing else', () => {
    /*
     * The prop, not the word — the module that owns the script talks about it
     * at length in its own doc comment, and a scan that cannot tell prose from
     * a call site is a scan somebody eventually deletes.
     *
     * It is safe in the one place it appears for exactly one reason: the script
     * is a static literal. `theme-init.test.ts` fails on the first `${`.
     */
    const uses = SRC_FILES.filter(file =>
      /dangerouslySetInnerHTML\s*=\s*\{/.test(file.text)
    ).map(file => file.path);

    expect(uses).toEqual(['src/app/layout.tsx']);
  });
});

describe('static rendering', () => {
  it('reads no dynamic request API in the route tree', () => {
    // cookies()/headers()/draftMode()/connection() in a layout drags every
    // route under it into dynamic rendering.
    expect(
      offenders(APP_FILES, /next\/headers|\b(?:cookies|draftMode|connection)\(/)
    ).toEqual([]);
  });

  it('never opts a route out of static rendering', () => {
    /*
     * There is no exemption, and there cannot be one: `export const dynamic` is
     * flatly incompatible with `cacheComponents` and fails the build outright.
     *
     * That is worth knowing before someone reaches for it. A search results
     * page genuinely cannot be prerendered, and the answer is NOT this escape
     * hatch — it is to move the query into a route SEGMENT, which is known at
     * render start. See `src/app/[locale]/search/[query]/page.tsx`.
     */
    /*
     * Anchored to the start of a line, so it matches a DECLARATION rather than
     * any mention of one. Unanchored, this fired on the route handler's own
     * comment explaining why the escape hatch is unavailable — a guardrail that
     * fails on its own documentation teaches people to delete the
     * documentation.
     */
    const OPT_OUT = /^export const (?:dynamic|revalidate)\b/m;
    expect(offenders(APP_FILES, OPT_OUT)).toEqual([]);

    // A guardrail that has never gone red is not known to work.
    expect(
      offenders(
        [{ path: 'fixture', text: "export const dynamic = 'force-dynamic';" }],
        OPT_OUT
      )
    ).toEqual(['fixture → export const dynamic']);
  });

  it('calls setRequestLocale in every next-intl route OUTSIDE [locale]', () => {
    /*
     * The blind spot. Inside the segment, `[locale]/layout.tsx` calls
     * `setRequestLocale` and every route under it inherits that. OUTSIDE it —
     * `app/not-found.tsx` — nothing does, so next-intl resolves the locale by
     * reading the REQUEST. Under `cacheComponents` that is runtime data
     * accessed outside <Suspense>, and the route silently stops prerendering.
     * It does not fail the build and the page looks perfect.
     */
    const outside = APP_FILES.filter(
      file =>
        !file.path.includes('[locale]') &&
        /\/(?:page|layout|not-found)\.tsx$/.test(file.path) &&
        /from 'next-intl/.test(file.text)
    );

    expect(
      outside
        .filter(file => !file.text.includes('setRequestLocale('))
        .map(file => file.path)
    ).toEqual([]);
  });

  it('calls setRequestLocale in every page and layout under [locale]', () => {
    const segments = APP_FILES.filter(
      file =>
        file.path.includes('[locale]') &&
        /\/(?:page|layout)\.tsx$/.test(file.path)
    );

    expect(segments.length).toBeGreaterThan(0);
    expect(
      segments
        .filter(file => !file.text.includes('setRequestLocale('))
        .map(file => file.path)
    ).toEqual([]);
  });
});

describe('the server/client boundary', () => {
  it('never makes a route file a Client Component', () => {
    /*
     * TAGO-113's negative criterion, and it is the one that decides whether
     * this portal stays server-rendered.
     *
     * `'use client'` on a `page.tsx` or `layout.tsx` does not make one
     * component interactive — it moves that route and everything under it into
     * the browser bundle. The chrome is built so this is never necessary: the
     * navigation tree stays on the server and every disclosure receives its
     * children ALREADY RENDERED, so the interactive leaves are the only client
     * modules the header pulls in.
     *
     * It is an easy mistake to make under pressure ("just add it so the toggle
     * works") and almost impossible to notice afterwards.
     */
    const routeFiles = APP_FILES.filter(file =>
      /\/(?:page|layout|error|not-found)\.tsx$/.test(file.path)
    );
    expect(routeFiles.length).toBeGreaterThan(5);

    const clientRoutes = routeFiles
      .filter(file => /^\s*['"]use client['"]/m.test(file.text))
      // `error.tsx` MUST be a Client Component — React requires it, because an
      // error boundary runs in the browser.
      .filter(file => !file.path.endsWith('error.tsx'))
      .map(file => file.path);

    expect(clientRoutes).toEqual([]);
  });

  it('fires on a doctored route file', () => {
    // A guardrail that has never gone red is not known to work.
    const doctored = [
      {
        path: 'src/app/[locale]/page.tsx',
        text: "'use client';\nexport default function P() {}",
      },
    ];
    expect(
      doctored.filter(file => /^\s*['"]use client['"]/m.test(file.text))
    ).toHaveLength(1);
  });

  it('keeps the client leaves to the ones that need a browser', () => {
    /*
     * Named rather than counted: a new client module is a real decision, and it
     * should cost a line here so the next person sees the list it joined.
     *
     * Each of these owns state, an effect, or a browser API that has no server
     * equivalent — a stored theme, a scroll position, a measured overflow, a
     * disclosure's open boolean.
     */
    const CLIENT_LEAVES = [
      'src/components/layout/AdvisoryBar.tsx',
      // "Which section am I looking at" is a fact about the viewport, and the
      // server has no viewport. Everything else about the rail — the headings,
      // their ids, their order — is computed on the server and arrives as
      // props.
      'src/components/services/PageRail.tsx',
      'src/components/layout/MobileNav.tsx',
      'src/components/layout/NavDisclosure.tsx',
      'src/components/layout/TickerViewport.tsx',
      'src/components/ui/BackToTop.tsx',
      'src/components/ui/CountUp.tsx',
      'src/components/ui/HtmlLang.tsx',
      'src/components/ui/LocaleSwitcher.tsx',
      'src/components/ui/ThemeToggle.tsx',
      /*
       * Renders NO markup. It is a client module for the one thing a server
       * cannot do on a prerendered route: know that a real browser just loaded
       * the page, and read the reader's own 24-hour marker. The figure itself
       * is server-rendered in `SiteFooter`, deliberately — see `CountUp.tsx`
       * for why a number never starts life in the browser here.
       */
      'src/components/layout/VisitCount.tsx',
      /*
       * Leaflet is a browser library end to end — it measures a viewport,
       * attaches wheel and keyboard handlers, and paints tiles into a DOM node.
       * There is no server equivalent and no server rendering of it.
       *
       * 🔴 It is also the ONLY component in this repository that causes a
       * reader's browser to contact a third party. `LocalConditions` states that
       * on the page. Read `HallMap.tsx`'s own note before adding another.
       */
      'src/components/home/HallMap.tsx',
    ];

    const actual = SRC_FILES.filter(
      file =>
        /^\s*['"]use client['"]/m.test(file.text) &&
        !/\.test\.tsx?$/.test(file.path) &&
        !file.path.endsWith('error.tsx')
    ).map(file => file.path);

    expect(actual.sort()).toEqual([...CLIENT_LEAVES].sort());
  });
});

describe('everything a Server Component reads is cached', () => {
  /*
   * 🔴 This exists because its absence broke a deployment, and nothing local
   * caught it.
   *
   * `cacheComponents: true` means nothing is cached implicitly. A loader that a
   * Server Component awaits without `'use cache'` is UNCACHED DATA, and if that
   * component renders in a layout it sits inside `<html><body>` on every route
   * with no `<Suspense>` around it — which the build refuses to prerender:
   *
   *   Route "/[locale]/charter/documents/[slug]": Uncached data was accessed
   *   outside of <Suspense> … at body … at html
   *
   * `src/lib/weather.ts` was written with `'use cache'` from the first line.
   * `src/lib/visits.ts` was not, and `SiteFooter` renders in the locale layout.
   * The two were inconsistent and only one of them was ever going to fail.
   *
   * ⚠️ What this proves and what it does not: it proves every module in `lib/`
   * that reaches the network also opts into the cache SOMEWHERE. It cannot
   * prove the right function carries it. The named assertions below cover the
   * loaders that actually render in the layout tree, which is where the cost of
   * getting it wrong is a failed build rather than a slow page.
   */
  const FETCHERS = SRC_FILES.filter(
    file =>
      file.path.startsWith('src/lib/') &&
      !/\.test\.tsx?$/.test(file.path) &&
      /\bfetch\(/.test(file.text)
  );

  it('is actually finding the modules that reach the network', () => {
    // A scan that silently matches nothing is a green no-op.
    expect(FETCHERS.map(file => file.path).sort()).toEqual([
      'src/lib/visits.ts',
      'src/lib/weather.ts',
    ]);
  });

  it('opts every one of them into the cache', () => {
    const uncached = FETCHERS.filter(
      file => !/'use cache'/.test(file.text)
    ).map(file => file.path);
    expect(uncached).toEqual([]);
  });

  it('caches the loaders the LAYOUT tree awaits', () => {
    const declaration = (text: string, fn: string) => {
      const start = text.indexOf(`export async function ${fn}(`);
      expect(start, `${fn} not found`).toBeGreaterThan(-1);
      return text.slice(start, start + 900);
    };

    const visits = SRC_FILES.find(f => f.path === 'src/lib/visits.ts')!.text;
    const weather = SRC_FILES.find(f => f.path === 'src/lib/weather.ts')!.text;

    expect(declaration(visits, 'getVisitCount')).toContain("'use cache'");
    expect(declaration(weather, 'getWeather')).toContain("'use cache'");
  });

  it('keeps the visit INCREMENT uncached', () => {
    // The mirror of the rule above. A cached increment is a counter that has
    // silently stopped, which looks exactly like a working feature.
    const visits = SRC_FILES.find(f => f.path === 'src/lib/visits.ts')!.text;
    const start = visits.indexOf('export async function recordVisit(');
    expect(start).toBeGreaterThan(-1);
    const body = visits.slice(start, start + 400);
    expect(body).not.toContain("'use cache'");
    expect(body).toContain("cache: 'no-store'");
  });
});

describe("nothing is loaded from someone else's server", () => {
  /*
   * `TAGO-110` criterion 5 as amended on 2026-08-20. Only the TRAFFIC half was
   * reversed; this half was not, and it is the half that is easiest to breach
   * by accident — a CDN `<script>` is one copy-paste from any tutorial.
   *
   * 🔴 It became load-bearing the day the map shipped. The reference portal
   * loads Leaflet from `unpkg.com`; this one takes the same library at the same
   * version from the lockfile instead, and the only thing keeping those apart
   * is this test.
   *
   * ⚠️ What this does NOT claim: that no third-party request happens. The map
   * fetches tiles from OpenStreetMap, which is a deliberate, stated exception
   * — `LocalConditions` tells the reader so on the page. What is forbidden is
   * executing CODE served by someone else.
   */
  const CDN_HOSTS =
    /(?:src|href)=["'`]https?:\/\/(?:[a-z0-9-]+\.)*(?:unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|ajax\.googleapis\.com|esm\.sh|skypack\.dev)/i;

  it('loads no script or stylesheet from a CDN', () => {
    expect(offenders(SRC_FILES, CDN_HOSTS)).toEqual([]);
  });

  it('fires on a doctored fixture', () => {
    // A guardrail that has never gone red is not known to work.
    expect(
      offenders(
        [
          {
            path: 'fixture',
            text: '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>',
          },
        ],
        CDN_HOSTS
      )
    ).toHaveLength(1);
  });

  it('resolves leaflet from the lockfile, at a pinned stable version', () => {
    /*
     * `2.0.0` exists only as an alpha, so `1.9.4` IS latest stable. Pinned in
     * this assertion rather than trusted to a range: a `latest` bump that
     * silently took the alpha would be a rewrite landing in a civic site.
     */
    const pkg = JSON.parse(
      readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    ) as { dependencies: Record<string, string> };
    expect(pkg.dependencies.leaflet).toBe('^1.9.4');
  });

  it('imports leaflet only from the one client leaf that owns it', () => {
    // Keeps the third-party surface to a single reviewable file.
    const importers = SRC_FILES.filter(file =>
      /from ['"]leaflet|import\(['"]leaflet/.test(file.text)
    ).map(file => file.path);
    expect(importers).toEqual(['src/components/home/HallMap.tsx']);
  });
});

describe('independence', () => {
  /*
   * BetterTago is not the official site and never presents itself as one. The
   * footer's independence line is the load-bearing sentence on every page, and
   * it is the kind of thing a redesign deletes by accident.
   */
  it('keeps the independence statement in both locales', () => {
    for (const locale of ['en', 'fil']) {
      const messages = readFileSync(
        path.join(ROOT, 'messages', `${locale}.json`),
        'utf8'
      );
      expect(JSON.parse(messages).footer.independence.length).toBeGreaterThan(
        60
      );
    }
  });

  it('renders the footer on every page, via the locale layout', () => {
    const layout = SRC_FILES.find(
      file => file.path === 'src/app/[locale]/layout.tsx'
    );
    expect(layout?.text).toContain('<SiteFooter />');
  });
});

describe('the canonical host', () => {
  /*
   * 🔴 `portal.domain` must name the host the deployment ACTUALLY serves, and
   * that host is `www`.
   *
   * This shipped wrong. The value was the apex, written before the domain was
   * pointed; hosting then settled on `www` and 308-redirects the apex to it.
   * Nothing reconciled the two, because nothing read this key — so for two days
   * every page told crawlers its canonical URL was one that redirects away from
   * the page serving it, and all ~380 sitemap entries plus the robots.txt
   * `Sitemap:` directive named the same wrong host:
   *
   *   https://www.bettertago.org/en  →  <link rel="canonical"
   *                                       href="https://bettertago.org/en">
   *   https://bettertago.org/en      →  308 https://www.bettertago.org/en
   *
   * 🔴 **The config is what moves, never the redirect.** `www` is the identity
   * already published: the introduction letter delivered to the Office of the
   * Mayor on 2026-08-12 names `www.bettertago.org`, and the municipality was
   * told to look there. Flipping the hosting to make the apex canonical would
   * falsify a letter that has already been sent.
   *
   * This is a unit assertion and not an e2e one deliberately. Comparing
   * `<link rel="canonical">` against `location.origin` would be the honest
   * check, but the suite runs against `localhost` while `metadataBase` is the
   * production domain — it would fail on every developer machine.
   */
  // Read from disk, like every other scan here, rather than importing the
  // parsed module — the guard is on the VALUE a contributor edits.
  const domain: string = JSON.parse(
    readFileSync(path.join(ROOT, 'config', 'lgu.config.json'), 'utf8')
  ).portal.domain;

  it('is the www host the deployment serves, not the apex it redirects from', () => {
    expect(domain).toBe('https://www.bettertago.org');
  });

  it('is https, has no trailing slash and no path', () => {
    // A trailing slash here becomes a double slash in every sitemap `<loc>`,
    // and a path would be silently prefixed onto every canonical URL.
    const url = new URL(domain);
    expect(url.protocol).toBe('https:');
    expect(url.pathname).toBe('/');
    expect(domain.endsWith('/')).toBe(false);
  });

  it('is the ONLY place the host is written down', () => {
    /*
     * The bug was survivable in one edit precisely because everything absolute
     * derives from this key. A second hardcoded host would break that, and it
     * is the failure mode that turns a one-line fix into a hunt — so a literal
     * `bettertago.org` anywhere in `src/` fails here.
     *
     * The footer is the one legitimate reader: it strips `www.` for DISPLAY, so
     * a resident still sees `bettertago.org`. It derives that from this key
     * rather than hardcoding it, which is why it needs no exemption.
     *
     * The host, bare — not a quoted-literal pattern. An earlier version required
     * a leading quote, which read as "no hardcoded string" but behaved as this
     * does anyway: its negated class matched newlines, so any quote earlier in
     * the file let a later unquoted mention through the same match. Matching the
     * host itself is what the name of this test claims and is simpler than a
     * prefix that was never doing the work it appeared to.
     *
     * A comment mentioning the domain therefore fails too, and that is intended:
     * this file is the place that documents the host, and `src/` is not.
     */
    const stray = SRC_FILES.filter(file =>
      /\bbettertago\.org\b/.test(file.text)
    ).map(file => file.path);
    expect(stray).toEqual([]);
  });
});

describe('translation coverage', () => {
  const read = (locale: string): Record<string, unknown> =>
    JSON.parse(
      readFileSync(path.join(ROOT, 'messages', `${locale}.json`), 'utf8')
    );

  const en = Object.fromEntries(flatten(read('en')));
  const fil = Object.fromEntries(flatten(read('fil')));

  /**
   * Keys whose Filipino is IDENTICAL to the English on purpose.
   *
   * The fallback rule is that a missing translation shows English behind a
   * visible banner — never silently. A key sitting in fil.json with an English
   * value defeats that: it is invisible to the banner and to the reader. So
   * every identical value has to be listed here and defended, and anything not
   * listed fails the gate.
   *
   * Adding a line is a translation decision. It is not a way to close a build.
   */
  const DELIBERATELY_IDENTICAL: Record<string, string> = {
    // A reader who cannot read the current language must still find theirs, so
    // the switcher names each language in its own.
    'header.english': 'the switcher names each language in its own',
    'header.filipino': 'the switcher names each language in its own',
    'header.englishFull': 'ditto, for the accessible name',
    'header.filipinoFull': 'ditto, for the accessible name',
    // The charter itself says "Civil Registry" in both languages, and it is
    // what the sign above the counter says. Translating a term of art a
    // resident has to say out loud at an office is not a service to them.
    'services.categories.civil-registry':
      'the office and the counter both use the English term',
    // Same term, same reason, in the navigation rather than the category list.
    // A resident has to say this out loud at a counter, and the sign above that
    // counter is in English.
    'nav.civilRegistry': 'the office and the counter both use the English term',
    // Proper nouns. The municipal legislature's name is Sangguniang Bayan in
    // any language — and it is `Bayan`, never `Panlungsod`, because Tago is a
    // municipality and not a city.
    'resources.sangguniangBayan': 'the body’s own name, in Filipino already',
    'resources.psa':
      'the agency’s own registered name, which it does not translate',
    // Punctuation, not prose. Both locales separate a list the same way, and a
    // "translation" here would be a typography change disguised as one.
    'stats.listSeparator': 'a list separator, not a word',
    // The loanword is the word. "Email" is what a Filipino speaker says and
    // writes; `elektronikong sulat` is not what anyone would look for.
    'contact.emailLabel': 'the loanword is the ordinary Filipino term',
    // Same reasoning, and the same call BetterTandag's own contact card
    // makes: "Address" is the ordinary word a Filipino speaker uses here too.
    'contact.addressLabel': 'the loanword is the ordinary Filipino term',
    /*
     * The hero line is SURIGAONON, not English and not Filipino, so it is the
     * same string in both catalogues by nature rather than by omission.
     *
     * ⚠️ Worth knowing rather than burying: the locale decision this project
     * has recorded is EN/FIL only, on the grounds that shipping a language
     * without a fluent speaker to write and check the copy would be publishing
     * machine output. This line arrived by instruction from the project lead,
     * which is a different thing from a machine guess — but it does mean the
     * portal now carries Surigaonon on its most prominent surface while the
     * question of serving Surigaonon properly is still open.
     */
    'hero.headingLead': 'Surigaonon — the same phrase in either catalogue',
    // A unit symbol. There is nothing to translate, and "translating" km²
    // would be a typography change wearing a costume.
    'stats.squareKilometres': 'a unit symbol, not a word',
    // Same reasoning, added with the conditions strip: `{degrees}°C` is a
    // number and a unit symbol. Every other string in the `weather` namespace,
    // including all 29 condition labels, is really translated.
    'weather.temperature': 'a number and a unit symbol, not a word',
    // Added with the local-conditions panel. Same reasoning again: a figure and
    // an SI unit. The LABELS beside them — `humidityLabel`, `windLabel` — are
    // words, and both are really translated.
    'weather.humidity': 'a number and a unit symbol, not a word',
    'weather.wind': 'a number and a unit symbol, not a word',
    /*
     * Proper nouns and product names, added with the footer's Resources column
     * on 2026-08-10. Each is the name the destination gives ITSELF and is what
     * a reader will see when they arrive — translating "PhilGEPS" or the
     * municipality's own Facebook name would make the label disagree with the
     * page behind it.
     */
    'resources.lguFacebook': 'the page names itself this, in either language',
    /*
     * Was "Official municipal website" / "Opisyal na website ng munisipyo" — a
     * DESCRIPTION of the destination, which is why it had a translation. It was
     * changed by instruction on 2026-08-12 to name the destination instead, and
     * a name does not get translated: it is the same label in either catalogue
     * for the same reason `resources.lguFacebook` is.
     */
    'resources.officialSite': 'the LGU’s own name for its site, not a phrase',
    'resources.philgeps': 'a system’s own registered name',
    'resources.cmci': 'a portal’s own registered name',
    'resources.blgf': 'a bureau’s own registered name',
  };

  it('has the same keys in both locales', () => {
    expect(Object.keys(fil).sort()).toEqual(Object.keys(en).sort());
  });

  it('leaves no key untranslated without a stated reason', () => {
    const untranslated = Object.keys(en).filter(
      key => fil[key] === en[key] && !(key in DELIBERATELY_IDENTICAL)
    );
    expect(untranslated).toEqual([]);
  });

  it('keeps the exemption list honest', () => {
    const stale = Object.keys(DELIBERATELY_IDENTICAL).filter(
      key => fil[key] !== en[key]
    );
    expect(stale).toEqual([]);
  });
});

describe('the two-person rule reaches the record that needs it', () => {
  /*
   * `verificationRecordSchema` makes the collector-never-verifies rule
   * unparseable to violate — but only for a record that actually requires it.
   * The service guide, which is where fees, deadlines and requirements live,
   * is not built yet (it belongs to the guide-contract work), so this is a
   * TRIPWIRE rather than an assertion about today.
   *
   * Without it, the schema is exported and used by nothing, which is how a
   * rule gets deleted as dead code and nobody notices the rule went with it.
   */
  const schema = readFileSync(
    path.join(SRC, 'lib', 'content-schema.ts'),
    'utf8'
  );

  it('declares the record', () => {
    expect(schema).toContain('export const verificationRecordSchema');
  });

  /**
   * The text of one `export const <name> = …` declaration, up to the next
   * top-level export. Counting occurrences file-wide does NOT work: the record
   * is already named a second time by its own `z.infer` type alias, so a
   * counter reads as satisfied before the guide is written at all.
   */
  function declarationOf(name: string): string | null {
    const start = schema.search(new RegExp(`^export const ${name}\\b`, 'm'));
    if (start === -1) return null;
    const rest = schema.slice(start + 1);
    const end = rest.search(/^export (?:const|type) /m);
    return end === -1 ? rest : rest.slice(0, end);
  }

  /*
   * Two names, because the record this rule protects arrived under the second
   * one. `charterRecordSchema` (★ TAGO-201) is what content/ is authored
   * against today; `serviceGuideSchema` is the eight-field guide TAGO-004
   * froze, which returns only WITH a written permission to republish the
   * charter's contents.
   *
   * Keeping both listed is deliberate. Narrowing this to whichever one exists
   * today is how the rule quietly stops applying to the record that replaces
   * it.
   */
  it.each(['charterRecordSchema', 'serviceGuideSchema'])(
    'requires it on %s, the day that record exists',
    name => {
      const record = declarationOf(name);

      // Absent → nothing to check, and the check starts biting by itself the
      // moment somebody adds one. A record that never names the verification
      // record is the failure this exists to catch.
      const violation =
        record && !/\bverificationRecordSchema\b/.test(record)
          ? [`${name} exists but does not carry verificationRecordSchema`]
          : [];
      expect(violation).toEqual([]);
    }
  );
});

describe('how an absence is described', () => {
  /*
   * The publication rule from docs/governance.md § how an absence is described:
   * an outstanding or unobtainable fact is never described as a REFUSAL, a
   * CONCEALMENT, or a LACK OF TRANSPARENCY.
   *
   * "Requested on this date, not yet answered" is a fact. "Not published
   * anywhere we can cite" is a fact. "They are withholding it" is an inference
   * about intent this project cannot support and has no business making — and
   * it is the kind of sentence that gets written once, late, by someone
   * frustrated, and then sits on a civic page indefinitely.
   *
   * Phrase-matched, never word-matched. `refuse collection` is a real municipal
   * service and `withholding tax` is a real one too; a word list would fail the
   * build on a correct page and get deleted the first time it did.
   */
  const ACCUSATIONS: { framing: string; pattern: RegExp }[] = [
    { framing: 'refusal', pattern: /\brefus(?:ed|es|al|ing)\s+to\b/i },
    {
      framing: 'refusal',
      pattern: /\bdeclin(?:ed|es|ing)\s+to\s+(?:answer|provide|disclose|say)/i,
    },
    { framing: 'concealment', pattern: /\bconceal(?:s|ed|ing|ment)?\b/i },
    { framing: 'concealment', pattern: /\bcover[-\s]?up\b/i },
    { framing: 'concealment', pattern: /\bwithh(?:eld|olding)\b(?!\s+tax)/i },
    { framing: 'concealment', pattern: /\bhiding\s+(?:it|the|this|these)\b/i },
    {
      framing: 'transparency',
      pattern: /\black(?:s|ing)?\s+of\s+transparency\b/i,
    },
    { framing: 'transparency', pattern: /\bnot\s+transparent\b/i },
    { framing: 'transparency', pattern: /\bstonewall/i },
  ];

  /**
   * Every reader-facing string this project controls: the gap register and the
   * notes beside it, both message catalogues, and the content tree.
   */
  function scannedText(): SourceFile[] {
    const config = JSON.parse(
      readFileSync(path.join(ROOT, 'config', 'lgu.config.json'), 'utf8')
    );

    return [
      ...flatten(config).map(([key, text]) => ({
        path: `config/lgu.config.json → ${key}`,
        text,
      })),
      ...['en', 'fil'].flatMap(locale =>
        flatten(
          JSON.parse(
            readFileSync(path.join(ROOT, 'messages', `${locale}.json`), 'utf8')
          )
        ).map(([key, text]) => ({
          path: `messages/${locale}.json → ${key}`,
          text,
        }))
      ),
      ...filesMatching(path.join(ROOT, 'content'), /\.md$/),
    ];
  }

  /**
   * Every accusatory framing found, as `<where> → <framing>: <matched>`.
   *
   * EVERY occurrence, not the first — `String.match` without `/g` returns one
   * hit per pattern per file, which would mean a page carrying two accusations
   * surfaces one, and defending that one silently hides the other. The unit
   * being defended has to be the wording, not the file.
   */
  function accusations(files: SourceFile[]): string[] {
    return files.flatMap(file =>
      ACCUSATIONS.flatMap(({ framing, pattern }) => {
        const everywhere = new RegExp(pattern.source, `${pattern.flags}g`);
        const found = [...file.text.matchAll(everywhere)].map(
          hit => `${file.path} → ${framing}: "${hit[0]}"`
        );
        // Two identical wordings in one file are one thing to fix, and one
        // entry to defend.
        return [...new Set(found)];
      })
    );
  }

  /**
   * Wordings that trip a pattern above and are NOT accusations.
   *
   * Empty today, and adding a line is an editorial decision that has to be
   * defended in the reason string — never a way to close a red build. The
   * staleness check below deletes the excuse for leaving one behind.
   */
  const DEFENDED: Record<string, string> = {
    'content/charter/documents/municipal-accounting-office.md → concealment: "withholding"':
      "The accounting office's charter transcript. `Withholding Tax` is a tax the office remits, and `withholding` here is the municipality's own word for that transaction — not this project characterising an absence. Transcribed verbatim, so it cannot be reworded without breaking the byte-for-byte guarantee.",
    'content/charter/documents/municipal-accounting-office.md → concealment: "Withheld"':
      'Same document, same reason: `Taxes Withheld` is a line item in the charter, transcribed as printed.',
    'content/charter/documents/municipal-accounting-office.fil.md → concealment: "withholding"':
      'The Filipino twin of the above. Charter strings are carried through in the original by rule, so the same words appear in both locales.',
    'content/charter/documents/municipal-accounting-office.fil.md → concealment: "Withheld"':
      'The Filipino twin of the above.',
  };

  const SCANNED = scannedText();

  it('is actually reading the register, the messages and the content', () => {
    // A scan that silently reads nothing is a green no-op, which is worse than
    // no scan at all because it looks like somebody checked.
    expect(SCANNED.length).toBeGreaterThan(20);
    expect(SCANNED.map(file => file.path)).toContain(
      'config/lgu.config.json → emergency.note'
    );
    expect(SCANNED.some(file => file.path.startsWith('content/'))).toBe(true);
  });

  it('fires on a doctored fixture', () => {
    // A guardrail that has never gone red is not known to work. Every framing
    // the rule names gets a sentence that must trip it.
    const doctored = [
      { path: 'fixture', text: 'The office refused to answer our request.' },
      { path: 'fixture', text: 'The figure is being withheld from residents.' },
      { path: 'fixture', text: 'This reflects a lack of transparency.' },
    ];
    expect(accusations(doctored)).toHaveLength(3);
  });

  it('reports every accusation in a page, not just the first', () => {
    // The bug this replaced: one hit per pattern per file meant a page with two
    // accusations surfaced one, and defending that one hid the other.
    const twice = [
      {
        path: 'fixture',
        text: 'The office conceals the fee. A second office concealed its hours.',
      },
    ];
    expect(accusations(twice)).toHaveLength(2);
  });

  it('does not fire on legitimate municipal vocabulary', () => {
    // The two terms that make a word list unusable here.
    expect(
      accusations([
        { path: 'fixture', text: 'Refuse collection runs on Tuesdays.' },
        { path: 'fixture', text: 'Bring your withholding tax certificate.' },
      ])
    ).toEqual([]);
  });

  it('frames no absence as a refusal, a concealment, or a lack of transparency', () => {
    expect(accusations(SCANNED).filter(found => !(found in DEFENDED))).toEqual(
      []
    );
  });

  it('keeps the defended list honest', () => {
    // An exemption for a wording that no longer exists stops anyone reading the
    // list, at which point the live ones stop being seen.
    const live = new Set(accusations(SCANNED));
    expect(Object.keys(DEFENDED).filter(entry => !live.has(entry))).toEqual([]);
  });
});

/**
 * CONT-403 criterion 5 · CONT-404 — the reporting scripts never edit content.
 *
 * *"No page is updated in bulk or automatically — an automated fee edit is the
 * exact failure this pass exists to prevent."* A script that can write into
 * `content/` is one bad regex away from doing it to a hundred pages at once,
 * and the diff would be too large for anyone to read properly.
 *
 * So the rule is structural: these scripts read the tree and report. A human
 * corrects, and a second human verifies.
 */
describe('the reporting scripts cannot edit the content tree', () => {
  const SCRIPTS = ['charter-diff.mjs', 'freshness.mjs', 'handover.mjs'];

  const sourceOf = (name: string) =>
    readFileSync(path.join(REPO_ROOT, 'scripts', name), 'utf8');

  it('is actually reading the scripts', () => {
    for (const name of SCRIPTS) {
      expect(sourceOf(name).length, name).toBeGreaterThan(500);
    }
  });

  /*
   * ⚠️ Matching a literal `'content'` inside the call is NOT enough, and the
   * first version of this test made exactly that mistake: `handover.mjs`
   * copies directories from an array, so its write target is a VARIABLE and a
   * literal-only scan waved it straight through. A guardrail that cannot see
   * the real shape of the code it guards is worse than none, because it reads
   * as though somebody checked.
   *
   * So the check is on the FIRST ARGUMENT of every write call: it must be a
   * destination the script is allowed to write, and the allow-list is named
   * here per script rather than inferred.
   */
  /*
   * ⚠️ Two ways to get this wrong, and the first version of this test made
   * both.
   *
   * 1. Matching a literal `'content'` inside the call is not enough.
   *    `handover.mjs` copies directories from an array, so its target is a
   *    VARIABLE, and a literal-only scan waved it straight through.
   * 2. For `cpSync` and `renameSync` the destination is the SECOND argument.
   *    Checking the first would have been checking what is read, not what is
   *    written — and would have passed on a script copying content anywhere.
   *
   * A guardrail that cannot see the real shape of the code it guards is worse
   * than none, because it reads as though somebody checked.
   */
  const WRITERS =
    /\b(writeFileSync|appendFileSync|rmSync|mkdirSync|cpSync|renameSync)\(/g;

  /** The destination argument: second for a copy or move, first otherwise. */
  const DESTINATION_ARG: Record<string, number> = {
    writeFileSync: 0,
    appendFileSync: 0,
    rmSync: 0,
    mkdirSync: 0,
    cpSync: 1,
    renameSync: 1,
  };

  /** Split a call's arguments at depth-zero commas, balancing brackets. */
  function argumentsAt(source: string, openParen: number): string[] {
    const args: string[] = [];
    let depth = 0;
    let current = '';
    for (let i = openParen + 1; i < source.length; i++) {
      const character = source[i]!;
      if ('([{'.includes(character)) depth++;
      else if (')]}'.includes(character)) {
        if (depth === 0) {
          args.push(current.trim());
          return args;
        }
        depth--;
      }
      if (character === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }
      current += character;
    }
    return args;
  }

  const ALLOWED: Record<string, RegExp> = {
    'charter-diff.mjs': /^VERSIONS$/,
    'freshness.mjs': /^path\.join\(ROOT, 'inventory'/,
    // Everything lands under OUT, which is ROOT/handover and nothing else.
    'handover.mjs': /^(?:OUT$|path\.join\(OUT)/,
  };

  const destinationsIn = (name: string, source: string) =>
    [...source.matchAll(WRITERS)].map(match => {
      const call = match[1]!;
      const args = argumentsAt(source, match.index! + match[0].length - 1);
      return { call, target: args[DESTINATION_ARG[call]!] ?? '' };
    });

  it('is reading real write calls, not zero of them', () => {
    // Two empty sets agree perfectly, which is how this check would rot.
    for (const name of SCRIPTS) {
      expect(destinationsIn(name, sourceOf(name)).length, name).toBeGreaterThan(
        0
      );
    }
  });

  it('writes only where its allow-list permits', () => {
    const offenders: string[] = [];
    for (const name of SCRIPTS) {
      for (const { call, target } of destinationsIn(name, sourceOf(name))) {
        if (!ALLOWED[name]?.test(target)) {
          offenders.push(`${name}: ${call} → ${target}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('pins handover.mjs to a destination that is not the content tree', () => {
    // The destination is one constant. If it ever stops being `handover`, this
    // fails rather than the copy quietly landing somewhere else.
    expect(sourceOf('handover.mjs')).toMatch(
      /const OUT = path\.join\(ROOT, 'handover'\);/
    );
  });

  it('catches a copy INTO content, where the destination is the second argument', () => {
    // The bug this test had: checking argument one would read `sources/` here
    // and pass, while the script rewrote the whole content tree.
    const doctored = `cpSync(path.join(ROOT, 'sources'), path.join(ROOT, 'content'), { recursive: true });`;
    const found = destinationsIn('handover.mjs', doctored);
    expect(found).toHaveLength(1);
    expect(found[0]?.target).toBe("path.join(ROOT, 'content')");
    expect(ALLOWED['handover.mjs']!.test(found[0]!.target)).toBe(false);
  });

  it('fires on a direct write into content', () => {
    const doctored = `writeFileSync(path.join(ROOT, 'content', rel), fixed);`;
    const found = destinationsIn('freshness.mjs', doctored);
    expect(found).toHaveLength(1);
    expect(ALLOWED['freshness.mjs']!.test(found[0]!.target)).toBe(false);
  });
});
