import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
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

describe('nothing is public while the Phase 0 gate is open', () => {
  /*
   * THE WAVE GATE. No public route ships, and the domain does not begin to
   * resolve, until the municipality has been told this project exists. That is
   * a decision about the project rather than about the code — so the code's job
   * is to make breaching it by accident impossible.
   *
   * `content/` is now populated: office records, service index entries, the
   * emergency layer, the home copy. NONE of it is reachable by a URL, and these
   * two assertions are the whole of what keeps that true. The trunk deploys to
   * production, so "we did not mean to publish it" is not a control.
   *
   * When the gate closes, this block is DELETED — deliberately, in a diff
   * somebody reviews. That review is the moment the gate exists to force, and a
   * test that has to be removed on purpose is the only kind that produces it.
   */

  /** Every route file permitted while the gate is open. */
  const ROUTES_WHILE_GATED = [
    'src/app/[locale]/error.tsx',
    'src/app/[locale]/layout.tsx',
    'src/app/[locale]/not-found.tsx',
    'src/app/[locale]/page.tsx',
    'src/app/layout.tsx',
    'src/app/not-found.tsx',
    'src/app/robots.ts',
    'src/app/sitemap.ts',
  ];

  /** Route files present that the gate does not permit. */
  function unpermittedRoutes(files: SourceFile[]): string[] {
    return files
      .map(file => file.path)
      .filter(route => !ROUTES_WHILE_GATED.includes(route))
      .sort();
  }

  /**
   * Anything importing the content loader.
   *
   * Deliberately scanned over the WHOLE source tree, not just `src/app`. A
   * route reaches `content/` just as effectively through a component two levels
   * down, and a scan that only reads the route files would miss exactly that.
   * If nothing anywhere imports the loader, no route can reach it — which is
   * the property worth asserting, and it is cheap to keep true.
   */
  function contentReaders(files: SourceFile[]): string[] {
    return files
      .filter(file => file.path !== 'src/lib/content.ts')
      .filter(file => /['"]@\/lib\/content['"]/.test(file.text))
      .map(file => file.path)
      .sort();
  }

  it('adds no route beyond the holding page', () => {
    expect(unpermittedRoutes(APP_FILES)).toEqual([]);

    // The reverse, so a deleted route is caught too: a shrinking route set
    // while the gate is open is not a breach, but it does mean this list has
    // stopped describing the application and nobody noticed.
    expect(APP_FILES.map(file => file.path).sort()).toEqual(
      [...ROUTES_WHILE_GATED].sort()
    );
  });

  it('lets nothing in the source tree read the content layer', () => {
    expect(contentReaders(SRC_FILES)).toEqual([]);
  });

  it('fires on a doctored route and a doctored importer', () => {
    // Neither assertion above has ever gone red, and a guardrail that has never
    // gone red is not known to work. These are the two exact breaches: a route
    // that renders content, and a component that fetches it.
    expect(
      unpermittedRoutes([
        ...APP_FILES,
        { path: 'src/app/[locale]/services/page.tsx', text: '' },
      ])
    ).toEqual(['src/app/[locale]/services/page.tsx']);

    expect(
      contentReaders([
        ...SRC_FILES,
        {
          path: 'src/components/content/ServiceList.tsx',
          text: "import { getManifest } from '@/lib/content';",
        },
      ])
    ).toEqual(['src/components/content/ServiceList.tsx']);
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

  it('requires it on the service guide record, the day that record exists', () => {
    const guide = declarationOf('serviceGuideSchema');

    // No guide yet → nothing to check, and the check starts biting by itself
    // the moment somebody adds one. A guide that never names the record is the
    // failure this exists to catch.
    const violation =
      guide && !/\bverificationRecordSchema\b/.test(guide)
        ? [
            'serviceGuideSchema exists but does not carry verificationRecordSchema',
          ]
        : [];
    expect(violation).toEqual([]);
  });
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
  const DEFENDED: Record<string, string> = {};

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
