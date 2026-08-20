import { MapPin } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ConditionsCard } from '@/components/home/ConditionsCard';
import { HallMap } from '@/components/home/HallMap';
import { getAdvisory } from '@/lib/advisory';
import { lguConfig } from '@/lib/lgu-config';
import { getWeather } from '@/lib/weather';

/**
 * The local-conditions panel: the map, then the weather. `TAGO-117` · `TAGO-115`.
 *
 * ## 🔴 The map leads, and that is a decision rather than a layout
 *
 * The reference portal puts its weather card first. This one does not, because
 * **a resident opening this section is far more often asking *where is the
 * municipal hall* than *what is the temperature*.** The address, the pin and
 * the route are the actionable half; the weather is context beside them. It
 * also puts the least authoritative thing on the page in the secondary
 * position, which is where it belongs.
 *
 * ## Two rules this component owns, which the card cannot
 *
 * **1. It is NOT in the layout stack above the header.** That stack is
 * `HotlineTicker` → `AdvisoryBar` and it carries this portal's emergency
 * meaning. A forecast strip placed in or beside it inherits that meaning
 * whatever the caption says — which is why this mounts in the page body from
 * `page.tsx`, and why it must not be promoted into `[locale]/layout.tsx`. Doing
 * so would also put a third-party tile request on ~380 routes.
 *
 * **2. The weather card disappears while a real advisory is live.** One
 * authority on screen at a time. The moment a reader is most likely to look at
 * a temperature is the moment it is most likely to be misread, so at that
 * moment it is not there. **The map stays** — an advisory is a reason to know
 * where the hall is, not a reason to hide it.
 *
 * ## What a reader with JavaScript off gets
 *
 * The whole section except the tiles: the heading, the address, the directions
 * link, the weather card, the attributions. `HallMap` renders an empty
 * container and everything that answers *where is the hall* sits outside it,
 * deliberately — this portal works without scripting and a grey box where a map
 * should be is not an acceptable answer to that.
 */
export async function LocalConditions() {
  const [t, advisory, reading] = await Promise.all([
    getTranslations('conditions'),
    getAdvisory(),
    getWeather(),
  ]);

  const { coordinates, shortName } = lguConfig.lgu;
  const hall = lguConfig.contact.municipalHall;

  /*
   * No coordinates means no map AND no weather query point — the whole panel
   * has nothing to stand on. It renders nothing rather than a gap notice: that
   * absence is a municipal fact, `/gaps` accounts for it through the register,
   * and restating it here as a widget failure would tell a reader the wrong
   * thing about both.
   */
  if (!coordinates) return null;

  const mapLabel = t('mapLabel', { place: shortName });

  return (
    /*
     * 🔴 No visible eyebrow or heading, by instruction on 2026-08-20 — every
     * other section on this page carries the numbered `Section` chrome and this
     * one deliberately does not. The map and the card are self-describing;
     * a title above them was furniture.
     *
     * The heading is kept `sr-only` rather than deleted. It is what names this
     * landmark for a screen reader, and removing it would leave a region a
     * reader can reach and cannot identify — a different and worse thing than
     * the visual noise the instruction was about. `services.a11y.spec.ts`
     * also asserts headings never skip a level, which an unnamed region would
     * not satisfy.
     */
    <section
      id="local-conditions"
      aria-labelledby="local-conditions-heading"
      className="page-measure scroll-mt-24 pt-14 sm:pt-16"
    >
      <h2 id="local-conditions-heading" className="sr-only">
        {t('heading', { place: shortName })}
      </h2>

      <div className="grid gap-6 md:grid-cols-5">
        {/* The map leads, and takes the wider column. */}
        <div className="flex flex-col gap-3 md:col-span-3">
          <HallMap
            latitude={coordinates.latitude}
            longitude={coordinates.longitude}
            label={mapLabel}
          />

          {/*
            OUTSIDE the map container on purpose. This is what a reader with
            scripting off, or a failed tile load, still gets — and it is the
            part that actually answers the question. The map is orientation;
            this link is the action.
          */}
          <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-secondary">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              {hall.name}, {hall.address}
              {hall.mapUrl && (
                <>
                  {' · '}
                  <a
                    href={hall.mapUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                    className="text-ink-link underline underline-offset-2 hover:text-ink-link-hover"
                  >
                    {t('directions')}
                  </a>
                </>
              )}
            </span>
          </p>
        </div>

        <div className="md:col-span-2">
          {/*
            Rule 2. The advisory bar is the authority while one is live; a calm
            temperature beside a storm notice is the misreading this whole
            design exists to prevent.
          */}
          {!advisory && reading && <ConditionsCard reading={reading} />}

          {!advisory && !reading && (
            <div className="flex min-h-20 flex-col justify-center rounded-lg border border-dashed border-line-control bg-surface-sunken p-5">
              <p className="text-sm leading-relaxed text-ink-secondary">
                {t('weatherUnavailable')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/*
        Every attribution and every caveat this panel owes, in one line under
        both columns.

        🔴 `tileNotice` is not boilerplate. Until this panel shipped, this portal
        made NO third-party request from a reader's browser at all; the map
        changes that, and a reader is told so where they can see it rather than
        in a policy nobody opens.
      */}
      {/* Full width, under both columns — by instruction. It carries the
          weather's provenance AND the map's licence, and both belong to the
          panel rather than to either half of it, so it is not constrained to a
          prose measure. */}
      <p className="mt-5 w-full text-xs leading-relaxed text-ink-tertiary">
        {/* `observedAt` is deliberately NOT here any more — the reading's time
            moved onto the card itself ("Overcast at 10:45 PM"), beside the
            figure it qualifies. Repeating it here read as two different
            timestamps for the same reading. */}
        {reading && !advisory && (
          <>
            {t.rich('weatherAttribution', {
              source: chunks => (
                <a
                  href="https://open-meteo.com/"
                  rel="noopener noreferrer"
                  target="_blank"
                  className="underline underline-offset-2 hover:text-ink-link-hover"
                >
                  {chunks}
                </a>
              ),
            })}{' '}
            {t('notAdvisory')}{' '}
          </>
        )}
        {t.rich('mapAttribution', {
          source: chunks => (
            <a
              href="https://www.openstreetmap.org/copyright"
              rel="noopener noreferrer"
              target="_blank"
              className="underline underline-offset-2 hover:text-ink-link-hover"
            >
              {chunks}
            </a>
          ),
        })}{' '}
        {t('tileNotice')}
      </p>
    </section>
  );
}
