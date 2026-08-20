import {
  CircleHelp,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  Droplets,
  MapPin,
  Sun,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { TIME_OF_DAY } from '@/lib/dates';
import { lguConfig } from '@/lib/lgu-config';
import { conditionKey } from '@/lib/weather-codes';
import type { WeatherReading } from '@/lib/weather';

/**
 * The weather half of the local-conditions panel. `TAGO-115`.
 *
 * 🔴 **The editorial risk here is not technical.** It publishes forecast-model
 * output on a civic site in a municipality that faces the Pacific. A resident
 * who reads it as a national weather-service bulletin has been misled by this
 * project, and during a typhoon that is not a small thing. Four of the six
 * rules that prevent that live here; placement and advisory-suppression are
 * enforced by `LocalConditions`, which owns where this sits and whether it
 * renders at all.
 *
 * **1. No severity vocabulary, in either language.** No warning, alert,
 * advisory, signal, severe, danger or emergency — asserted across the whole
 * `weather` namespace in both catalogues by a unit test, not by review.
 *
 * **2. No severity colour and no hazard mark.** The `error-*` ramp is the
 * hotline bar's and `TriangleAlert` is its icon; neither appears here. Code 95
 * gets the same ink as code 0.
 *
 * **3. 🔴 Wind is NEVER styled by magnitude.** It was excluded from the
 * original design precisely because it is the field most readily misread as a
 * storm signal, and it ships by instruction with that mitigation attached:
 * there is no threshold, no colour change, no emphasis above some value.
 * 60 km/h renders exactly like 6 km/h. **The moment a number changes appearance
 * as it rises, this widget is issuing a warning it has no authority to issue.**
 * Do not add a "strong wind" state here.
 *
 * **4. It names its source, its time, and what it is not** — always, inline,
 * never behind a disclosure. Every other figure in this portal carries a source
 * and a date; so does this, even though it is not a civic fact.
 */

/**
 * Condition key → mark. Grouped rather than one glyph per code: a reader tells
 * rain from drizzle by the WORD, and twenty-eight marks would be twenty-eight
 * chances to imply a severity the label does not carry.
 */
const MARKS: Readonly<Record<string, LucideIcon>> = {
  clearSky: Sun,
  mainlyClear: CloudSun,
  partlyCloudy: CloudSun,
  overcast: Cloudy,
  fog: CloudFog,
  freezingFog: CloudFog,
  lightDrizzle: CloudDrizzle,
  drizzle: CloudDrizzle,
  heavyDrizzle: CloudDrizzle,
  lightFreezingDrizzle: CloudDrizzle,
  freezingDrizzle: CloudDrizzle,
  lightRain: CloudRain,
  rain: CloudRain,
  heavyRain: CloudRain,
  lightFreezingRain: CloudRain,
  freezingRain: CloudRain,
  lightSnow: CloudSnow,
  snow: CloudSnow,
  heavySnow: CloudSnow,
  snowGrains: CloudSnow,
  lightRainShowers: CloudRain,
  rainShowers: CloudRain,
  heavyRainShowers: CloudRain,
  lightSnowShowers: CloudSnow,
  snowShowers: CloudSnow,
  thunderstorms: CloudLightning,
  thunderstormsWithHail: CloudLightning,
  thunderstormsWithHeavyHail: CloudLightning,
};

/**
 * The mark for a WMO code, as a COMPONENT declared at module scope.
 *
 * 🔴 Not `const Mark = markFor(code)` inside the render. `HotlineTicker` records
 * the same lesson from its own history: a component created during render is a
 * new type on every pass, so React throws the subtree's state away — and
 * `react-hooks/static-components` fails the lint on it, which is how this was
 * caught rather than shipped.
 */
function ConditionMark({
  code,
  className,
}: {
  code: number;
  className: string;
}) {
  const Mark: LucideIcon = MARKS[conditionKey(code)] ?? CircleHelp;
  return <Mark aria-hidden="true" className={className} />;
}

export async function ConditionsCard({ reading }: { reading: WeatherReading }) {
  const [t, format] = await Promise.all([
    getTranslations('weather'),
    getFormatter(),
  ]);

  const key = conditionKey(reading.weatherCode);
  const { shortName, province } = lguConfig.lgu;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-5 sm:p-6">
      {/* Row 1 — the mark carries the row on the left, the three labels stack
          to its right. The icon is sized to the block of text beside it rather
          than to the temperature alone, so the row reads as one unit. */}
      <div className="flex items-center gap-4">
        <ConditionMark
          code={reading.weatherCode}
          className="size-16 shrink-0 text-ink-link"
        />

        <div className="min-w-0">
          <p className="font-display text-4xl font-bold tabular-nums text-ink">
            {t('temperature', { degrees: reading.temperatureC })}
          </p>

          {/* The condition and the time it was taken, on one line. This is the
              provenance the panel owes for a figure a reader might act on, and
              it sits WITH the figure rather than in the footnote below. */}
          <p className="mt-0.5 font-semibold text-ink">
            {t.rich('conditionAt', {
              condition: t(`conditions.${key}`),
              /*
               * The zone is named by the message string, not the formatter —
               * next-intl accepts only `long` and `short` for `timeZoneName`,
               * and `short` renders "GMT+8", which is worse than nothing on a
               * municipal page. CLDR carries no abbreviation for Asia/Manila at
               * all, so "PHT" is supplied by the catalogue, where a translator
               * can see it beside the sentence it sits in.
               */
              time: format.dateTime(new Date(reading.observedAt), TIME_OF_DAY),
              zone: chunks => (
                /*
                 * De-emphasised by SIZE and colour, and sitting on the same
                 * baseline as the time it qualifies.
                 *
                 * It was `align-sub` first, which dropped it below the line and
                 * read as a stray footnote rather than as part of the sentence.
                 * Smaller text on a shared baseline is the whole effect that was
                 * wanted; the vertical offset was doing nothing but breaking the
                 * line it belongs to.
                 *
                 * No `<sub>` element either — that is semantically for
                 * mathematical and chemical notation, and a screen reader has no
                 * reason to treat a timezone that way. The gold is
                 * `--ink-accent-strong`, the same role the contact card's small
                 * bold label uses.
                 */
                <span className="align-baseline text-2xs font-semibold tracking-label text-ink-accent-strong">
                  {chunks}
                </span>
              ),
            })}
          </p>

          {/* The place is STATIC, from config. This widget is not geolocated and
              must never become so — a resident reading about Tago wants Tago. */}
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-secondary">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            {shortName}, {province}
          </p>
        </div>
      </div>

      {/* Humidity and wind. Both plain figures with a unit and no descriptor —
          see rule 3 above before adding any conditional styling here. */}
      <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-line-subtle pt-4 text-sm">
        <div className="flex items-center gap-2">
          <Droplets
            aria-hidden="true"
            className="size-4 shrink-0 text-ink-tertiary"
          />
          <dt className="sr-only">{t('humidityLabel')}</dt>
          <dd className="tabular-nums text-ink">
            {t('humidity', { percent: reading.humidity })}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <Wind
            aria-hidden="true"
            className="size-4 shrink-0 text-ink-tertiary"
          />
          <dt className="sr-only">{t('windLabel')}</dt>
          <dd className="tabular-nums text-ink">
            {t('wind', { kph: reading.windKph })}
          </dd>
        </div>
        {reading.rainChance !== null && (
          <div className="flex items-center gap-2">
            <CloudRain
              aria-hidden="true"
              className="size-4 shrink-0 text-ink-tertiary"
            />
            <dt className="sr-only">{t('rainChanceLabel')}</dt>
            <dd className="tabular-nums text-ink">
              {t('rainChance', { percent: reading.rainChance })}
            </dd>
          </div>
        )}
      </dl>

      {/* The short outlook. Absent entirely when the upstream gave nothing
          usable — two missing cells cost nothing, and an empty box would. */}
      {reading.outlook.length > 0 && (
        /* Row 3 — a fixed three-column grid rather than `flex-1` cells, so the
           columns stay equal when the outlook is short and the row does not
           re-proportion itself as hours drop off near midnight. */
        <ul className="grid grid-cols-3 gap-3">
          {reading.outlook.map(hour => (
            <li
              key={hour.at}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-lg bg-surface-sunken px-3 py-3"
            >
              <span className="text-xs tabular-nums text-ink-secondary">
                {format.dateTime(new Date(hour.at), TIME_OF_DAY)}
              </span>
              <ConditionMark
                code={hour.weatherCode}
                className="size-5 shrink-0 text-ink-tertiary"
              />
              <span className="font-display text-sm font-bold tabular-nums text-ink">
                {t('temperature', { degrees: hour.temperatureC })}
              </span>
              {/* The condition is in the accessible tree even though the cell
                    shows only a glyph — otherwise this reads as a bare number. */}
              <span className="sr-only">
                {t(`conditions.${conditionKey(hour.weatherCode)}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
