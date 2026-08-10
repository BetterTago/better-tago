import { ArrowRight, Mail } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { lguConfig } from '@/lib/lgu-config';
import { SearchForm } from './SearchForm';

/**
 * The hero.
 *
 * ## The heading is one balanced line, not a three-beat lockup
 *
 * The reference portal's H1 is a three-part lockup — two words in brand and
 * accent, then the place name on its own larger line. BetterTago's own tagline
 * is a SENTENCE, not a three-beat phrase, and no Tago-specific hero lockup has
 * been written. Inventing a Surigaonon or Kamayo motto to fill that shape is
 * exactly what this project does not do, and the language question is not
 * settled.
 *
 * So the H1 is one balanced line with the municipality name set in
 * `--text-hero-town`, which is sized so the rendered name is ~70% of the
 * rendered WIDTH of the line above — a width ratio, not a font-size ratio.
 *
 * `block` on the name line rather than a relied-upon natural wrap: with two
 * type sizes in one heading the break point is no longer predictable from the
 * text.
 */
export async function Hero({ locale }: { locale: string }) {
  const t = await getTranslations('hero');
  const { lgu } = lguConfig;

  return (
    <section id="top" className="relative overflow-hidden scroll-mt-24">
      {/* The space between the hero and the stat band belongs to the HERO's
          own bottom padding (`pb-16` / `lg:pb-18`), not to a top margin on the
          band. The band is a full-bleed coloured edge: a margin above it opens
          a strip of page ground that reads as a gap in the page rather than as
          the hero breathing, and it also pushes the ridge texture's bottom
          edge away from the band it should meet.

          Both layers below are childless and absolutely positioned. Masking an
          element masks its DESCENDANTS too, so a decorative layer must never go
          on a container — the ridge would clip the hero's own text. */}
      <div aria-hidden="true" className="hero-ridge absolute inset-0 -z-10" />
      <div aria-hidden="true" className="hero-glow absolute inset-0 -z-10" />

      {/* Equal columns, by instruction — `minmax(0,1fr)` on both sides rather
          than the reference portal's 1.15/0.85 split, so the heading column
          and the search card read as two peers rather than a lead column with
          a sidebar. `minmax(0,…)` is still load-bearing on each: a bare `1fr`
          track cannot shrink below its content's intrinsic width, and the
          search card's input would blow the column out at narrower desktop
          widths without it.

          `lg:items-center`, not `-start`: the two columns are peers now, so
          they are centred against each other's midline rather than sharing a
          top edge — a top-align reads as a lead column and a sidebar again the
          moment the two columns are unequal heights, which they usually are. */}
      <div className="page-measure grid gap-10 pt-10 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-12 lg:pt-14 lg:pb-18">
        <div>
          <p className="text-2xs font-semibold tracking-eyebrow text-ink-accent-strong uppercase motion-safe:animate-rise">
            {/* The municipality's own name, then the province — not the
                province/region pair the reference portal's city version uses.
                A municipality's identity is "which LGU, in which province";
                the REGION is one level too far up to be what a reader is
                orienting against on their own hero. */}
            {lgu.officialName} · {lgu.province}
          </p>

          <h1 className="mt-3 font-display font-bold text-balance motion-safe:animate-rise motion-safe:rise-1">
            <span className="block text-hero">{t('headingLead')}</span>
            <span className="block text-hero-town text-ink-accent">
              {lgu.shortName}
            </span>
          </h1>

          <p className="mt-5 max-w-prose text-lg leading-relaxed text-ink-secondary motion-safe:animate-rise motion-safe:rise-2">
            {t('lede')}
          </p>

          <div className="mt-7 flex flex-wrap gap-3 motion-safe:animate-rise motion-safe:rise-3">
            <Link
              href="/services"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-band px-4 text-cta font-semibold text-ink-on-band hover:bg-surface-band-hover"
            >
              {t('ctaServices')}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            {/*
              An in-page anchor rather than a route, because /contact does not
              exist yet (TAGO-106) — a CTA that 404s from our own hero is worse
              than one that scrolls. Same target as the header's Contact item,
              from the same `#contact` section, so the two can never drift.

              This was "Emergency: 911" until 2026-08-10. The number is still
              one tap away in three places — the ticker at the top of every
              page, the header's own Emergency item, and the band inside
              `#emergency` — and the hero's second slot now does the job a hero
              is better at: pointing a reader at the office that answers
              everything else.
            */}
            <a
              href="#contact"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-control px-4 text-cta font-semibold text-ink hover:border-ink-link"
            >
              <Mail aria-hidden="true" className="size-4" />
              {t('ctaContact')}
            </a>
          </div>
        </div>

        <div className="motion-safe:animate-rise motion-safe:rise-2">
          <SearchForm locale={locale} />
        </div>
      </div>
    </section>
  );
}
