import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

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

type SourceFile = { path: string; text: string };

/** Every shipped `.ts`/`.tsx` under a directory. Tests are not shipped. */
function sourceFiles(dir: string): SourceFile[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap<SourceFile>(
    entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      if (!/\.tsx?$/.test(entry.name)) return [];
      if (/\.(test|spec)\.tsx?$/.test(entry.name)) return [];
      return [
        {
          path: path.relative(ROOT, full).replace(/\\/g, '/'),
          text: readFileSync(full, 'utf8'),
        },
      ];
    }
  );
}

const SRC_FILES = sourceFiles(SRC);
const APP_FILES = sourceFiles(APP);

/** Files whose text matches, reported as paths so a failure names the culprit. */
function offenders(files: SourceFile[], pattern: RegExp): string[] {
  return files
    .filter(file => pattern.test(file.text))
    .map(file => `${file.path} → ${file.text.match(pattern)?.[0]}`);
}

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
    const docs = [
      'README.md',
      'CONTRIBUTING.md',
      'CODE_OF_CONDUCT.md',
      'docs/coding-standards.md',
      'docs/sources/README.md',
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

    expect(offenders(docs, OUTWARD)).toEqual([]);
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

describe('static rendering', () => {
  it('reads no dynamic request API in the route tree', () => {
    // cookies()/headers()/draftMode()/connection() in a layout drags every
    // route under it into dynamic rendering.
    expect(
      offenders(APP_FILES, /next\/headers|\b(?:cookies|draftMode|connection)\(/)
    ).toEqual([]);
  });

  it('never opts a route out of static rendering', () => {
    expect(
      offenders(APP_FILES, /export const (?:dynamic|revalidate)\b/)
    ).toEqual([]);
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

describe('translation coverage', () => {
  const read = (locale: string): Record<string, unknown> =>
    JSON.parse(
      readFileSync(path.join(ROOT, 'messages', `${locale}.json`), 'utf8')
    );

  function flatten(value: unknown, prefix = ''): [string, string][] {
    if (typeof value === 'string') return [[prefix, value]];
    if (value === null || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key)
    );
  }

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
