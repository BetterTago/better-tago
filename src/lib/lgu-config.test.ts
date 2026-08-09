import { describe, expect, it } from 'vitest';
import rawConfig from '../../config/lgu.config.json';
import { lguConfig, lguConfigSchema } from './lgu-config';

describe('the shipped config', () => {
  it('parses', () => {
    expect(lguConfig.portal.name).toBe('BetterTago');
    expect(lguConfig.lgu.type).toBe('municipality');
  });

  it('cannot claim affiliation', () => {
    // `independent` is a literal, not a boolean. There is no value of this
    // field that lets the portal stop saying it is independent.
    const result = lguConfigSchema.safeParse({
      ...rawConfig,
      portal: { ...rawConfig.portal, independent: false },
    });
    expect(result.success).toBe(false);
  });
});

describe('the gap register', () => {
  /*
   * These are the tests that make the honesty rule enforceable rather than
   * aspirational. Most municipal facts about Tago are not published anywhere
   * this project can cite, and the failure mode is not a missing page — it is
   * a plausible invented figure that looks complete and is false.
   *
   * Every doctored fixture below starts from a WELL-FORMED entry and breaks
   * exactly one thing. That matters more than it looks: when these entries were
   * bare strings, three of these tests passed because a string is not an object
   * — they were green against the shape, not against the rule they name.
   */

  /** A structurally valid entry. Each test below breaks one field of it. */
  const validEntry = {
    note: 'A real sentence saying what is missing and what would close it.',
    channel: 'national-agency',
    state: 'open',
    lastCheckedAt: '2026-08-09',
  };

  const withPending = (pending: Record<string, unknown>) =>
    lguConfigSchema.safeParse({ ...rawConfig, pending });

  it('rejects a null fact with no entry explaining it', () => {
    const result = withPending(
      Object.fromEntries(
        Object.entries(rawConfig.pending).filter(
          ([key]) => key !== 'lgu.landAreaKm2'
        )
      )
    );

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('lgu.landAreaKm2');
  });

  it('rejects an entry that no longer describes a gap', () => {
    // A register full of closed items stops being read, and then the open ones
    // stop being seen. `lgu.province` has a value, so an entry for it is stale.
    const result = withPending({
      ...rawConfig.pending,
      'lgu.province': validEntry,
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('lgu.province');
  });

  it('rejects a one-word excuse', () => {
    // The 40-character floor. `"TODO"` cannot close a gap.
    const result = withPending({
      ...rawConfig.pending,
      'lgu.population': { ...validEntry, note: 'TODO' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an entry with no check date', () => {
    // The defect this shape was introduced to fix: every date in this register
    // used to be inherited from a document rather than made by a person, and
    // the old shape had nowhere to put one, so nothing could tell.
    const { lastCheckedAt: _dropped, ...undated } = validEntry;
    void _dropped;

    expect(
      withPending({ ...rawConfig.pending, 'lgu.population': undated }).success
    ).toBe(false);
  });

  it('rejects a free-text check date', () => {
    expect(
      withPending({
        ...rawConfig.pending,
        'lgu.population': { ...validEntry, lastCheckedAt: 'August 2026' },
      }).success
    ).toBe(false);
  });

  it('rejects a channel that is not one of the ways a gap actually closes', () => {
    expect(
      withPending({
        ...rawConfig.pending,
        'lgu.population': { ...validEntry, channel: 'somebody-will-know' },
      }).success
    ).toBe(false);
  });

  it('rejects a written request as a channel, because that lane is retired', () => {
    // No request is being sent to any office. An entry claiming a letter will
    // close it would be false the day it was written, and re-opening that lane
    // is a deliberate decision rather than a word somebody types.
    expect(
      withPending({
        ...rawConfig.pending,
        'lgu.population': { ...validEntry, channel: 'written-request' },
      }).success
    ).toBe(false);
  });

  it('separates a gap that is held from one that is merely open', () => {
    // The postal code is not missing — it is obtained and deliberately not
    // published. Those are different absences and must not read as one.
    expect(lguConfig.pending['lgu.postalCode'].state).toBe('held');
    expect(lguConfig.lgu.postalCode).toBeNull();
  });

  it('still lists every fact this project has not obtained', () => {
    // Not a snapshot — a floor. If this drops to zero the register is either
    // finished (celebrate) or has been quietly emptied (do not celebrate).
    expect(Object.keys(lguConfig.pending).length).toBeGreaterThan(10);
  });

  it('carries a real check date on every entry', () => {
    const undated = Object.entries(lguConfig.pending)
      .filter(([, entry]) => !/^\d{4}-\d{2}-\d{2}$/.test(entry.lastCheckedAt))
      .map(([key]) => key);
    expect(undated).toEqual([]);
  });
});

describe('the emergency block', () => {
  it('publishes no municipal hotline until one has been obtained', () => {
    // The proposal's single most important request. A number sitting here with
    // status 'not-obtained' would mean somebody invented it or borrowed a
    // neighbouring municipality's — the most dangerous failure mode available.
    if (lguConfig.emergency.status === 'not-obtained') {
      expect(lguConfig.emergency.municipalHotlines).toEqual([]);
    }
  });

  it('requires every hotline to carry a source and a check date', () => {
    const result = lguConfigSchema.safeParse({
      ...rawConfig,
      emergency: {
        ...rawConfig.emergency,
        status: 'obtained',
        municipalHotlines: [{ label: 'MDRRMO', number: '086-000-0000' }],
      },
    });
    expect(result.success).toBe(false);
  });

  it('treats an empty hotline list as a registered gap', () => {
    /*
     * `nullPaths` does not descend arrays — correctly, or every element would
     * become a registered path. The consequence was that the LARGEST gap in
     * this record was the one the register structurally could not hold: a
     * coastal municipality with no findable local emergency number.
     */
    const result = lguConfigSchema.safeParse({
      ...rawConfig,
      pending: Object.fromEntries(
        Object.entries(rawConfig.pending).filter(
          ([key]) => key !== 'emergency.municipalHotlines'
        )
      ),
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(
      'emergency.municipalHotlines'
    );
  });

  it('makes that entry stale the moment a hotline is recorded', () => {
    // The other direction, and the one that rots quietly: numbers arrive, and
    // the register goes on saying they are missing.
    const result = lguConfigSchema.safeParse({
      ...rawConfig,
      emergency: {
        ...rawConfig.emergency,
        status: 'obtained',
        municipalHotlines: [
          {
            label: 'Municipal Disaster Risk Reduction and Management Office',
            number: '086-000-0000',
            hours: 'not stated',
            verification: 'V2',
            source: {
              label: 'Fixture, not a real source',
              url: 'https://example.org/fixture',
              checkedAt: '2026-08-09',
            },
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(
      'emergency.municipalHotlines'
    );
  });

  it('records where a municipal number was looked for', () => {
    // The gap is the published content, and a gap with no record of the looking
    // is indistinguishable from nobody having looked.
    const { sourcesChecked } = lguConfig.emergency;
    expect(sourcesChecked.length).toBeGreaterThanOrEqual(3);
    expect(sourcesChecked.map(source => source.url)).toContain(
      'https://tago.gov.ph/contact-us/'
    );
    expect(lguConfig.emergency.recheckDays).toBe(90);
  });
});

/**
 * CONT-302 · CONT-304 — the mirror of the gap register.
 *
 * `pending` made every null account for itself. Nothing made a FILLED figure
 * do the same, so the moment one was obtained it became an unsourced
 * assertion — which is what `lgu.history` had quietly been since Wave 2, six
 * facts with no source and no check date.
 */
describe('an obtained figure carries its source', () => {
  it('is sourced for every tracked figure that has a value', () => {
    // Today exactly one: the income class, which the municipality states about
    // itself on its tourism page. Every other tracked figure is still null.
    expect(lguConfig.lgu.incomeClass).toBe('2nd class');
    expect(lguConfig.lgu.sources.incomeClass?.url).toBe(
      'https://tago.gov.ph/about-us-2/tourism/'
    );
    expect(lguConfig.lgu.sources.incomeClass?.checkedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
  });

  it('rejects a figure that was filled without a citation', () => {
    // THE regression. A value arrives, nobody records where from, and the
    // register still reads as complete because the null is gone.
    const result = lguConfigSchema.safeParse({
      ...rawConfig,
      lgu: { ...rawConfig.lgu, sources: {} },
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('incomeClass');
  });

  it('rejects a citation for a figure this project does not hold', () => {
    // The other direction: a source left behind after a value was withdrawn
    // reads, to anyone rendering it, as though the fact were still held.
    const result = lguConfigSchema.safeParse({
      ...rawConfig,
      lgu: { ...rawConfig.lgu, incomeClass: null },
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('incomeClass');
  });

  it('rejects a source that names no tracked figure', () => {
    const result = lguConfigSchema.safeParse({
      ...rawConfig,
      lgu: {
        ...rawConfig.lgu,
        sources: {
          ...rawConfig.lgu.sources,
          somethingElse: {
            label: 'Fixture, not a real source',
            url: 'https://example.org/fixture',
            checkedAt: '2026-08-09',
            note: 'A note long enough to clear the forty-character floor imposed on these.',
          },
        },
      },
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('somethingElse');
  });

  it('keeps the postal code held rather than sourced', () => {
    // It is the one figure this project HAS seen and deliberately does not
    // publish. Sourcing it would be the wrong kind of closing.
    expect(lguConfig.lgu.postalCode).toBeNull();
    expect(lguConfig.lgu.sources.postalCode).toBeUndefined();
    expect(lguConfig.pending['lgu.postalCode']?.state).toBe('held');
  });
});

describe('the history block', () => {
  it('cites the page every one of its facts comes from', () => {
    // Six municipal facts sat here unsourced until 2026-08-09. CONT-304 c3.
    expect(lguConfig.lgu.history.source.url).toBe(
      'https://tago.gov.ph/about-us-2/history/'
    );
    expect(lguConfig.lgu.history.townConversionInstrument).toBe(
      'Executive Order No. 41'
    );
  });

  it('rejects the block with its citation removed', () => {
    const unsourced: Record<string, unknown> = { ...rawConfig.lgu.history };
    delete unsourced.source;
    const result = lguConfigSchema.safeParse({
      ...rawConfig,
      lgu: { ...rawConfig.lgu, history: unsourced },
    });
    expect(result.success).toBe(false);
  });
});
