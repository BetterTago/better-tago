import { getLocale, getTranslations } from 'next-intl/server';
import { Section } from '@/components/ui/Section';
import { getTravelRoutes } from '@/lib/content';
import { cn } from '@/lib/utils';

/**
 * Getting to Tago — by air, by land, from the provincial capital, and on
 * arrival.
 *
 * Ported from BetterTandag's `GettingHere` (2026-08-10, by instruction): same
 * four-card ladder, same kicker/title/body shape, same inverse-surface
 * treatment on the arrival card. The content is Tago's own and lives in
 * `content/home/getting-here/routes.yaml`, so adding a fifth card is a YAML
 * edit and this component does not change.
 *
 * A fixed 1 / 2 / 4 ladder rather than an `auto-fit minmax()`, which orphans
 * the dark arrival card alone on a second row at tablet widths.
 *
 * ## ⚠️ This content is `V0`
 *
 * It was supplied rather than read off a published transport record, and the
 * card set is deliberately ORIENTATION only — which gateway, which corridor,
 * which poblacion. No timetable, no fare, no operator schedule: those change
 * without notice, would each need their own citation, and the schema does not
 * carry them. A traveller planning around a specific departure needs the
 * terminal, not this page.
 *
 * The level is not surfaced per card. Unlike the emergency hotlines — where a
 * wrong number has a cost measured in someone's afternoon or worse — these are
 * general directions, and four "unconfirmed" labels on four orientation cards
 * would be noise that trains a reader to ignore the label everywhere it does
 * matter. It is recorded in the content file and on the register instead.
 */
export async function GettingHere() {
  const [t, locale, travel] = await Promise.all([
    getTranslations('gettingHere'),
    getLocale(),
    getTravelRoutes(),
  ]);

  const isFil = locale === 'fil';
  const text = (pair: { en: string; fil: string }) =>
    isFil ? pair.fil : pair.en;

  return (
    <Section
      id="getting-here"
      eyebrow={t('eyebrow')}
      heading={t('heading', { municipality: 'Tago' })}
      /*
       * `Section`'s default rhythm — a top pad and NO bottom one — and the
       * absence is deliberate.
       *
       * A `py` was tried here and made the seam below WORSE, not better:
       * `LocalConditions` brings its own `pt-14`, so the two stacked to 112px
       * while every real section seam on this page is 56px of padding either
       * side of a boundary. The map and the conditions card carry no visible
       * heading and read as a continuation of *Getting to Tago* rather than as
       * a new section, so the tighter seam is the correct one — it is the same
       * gap the travel cards sit at, not a section break.
       */
      className="page-measure"
      aside={
        <p className="max-w-xs text-base leading-relaxed text-ink-secondary">
          {text(travel.summary)}
        </p>
      }
    >
      <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {travel.cards.map(card => (
          <li key={card.kicker.en}>
            <article
              data-surface={card.surface === 'inverse' ? 'inverse' : undefined}
              className={cn(
                'h-full rounded-2xl border border-line p-6',
                // `hover:border-ink-link` is deliberately NOT branched on the
                // surface: inside `data-surface="inverse"` that token already
                // resolves to the accent, so the dark card picks up a gold edge
                // while the three light ones pick up the brand green — one
                // class, correct on both grounds.
                'motion-safe:transition-transform motion-safe:duration-300 hover:border-ink-link motion-safe:hover:-translate-y-1',
                card.surface === 'inverse'
                  ? 'bg-surface-inverse text-ink'
                  : 'bg-surface-raised'
              )}
            >
              {/* `ink-accent-strong`, not `ink-accent`: the latter is
                  documented display-only and fails contrast at this 11px size
                  on a raised surface. On an inverse surface both resolve to
                  the same accent step anyway. */}
              <p className="mb-3 text-2xs font-bold tracking-label text-ink-accent-strong uppercase">
                {text(card.kicker)}
              </p>
              <h3 className="mb-2.5 font-display text-lg leading-snug font-bold tracking-tight">
                {text(card.title)}
              </h3>
              <p className="text-sm leading-relaxed text-ink-secondary">
                {text(card.body)}
              </p>
            </article>
          </li>
        ))}
      </ul>
    </Section>
  );
}
