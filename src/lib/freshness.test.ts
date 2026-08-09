import { describe, expect, it } from 'vitest';
import {
  DATA_CLASSES,
  cadenceOf,
  daysBetween,
  freshnessConfig,
  freshnessOf,
  isDataClass,
  triggersFor,
} from './freshness';

/**
 * ★ TAGO-401 — the staleness computation.
 *
 * ⚠️ Every page in this repository was checked on the same day, so **nothing
 * is stale and the report is empty**. That is honest and useless as evidence:
 * a computation only ever handed fresh input has not been shown to detect
 * anything. So every case below is a DOCTORED date.
 */
describe('the cadence configuration', () => {
  it('declares a cadence, a reason and at least one trigger for every class', () => {
    expect(DATA_CLASSES.length).toBeGreaterThanOrEqual(5);
    for (const name of DATA_CLASSES) {
      expect(cadenceOf(name), name).toBeGreaterThan(0);
      expect(triggersFor(name).length, name).toBeGreaterThan(0);
      expect(freshnessConfig.classes[name]?.why.length, name).toBeGreaterThan(
        20
      );
    }
  });

  it('keeps emergency the shortest cadence of all', () => {
    // Not a style point. It is the one class allowed to ship unconfirmed, and
    // the 90-day re-check is the price of that — docs/governance.md.
    expect(cadenceOf('emergency')).toBe(90);
    for (const name of DATA_CLASSES) {
      expect(cadenceOf(name), name).toBeGreaterThanOrEqual(90);
    }
  });

  it('recognises exactly the declared classes', () => {
    expect(isDataClass('emergency')).toBe(true);
    expect(isDataClass('whenever')).toBe(false);
    expect(isDataClass(null)).toBe(false);
  });
});

describe('the computation', () => {
  it('counts days across a month and a year boundary', () => {
    expect(daysBetween('2026-08-09', '2026-08-09')).toBe(0);
    expect(daysBetween('2026-08-09', '2026-09-08')).toBe(30);
    expect(daysBetween('2025-08-09', '2026-08-09')).toBe(365);
  });

  it('calls a page fresh inside its cadence', () => {
    expect(freshnessOf('emergency', '2026-08-09', '2026-08-09')).toBe('fresh');
    expect(freshnessOf('emergency', '2026-08-09', '2026-09-08')).toBe('fresh');
  });

  it('warns before a reader would ever see a stale page', () => {
    // `due` exists so a review can be scheduled rather than discovered.
    expect(freshnessOf('emergency', '2026-01-01', '2026-03-27')).toBe('due');
  });

  it('calls a page stale past its cadence', () => {
    // 91 days in the emergency class.
    expect(freshnessOf('emergency', '2026-01-01', '2026-04-03')).toBe('stale');
    // 400 days in an annual class.
    expect(freshnessOf('charter-derived', '2025-01-01', '2026-02-05')).toBe(
      'stale'
    );
  });

  it('treats a future check date as a defect, not a degree of freshness', () => {
    // A check date later than today is not something a real check produces.
    expect(freshnessOf('offices', '2027-01-01', '2026-08-09')).toBe('undated');
  });

  it('lets an immediate trigger force a class stale ahead of cadence', () => {
    // ★ criterion 3, and charter-diff is its first real caller: a document
    // whose checksum moved makes its pages stale that day, not next year.
    expect(
      freshnessOf('charter-derived', '2026-08-09', '2026-08-09', [
        'charter-derived',
      ])
    ).toBe('stale');
    expect(
      freshnessOf('emergency', '2026-08-09', '2026-08-09', ['charter-derived'])
    ).toBe('fresh');
  });

  it('🔴 refuses an undeclared class rather than defaulting', () => {
    /*
     * The whole ticket. A page that quietly never goes stale is the failure
     * this exists to close, and a permissive default is exactly how it would
     * happen — silently, and only visible years later.
     */
    expect(() => freshnessOf('whenever', '2026-08-09', '2026-08-09')).toThrow(
      /unknown data class/
    );
    expect(() => cadenceOf('whenever')).toThrow();
    expect(() => triggersFor('whenever')).toThrow();
  });

  it('refuses a date it cannot parse rather than guessing at one', () => {
    expect(() => freshnessOf('emergency', 'last August', '2026-08-09')).toThrow(
      /not an ISO date/
    );
  });
});
