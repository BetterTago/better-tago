import Image from 'next/image';
import { Eye, GitBranch, Github, Users } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { VisitCount } from '@/components/layout/VisitCount';
import { ExternalNavLink } from '@/components/ui/ExternalNavLink';
import { Logo } from '@/components/ui/Logo';
import { NavLink } from '@/components/ui/NavLink';
import { Wordmark } from '@/components/ui/Wordmark';
import { FOOTER_PAGES, FOOTER_RESOURCES } from '@/data/navigation';
import { lguConfig } from '@/lib/lgu-config';
import { PORTAL_VERSION } from '@/lib/version';
import { getVisitCount } from '@/lib/visits';

/**
 * The four-column footer, on its own near-black ground in both themes.
 *
 * Ported from BetterTandag's `SiteFooter` (2026-08-10, by instruction) —
 * spacing, the four-component Contribute column and the bottom rail all match
 * its structure; content, tokens and the mark are this portal's own.
 *
 * `data-surface="inverse"` re-points the ink and mark roles — which is what
 * flattens the three-tone emblem to a single white silhouette with no second
 * SVG — and `data-ground="footer"` refines the two LINE roles on top, because
 * the inverse scope's white-alpha rules composite to about 1.4:1 over a ground
 * this dark. See globals.css.
 *
 * ## The independence line
 *
 * "Built by Tagon-on for Tago…" replaced an earlier, more explicit
 * disclaimer ("not operated by, endorsed by, or affiliated with…") on
 * 2026-08-10, by instruction — and it is BetterTandag's OWN pattern, not a
 * weaker copy of one: its footer states plainly, in its own code comment,
 * that this style of line is what carries the independence claim once the
 * above-the-fold notice is gone, alongside `meta.description`. Both of those
 * still hold true here — `portal.independent` stays `z.literal(true)` in the
 * schema regardless of this string, and `meta.description` still states the
 * project is independent and not the official site.
 *
 * ## 🔴 The Contribute column has a null branch, and it STATES the gap
 *
 * `portal.repository` is set today, so both buttons render. It was not always,
 * and it may not be again — this project's own rule is that an unobtained fact
 * is a labelled absence and never a silent one, and until 2026-08-10 the null
 * branch rendered an EMPTY `<ul>`: a reader saw a "Contribute" heading with
 * nothing under it and no way to tell whether the repository was missing or the
 * page was broken. TAGO-113 asks for a stated gap, and that is what it now
 * renders.
 */
export async function SiteFooter({
  /*
   * Defaulted from the configuration rather than read inside, so BOTH branches
   * are reachable from a fixture. The gap branch is the one that ships on the
   * day something is withdrawn, which is the worst possible day to find out it
   * was never designed — the same reason `HotlineTicker` and `StatBand` take
   * their data this way.
   */
  portal = lguConfig.portal,
}: {
  portal?: (typeof lguConfig)['portal'];
} = {}) {
  const [t, tNav, tCommon, format, visits] = await Promise.all([
    getTranslations('footer'),
    getTranslations('nav'),
    getTranslations('common'),
    getFormatter(),
    /*
     * Server-rendered, deliberately. A client-fetched figure would flash, would
     * need a loading state this codebase does not have, and would put a number
     * that is not yet true on screen for a frame — which `CountUp.tsx` exists
     * to prevent. `null` here means the store is unconfigured, cold, or did not
     * answer, and nothing renders.
     */
    getVisitCount(),
  ]);

  const { repository, network } = portal;

  /*
   * "BetterTago.org" — the host, but wearing the portal's own capitalisation.
   * `portal.domain` is the source of truth for which host this is (rule 10);
   * `portal.name` is the source of truth for how it is written. Taking the
   * TLD from one and the label from the other means re-pointing the portal at
   * a different domain updates this line with no code change.
   */
  const host = new URL(portal.domain).hostname.replace(/^www\./, '');
  const brandedHost = [portal.name, ...host.split('.').slice(1)].join('.');

  // One class list for both Contribute buttons: a raised wash on the ground
  // with a boundary that clears 3:1 against it, since a dark button on a dark
  // ground is otherwise identifiable only by its label.
  const contributeButton =
    'inline-flex min-h-11 w-full items-center gap-2.5 rounded-full border border-line-control bg-surface-raised px-5 text-sm font-semibold text-ink motion-safe:transition-colors motion-safe:duration-200 hover:border-ink-link hover:text-ink-link';

  return (
    <footer
      data-surface="inverse"
      data-ground="footer"
      className="bg-surface-page text-ink"
    >
      <div className="page-measure grid gap-8 pt-12 pb-8 sm:grid-cols-2 xl:grid-cols-4">
        {/* 1 — Brand */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Logo idPrefix="site-footer" size={40} />
            {/* The SAME component as the header. Two lockups diverging is a
                bug that only shows when somebody scrolls the whole page. */}
            <Wordmark />
          </div>
          <p className="text-sm leading-relaxed text-ink-secondary">
            {t('independence')}
          </p>
        </div>

        {/* 2 — Pages */}
        <nav aria-labelledby="footer-pages">
          <h2
            id="footer-pages"
            className="mb-3 text-2xs font-bold tracking-label text-ink-tertiary uppercase"
          >
            {t('columnPages')}
          </h2>
          {/* `gap-2.5`, and `min-h-5` rather than the 44px floor — both by
              instruction, matching BetterTandag's own footer spacing exactly.
              A deliberate, listed exemption in home.a11y.spec.ts, not an
              oversight. */}
          <ul className="grid gap-2.5 text-sm">
            {FOOTER_PAGES.map(item => (
              <li key={item.messageKey}>
                <NavLink
                  item={item}
                  variant="badge"
                  className="inline-flex min-h-5 items-center"
                />
              </li>
            ))}
          </ul>
        </nav>

        {/* 3 — Resources */}
        <nav aria-labelledby="footer-resources">
          <h2
            id="footer-resources"
            className="mb-3 text-2xs font-bold tracking-label text-ink-tertiary uppercase"
          >
            {t('columnResources')}
          </h2>
          <ul className="grid gap-2.5 text-sm">
            {FOOTER_RESOURCES.map(item => (
              <li key={item.messageKey}>
                <ExternalNavLink
                  item={item}
                  className="inline-flex min-h-5 items-center"
                />
              </li>
            ))}
          </ul>
        </nav>

        {/* 4 — Contribute. Four components, matching BetterTandag's own
            column exactly: the cost pill, two buttons at the SAME
            destination, and the network mark. */}
        <div className="@container">
          <h2
            id="footer-contribute"
            className="mb-3 text-2xs font-bold tracking-label text-ink-tertiary uppercase"
          >
            {t('columnContribute')}
          </h2>

          {/* The project's headline claim, set as one line at every width by
              SIZE (`--text-cost`, sized against this column with `cqi`) —
              see globals.css. `w-fit`: the pill hugs its text rather than
              filling the column. */}
          <p className="mb-4 w-fit rounded-full bg-success-900 px-4 py-2 font-display text-cost font-bold whitespace-nowrap text-success-400">
            {t('costLine')}
          </p>

          {/* Buttons by appearance, links by semantics: both navigate, so
              they stay <a>. Both rows point at the SAME repository —
              volunteering on this project IS the repo, and two buttons to
              one destination is deliberate, not a copy-paste. */}
          <ul aria-labelledby="footer-contribute" className="grid gap-2.5">
            {repository && (
              <>
                <li>
                  <a
                    href={repository}
                    rel="noopener noreferrer"
                    target="_blank"
                    className={contributeButton}
                  >
                    <Users aria-hidden="true" className="size-4 shrink-0" />
                    {t('volunteer')}
                    <span className="sr-only">
                      {' '}
                      ({tCommon('opensExternalSite')})
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href={repository}
                    rel="noopener noreferrer"
                    target="_blank"
                    className={contributeButton}
                  >
                    <Github aria-hidden="true" className="size-4 shrink-0" />
                    {t('contributeCode')}
                    <span className="sr-only">
                      {' '}
                      ({tCommon('opensExternalSite')})
                    </span>
                  </a>
                </li>
              </>
            )}
          </ul>

          {/* The stated gap, not an empty column. It is a plain string rather
              than a `GapNotice`: the register is keyed on `pending` entries,
              and the schema rejects a `pending` entry for a field that has a
              value — so a repository that is merely NOT YET published cannot
              have one without failing the build the day it is. */}
          {!repository && (
            <p className="text-sm leading-relaxed text-ink-secondary">
              {t('repositoryGap')}
            </p>
          )}

          {/* The programme's own mark, in `public/`. The WHITE variant, not
              the primary: the primary is drawn in the brand deep green, which
              is far too close to this ground to read, where white is
              18.89:1. `unoptimized` because Next's optimiser refuses SVG
              unless `dangerouslyAllowSVG` is set, and opening that door
              site-wide for one first-party file we ship ourselves is the
              wrong trade. */}
          <a
            href={network.url}
            rel="noopener noreferrer"
            target="_blank"
            className="mt-5 inline-block motion-safe:transition-opacity motion-safe:duration-200 hover:opacity-80"
          >
            <Image
              src="/bettergov-white.svg"
              alt={t('network', { network: network.name })}
              width={64}
              height={64}
              unoptimized
            />
            <span className="sr-only">({tCommon('opensExternalSite')})</span>
          </a>
        </div>
      </div>

      <div className="page-measure pb-16">
        <div className="flex flex-col gap-3 border-t border-line pt-6 text-xs leading-relaxed text-ink-tertiary sm:flex-row sm:items-center sm:justify-between">
          <p>{t('copyright', { host: brandedHost })}</p>

          <div className="flex shrink-0 items-center gap-4">
            {repository && (
              <a
                href={repository}
                rel="noopener noreferrer"
                target="_blank"
                data-badge="source"
                /*
                 * The third badge, and the only one that carries its own
                 * colour. `border-current` rather than `border-line`: inside
                 * this scope `--ink-link` is the mark's sun, so the outline is
                 * literally the link's own ink and cannot drift from it if the
                 * role is ever re-pointed.
                 *
                 * It reads as a different KIND of thing from the two beside it
                 * on purpose — those are figures, this is somewhere to go.
                 */
                className="inline-flex items-center gap-1.5 rounded-full border border-current bg-surface-sunken px-3 py-1 text-ink-link hover:text-ink-link-hover"
              >
                <Github aria-hidden="true" className="size-3.5 shrink-0" />
                {t('sourceCode')}
                <span className="sr-only">
                  {' '}
                  ({tCommon('opensExternalSite')})
                </span>
              </a>
            )}
            {/*
              Both figures are BADGES — a pill with a border and a ground,
              rather than bare text in the rail. They are the only two numbers
              down here and they read as a pair, so they are shaped as one.

              🔴 The dash is deliberate, and it is NOT the rule `StatBand`
              follows. There, a missing figure renders its gap-register entry
              and never a dash, because a population is a civic fact and a dash
              would stand where a sourced number belongs. A visit count is
              explicitly decorative — the ticket says so and the label says so —
              so "— visits" is honest here in a way it would never be there: a
              dash is not a claim, and it keeps the pair from reflowing every
              time the store is cold.

              What must still never appear is `0`. A zero is a NUMBER, and this
              portal has not counted it.
            */}
            <p
              /* Named so a test can find the PAIR without matching every
                 rounded-full element in the footer — the cost line is one too. */
              data-badge="visits"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-sunken px-3 py-1 tabular-nums"
              title={t('visitsCaveat')}
            >
              <Eye aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="sr-only">{t('visitsLabel')}: </span>
              <span data-badge-value>
                {visits !== null && visits > 0
                  ? t('visits', { count: format.number(visits) })
                  : t('visitsEmpty')}
              </span>
              <span className="sr-only"> — {t('visitsCaveat')}</span>
            </p>

            {/* PORTAL_VERSION comes from package.json via src/lib/version.ts —
                never a literal. The glyph is decorative, so the label it
                needs is supplied in text for a screen reader. */}
            <p
              data-badge="version"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-sunken px-3 py-1 tabular-nums"
            >
              <GitBranch aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="sr-only">{t('version')}: </span>
              {PORTAL_VERSION}
            </p>
          </div>
        </div>
      </div>

      {/* The nav label is read here so the column headings and the primary
          nav cannot drift into two vocabularies for the same destinations. */}
      <span className="sr-only">{tNav('footerLabel')}</span>

      {/*
        Renders no markup. It exists to perform the count write, which needs a
        real browser and the reader's own 24-hour marker — neither available to
        a prerendered server render. It is mounted here rather than in the
        layout so the write and the figure live in one file.
      */}
      <VisitCount />
    </footer>
  );
}
