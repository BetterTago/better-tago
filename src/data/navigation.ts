/**
 * The one navigation tree. Header row, mobile sheet and the search index all
 * read it, so a destination cannot appear in one and be missing from another.
 *
 * 🔴 **No user-facing string lives in this file.** `messageKey` indexes `nav.*`
 * in messages/{en,fil}.json, and `navigation.test.ts` fails on a literal label
 * here — a tree that has to be rewritten to be translated is a tree that will
 * be translated in one place and not the other.
 *
 * `status` is `coming-soon` until the route actually exists. Those render as
 * non-links with an accessible hint rather than as links that 404, because a
 * 404 reached from a site's own navigation reads as a broken site.
 */

import { lguConfig } from '@/lib/lgu-config';

export type NavStatus = 'live' | 'coming-soon';

export type NavItem = {
  messageKey: string;
  href: string;
  status: NavStatus;
  /**
   * A submenu. Present on a parent that groups routes; absent on a leaf.
   *
   * A parent renders as a disclosure `<button>` rather than a link even when
   * its own `href` is live — one control cannot both navigate and reveal. The
   * `href` is kept regardless, so the group's own index page is reachable as
   * the first child and nothing is lost if a parent is flattened back to a leaf.
   */
  children?: NavItem[];
};

/**
 * Five top-level items, not six.
 *
 * Filipino runs 15–25% longer on every one of these labels and every parent
 * carries a chevron, so the desktop row has to hold the mark, the nav and three
 * controls inside the page measure at 1024px with the LONGER string set. That
 * is the sizing case, and it is why Tourism and Barangays are folded into
 * groups rather than promoted.
 *
 * ## What is live today, and what is not
 *
 * Services is the first `live` entry this tree has ever had: the whole
 * Citizen's Charter is transcribed and 99 guides ship across 11 categories.
 * Everything under Government and The municipality is still `coming-soon`, and
 * the three in-page anchors are live because their sections are right there.
 *
 * That MIX is deliberate and worth keeping: a tree where every entry is
 * `coming-soon` never exercises the live path, and one where every entry is
 * live never exercises the non-link path.
 */
export const PRIMARY_NAV: NavItem[] = [
  {
    messageKey: 'services',
    href: '/services',
    status: 'live',
    children: [
      { messageKey: 'allServices', href: '/services', status: 'live' },
      {
        messageKey: 'civilRegistry',
        href: '/services/civil-registry',
        status: 'live',
      },
      {
        messageKey: 'businessAndPermits',
        href: '/services/business-and-permits',
        status: 'live',
      },
      { messageKey: 'health', href: '/services/health', status: 'live' },
      {
        messageKey: 'socialWelfare',
        href: '/services/social-welfare',
        status: 'live',
      },
    ],
  },
  {
    messageKey: 'government',
    href: '/government',
    status: 'coming-soon',
    children: [
      {
        messageKey: 'offices',
        href: '/government/offices',
        status: 'coming-soon',
      },
      {
        messageKey: 'transparency',
        href: '/government/transparency',
        status: 'coming-soon',
      },
      {
        messageKey: 'barangays',
        href: '/government/barangays',
        status: 'coming-soon',
      },
    ],
  },
  {
    messageKey: 'municipality',
    href: '/municipality',
    status: 'coming-soon',
    children: [
      {
        messageKey: 'atAGlance',
        href: '/municipality',
        status: 'coming-soon',
      },
      // Live, and deliberately so: a group whose every child is `coming-soon`
      // is easy to write off as decorative, and this one proves the pattern
      // works end to end.
      { messageKey: 'history', href: '#history', status: 'live' },
      { messageKey: 'tourism', href: '/tourism', status: 'coming-soon' },
    ],
  },
  // 🔴 Routes, not the `#emergency` / `#contact` anchors these were until the
  // two pages shipped. An in-page anchor in the PRIMARY nav is only correct on
  // the page it belongs to: a reader three levels into the service guides who
  // tapped Emergency was sent back to the home page and then scrolled most of
  // the way down it, which is the wrong number of steps on the one surface
  // somebody might reach in a storm. The home sections are unchanged and still
  // carry those ids — `#history` still uses one, so the anchor branch of
  // `NavLink` is still exercised.
  { messageKey: 'emergency', href: '/emergency', status: 'live' },
  { messageKey: 'contact', href: '/contact', status: 'live' },
];

/** Parents and children in one flat list, for the search index. */
export const NAV_INDEX: NavItem[] = PRIMARY_NAV.flatMap(item => [
  item,
  ...(item.children ?? []),
]);

/**
 * The footer's "Pages" column.
 *
 * The gap register is live and is the only entry here that is not also in the
 * primary nav. It belongs in the footer rather than the header for the same
 * reason a sources page does: it is the thing a reader consults ABOUT the
 * portal, not a place they were trying to get to.
 */
export const FOOTER_PAGES: NavItem[] = [
  { messageKey: 'services', href: '/services', status: 'live' },
  { messageKey: 'gaps', href: '/gaps', status: 'live' },
  { messageKey: 'offices', href: '/government/offices', status: 'coming-soon' },
  {
    messageKey: 'transparency',
    href: '/government/transparency',
    status: 'coming-soon',
  },
  {
    messageKey: 'barangays',
    href: '/government/barangays',
    status: 'coming-soon',
  },
  { messageKey: 'tourism', href: '/tourism', status: 'coming-soon' },
];

/**
 * Off-site destinations, for the footer's "Resources" column.
 *
 * A separate type from `NavItem` because nothing here is routable: no locale
 * prefix, no `coming-soon` route that will one day exist, and `messageKey`
 * indexes `resources.*`. `href: null` means "the body exists but its site does
 * not" — rendered as a non-link, never as a guessed URL.
 */
export type ExternalNavItem = {
  messageKey: string;
  href: string | null;
};

export const FOOTER_RESOURCES: ExternalNavItem[] = [
  // The authoritative record, first. Where this portal and it disagree, it is
  // right and this portal is wrong.
  { messageKey: 'officialSite', href: lguConfig.officialSite.url },
  { messageKey: 'citizensCharter', href: lguConfig.sources.citizensCharter },
  { messageKey: 'transparencySeal', href: lguConfig.sources.transparencySeal },
  // From the config, not a literal: there is exactly one place that knows which
  // LGU this portal is pointed at.
  { messageKey: 'lguFacebook', href: lguConfig.socials.municipalFacebook },
  { messageKey: 'philgeps', href: 'https://www.philgeps.gov.ph/' },
  { messageKey: 'cmci', href: 'https://cmci.dti.gov.ph/' },
  { messageKey: 'blgf', href: 'https://blgf.gov.ph/' },
  { messageKey: 'foi', href: 'https://www.foi.gov.ph/' },
  { messageKey: 'govph', href: 'https://www.gov.ph/' },
];

/*
 * ⚠️ Two entries were REMOVED from this column on 2026-08-10, by instruction,
 * and both are worth a line so their absence reads as a decision:
 *
 * · `sangguniangBayan` — the municipal legislature, which had no known website
 *   and therefore rendered as a non-link. It was the only entry exercising the
 *   `href: null` path, so `ExternalNavLink`'s non-link branch is now unused in
 *   production. The branch and its test stay: `href` is still nullable, the
 *   next body without a site will hit it, and deleting a guard because nothing
 *   currently trips it is how the guard is missing when it is needed.
 *
 *   It also carried the municipal-vocabulary test — Bayan, never Panlungsod.
 *   That assertion now runs against the message catalogues instead, where the
 *   string still lives, so the protection did not leave with the row.
 *
 * · `psa` — the national statistics authority. Still the source behind three
 *   figures in the stat band and still cited there; it is simply no longer a
 *   navigation destination in the footer.
 */

/**
 * The numbered in-page sections, in PAGE ORDER, and the section half of the
 * search index — so the order here is the order a reader sees in results.
 *
 * Emergency was ahead of history for one design reason: on this portal the
 * emergency section's content IS a gap, and a gap about emergency numbers in a
 * municipality facing the Pacific seemed like the most important thing the
 * page had to say. That order was REVERSED by direct instruction on
 * 2026-08-10 — history now runs second and emergency third — and this array
 * has to track the rendered order in `[locale]/page.tsx` exactly, or an
 * in-page link and a search result would disagree about where a section sits.
 */
export const PAGE_SECTIONS = [
  { anchor: '#services', messageNamespace: 'services' },
  { anchor: '#history', messageNamespace: 'history' },
  { anchor: '#emergency', messageNamespace: 'emergency' },
  { anchor: '#getting-here', messageNamespace: 'gettingHere' },
  { anchor: '#contact', messageNamespace: 'contact' },
] as const;
