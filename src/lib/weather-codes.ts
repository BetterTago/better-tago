/**
 * WMO weather codes → a translation key in the `weather.conditions` namespace.
 *
 * The codes are a World Meteorological Organization standard rather than a
 * vendor vocabulary, which is the reason this mapping is auditable at all: a
 * reader can check `61` against the published table and see that "Light rain"
 * is a fair rendering of it.
 *
 * ## Two labels depart from the standard gloss, deliberately
 *
 * Both departures exist because this is a civic portal in a typhoon-exposed
 * coastal municipality, and a severity word beside a temperature is read as an
 * official severity term:
 *
 * · **82** is glossed *"violent rain showers"*. Published here as **heavy** rain
 *   showers. "Violent" is the vocabulary of a warning, and this widget has no
 *   authority to issue one.
 * · **95** is glossed *"thunderstorm, slight or moderate"*. Published here as
 *   **thunderstorms**, unqualified — the qualifier adds nothing a reader can act
 *   on and invites exactly the misreading `TAGO-115` exists to prevent.
 *
 * Neither is a translation decision, so neither belongs in `messages/`. They are
 * recorded here, next to the mapping they change.
 *
 * ## Ten of these cannot happen in Tago, and are mapped anyway
 *
 * Snow and freezing codes (56, 57, 66, 67, 71, 73, 75, 77, 85, 86) will not
 * occur at 9°N at sea level. They are mapped and translated regardless, because
 * the alternative is a code path that renders nothing on a value the upstream is
 * documented to be able to return — and "it can't happen here" is how a blank
 * ends up on a page.
 */

/** Every code Open-Meteo documents. The `unknown` key covers everything else. */
const CONDITION_KEYS: Readonly<Record<number, string>> = {
  0: 'clearSky',
  1: 'mainlyClear',
  2: 'partlyCloudy',
  3: 'overcast',
  45: 'fog',
  48: 'freezingFog',
  51: 'lightDrizzle',
  53: 'drizzle',
  55: 'heavyDrizzle',
  56: 'lightFreezingDrizzle',
  57: 'freezingDrizzle',
  61: 'lightRain',
  63: 'rain',
  65: 'heavyRain',
  66: 'lightFreezingRain',
  67: 'freezingRain',
  71: 'lightSnow',
  73: 'snow',
  75: 'heavySnow',
  77: 'snowGrains',
  80: 'lightRainShowers',
  81: 'rainShowers',
  // NOT "violent" — see the note above.
  82: 'heavyRainShowers',
  85: 'lightSnowShowers',
  86: 'snowShowers',
  // No severity adjective — see the note above.
  95: 'thunderstorms',
  96: 'thunderstormsWithHail',
  99: 'thunderstormsWithHeavyHail',
};

/** The codes this module knows, for the test that proves the set is complete. */
export const KNOWN_WEATHER_CODES: readonly number[] =
  Object.keys(CONDITION_KEYS).map(Number);

/**
 * The `weather.conditions.*` key for a code — **never an empty string.**
 *
 * An unrecognised code returns `unknown`, whose label says so in the reader's
 * own language. A blank where a condition should be is worse than an admission
 * that the portal does not recognise what it was told: the first looks like a
 * rendering bug and the second is a fact.
 */
export function conditionKey(code: number): string {
  return CONDITION_KEYS[code] ?? 'unknown';
}
