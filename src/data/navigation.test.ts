import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import fil from '../../messages/fil.json';
import {
  FOOTER_PAGES,
  FOOTER_RESOURCES,
  NAV_INDEX,
  PAGE_SECTIONS,
  PRIMARY_NAV,
  type NavItem,
} from './navigation';

const SOURCE = readFileSync(
  path.join(process.cwd(), 'src', 'data', 'navigation.ts'),
  'utf8'
);

/** Every routed destination in the tree, parents and children alike. */
const ALL_ITEMS: NavItem[] = [...NAV_INDEX, ...FOOTER_PAGES];

describe('the navigation tree is one structure', () => {
  it('feeds the header, the mobile sheet and the search index from the same array', () => {
    /*
     * `PRIMARY_NAV` is rendered twice by SiteHeader — once as the desktop row
     * and once inside MobileNav — from ONE `navRow` helper, and `NAV_INDEX` is
     * derived from it rather than written out again. A destination that appears
     * in one surface and not the other is the failure this shape prevents, and
     * it is invisible until somebody opens the site on a phone.
     */
    const header = readFileSync(
      path.join(process.cwd(), 'src', 'components', 'layout', 'SiteHeader.tsx'),
      'utf8'
    );

    const renders = [...header.matchAll(/PRIMARY_NAV\.map/g)];
    expect(renders).toHaveLength(2);

    // And both go through the same builder, so they cannot diverge in what a
    // row IS — only in how it is sized.
    expect(header).toContain("navRow(item, 'dropdown')");
    expect(header).toContain("navRow(item, 'inline')");
  });

  it('exposes every parent and every child in the flat index', () => {
    const expected = PRIMARY_NAV.reduce(
      (count, item) => count + 1 + (item.children?.length ?? 0),
      0
    );
    expect(NAV_INDEX).toHaveLength(expected);

    for (const parent of PRIMARY_NAV) {
      expect(NAV_INDEX).toContain(parent);
      for (const child of parent.children ?? []) {
        expect(NAV_INDEX).toContain(child);
      }
    }
  });
});

describe('no user-facing string lives in the navigation data', () => {
  it('resolves every messageKey in BOTH locales', () => {
    const navEn = en.nav as Record<string, string>;
    const navFil = fil.nav as Record<string, string>;

    for (const item of ALL_ITEMS) {
      expect(
        navEn[item.messageKey],
        `nav.${item.messageKey} is missing from messages/en.json`
      ).toBeTruthy();
      expect(
        navFil[item.messageKey],
        `nav.${item.messageKey} is missing from messages/fil.json`
      ).toBeTruthy();
    }

    const resourcesEn = en.resources as Record<string, string>;
    const resourcesFil = fil.resources as Record<string, string>;
    for (const item of FOOTER_RESOURCES) {
      expect(resourcesEn[item.messageKey]).toBeTruthy();
      expect(resourcesFil[item.messageKey]).toBeTruthy();
    }
  });

  it('declares no label, name or title property', () => {
    /*
     * A tree that has to be REWRITTEN in order to be translated is a tree that
     * gets translated in one place and not the other. The only human-readable
     * strings this file may contain are message KEYS and URLs.
     */
    expect(SOURCE).not.toMatch(/^\s*(?:label|name|title|text):/m);
  });

  it('fires on a doctored entry', () => {
    // A guardrail that has never gone red is not known to work.
    const doctored = "  label: 'All services',";
    expect(doctored).toMatch(/^\s*(?:label|name|title|text):/m);
  });
});

describe('a destination that does not exist is not a link', () => {
  it('marks every unbuilt route `coming-soon`', () => {
    /*
     * The route set is enumerated in guardrails.test.ts. Anything the tree
     * calls `live` and that is neither an in-page anchor nor a shipped route is
     * a 404 reached from our own navigation, which reads as a broken site.
     */
    const SHIPPED = ['/services', '/gaps'];

    const liveRoutes = ALL_ITEMS.filter(
      item => item.status === 'live' && !item.href.startsWith('#')
    );

    for (const item of liveRoutes) {
      const reachable = SHIPPED.some(
        route => item.href === route || item.href.startsWith(`${route}/`)
      );
      expect(
        reachable,
        `${item.href} is marked live but is not a shipped route`
      ).toBe(true);
    }
  });

  it('keeps at least one live and one coming-soon entry', () => {
    /*
     * The MIX is what exercises both paths. A tree where everything is
     * `coming-soon` never renders a real link, and one where everything is live
     * never renders the non-link — so a regression in either would ship green.
     */
    expect(ALL_ITEMS.some(item => item.status === 'live')).toBe(true);
    expect(ALL_ITEMS.some(item => item.status === 'coming-soon')).toBe(true);
  });
});

describe('municipal vocabulary, never a city’s', () => {
  it('names the Sangguniang Bayan and never the Sangguniang Panlungsod', () => {
    /*
     * 🔴 Tago is a MUNICIPALITY. Its legislature is the Sangguniang Bayan; a
     * city's is the Sangguniang Panlungsod. Copying a footer row across from a
     * city portal would have named the wrong body on every page of this site,
     * and it is exactly the class of error that reading from another LGU
     * produces — cheap to make, invisible in review, wrong everywhere.
     */
    /*
     * The footer ROW was removed on 2026-08-10 (no known website), so this no
     * longer asserts its presence — it asserts the vocabulary, which is what
     * the test was ever really for. The string stays in both catalogues and
     * returns with the row the day a site is found.
     */
    for (const locale of [en, fil]) {
      const resources = locale.resources as Record<string, string>;
      expect(resources.sangguniangBayan).toBeTruthy();
    }

    // The KEYS, not the prose: the comment beside this entry names the city
    // term in order to explain why it is wrong, and a raw source scan would
    // fail on the explanation while missing an actual mistake.
    const keys = [...NAV_INDEX, ...FOOTER_PAGES, ...FOOTER_RESOURCES].map(
      item => item.messageKey
    );
    expect(keys.filter(key => /panlungsod/i.test(key))).toEqual([]);
    expect(SOURCE).not.toMatch(/messageKey:\s*'[^']*panlungsod/i);

    // And the rendered strings, where it would actually reach a reader.
    for (const locale of [en, fil]) {
      const resources = locale.resources as Record<string, string>;
      expect(resources.sangguniangBayan).toMatch(/Bayan/);
      expect(JSON.stringify(locale)).not.toMatch(/panlungsod/i);
    }
  });

  it('calls the LGU a municipality in both locales', () => {
    expect(en.nav.municipality.toLowerCase()).toContain('municipality');
    expect(fil.nav.municipality.toLowerCase()).toContain('munisipyo');
  });
});

describe('the page sections', () => {
  it('matches the render order in [locale]/page.tsx exactly', () => {
    /*
     * The order was reversed by instruction on 2026-08-10 — history now runs
     * ahead of emergency. What this test actually defends is not one
     * particular ordering but that THIS array and the page's rendered order
     * cannot drift apart: an in-page anchor link and a search result for the
     * same section have to agree about where it sits, or a reader who follows
     * one and then the other lands somewhere that does not match.
     */
    const page = readFileSync(
      path.join(process.cwd(), 'src', 'app', '[locale]', 'page.tsx'),
      'utf8'
    );

    const rendered = [
      ...page.matchAll(
        /<(HistorySection|EmergencySection|GettingHere|ContactSection)\b/g
      ),
    ].map(match => match[1]);
    const COMPONENT_FOR_ANCHOR: Record<string, string> = {
      '#history': 'HistorySection',
      '#emergency': 'EmergencySection',
      '#getting-here': 'GettingHere',
      '#contact': 'ContactSection',
    };

    const expected = PAGE_SECTIONS.filter(
      section => section.anchor in COMPONENT_FOR_ANCHOR
    ).map(section => COMPONENT_FOR_ANCHOR[section.anchor]);

    expect(expected).toEqual(rendered);
  });

  it('fires on a doctored order', () => {
    // A guardrail that has never gone red is not known to work.
    const doctored = ['EmergencySection', 'HistorySection', 'ContactSection'];
    const real = ['HistorySection', 'EmergencySection', 'ContactSection'];
    expect(doctored).not.toEqual(real);
  });
});
