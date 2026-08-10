import { describe, expect, it } from 'vitest';
import rawConfig from '../../config/lgu.config.json';
import { GAP_PATHS, gapFor, lguConfig, lguConfigSchema } from './lgu-config';

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
    /*
     * `lgu.households` rather than `lgu.landAreaKm2`, which this used to
     * doctor: the land area was published on 2026-08-10, so removing its
     * (now absent) entry proved nothing and the doctored config parsed
     * cleanly — a guardrail that had quietly stopped guarding.
     *
     * The field chosen here has to be one that is genuinely still null.
     */
    expect(rawConfig.lgu.households).toBeNull();

    const result = withPending(
      Object.fromEntries(
        Object.entries(rawConfig.pending).filter(
          ([key]) => key !== 'lgu.households'
        )
      )
    );

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('lgu.households');
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
    /*
     * Not a snapshot — a floor. If this drops to zero the register is either
     * finished (celebrate) or has been quietly emptied (do not celebrate).
     *
     * It came down from thirteen to nine on 2026-08-10, when the population,
     * census year, barangay count and land area were closed at V1 through a
     * tertiary path. That is a real reduction and the floor moved with it —
     * but note what did NOT close: the PSGC record still answers HTTP 403 to
     * an automated request, so the per-barangay urban/rural classification,
     * the district and the postal code are all still open.
     */
    expect(Object.keys(lguConfig.pending).length).toBeGreaterThan(5);
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
        municipalHotlines: [{ label: 'MDRRMO', numbers: ['086-000-0000'] }],
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
     *
     * The real config CARRIES hotlines since 2026-08-10, so this now builds
     * the empty state as a fixture rather than reading it off the live record.
     * The rule it defends is unchanged and still worth defending: were the
     * numbers ever withdrawn, the register would have to account for them
     * again or the parse fails.
     */
    const result = lguConfigSchema.safeParse({
      ...rawConfig,
      emergency: {
        ...rawConfig.emergency,
        status: 'not-obtained',
        municipalHotlines: [],
      },
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
    /*
     * The other direction, and the one that rots quietly: numbers arrive, and
     * the register goes on saying they are missing.
     *
     * The entry is re-added to the fixture below because the live config no
     * longer has it — publishing the hotlines on 2026-08-10 deleted it, which
     * is this exact rule working.
     */
    const result = lguConfigSchema.safeParse({
      ...rawConfig,
      pending: {
        ...rawConfig.pending,
        'emergency.municipalHotlines': {
          note: 'A stale register entry, re-added by this fixture to prove the rule still fires.',
          channel: 'national-agency',
          state: 'open',
          lastCheckedAt: '2026-08-09',
        },
      },
      emergency: {
        ...rawConfig.emergency,
        status: 'obtained',
        municipalHotlines: [
          {
            label: 'Municipal Disaster Risk Reduction and Management Office',
            numbers: ['086-000-0000'],
            role: 'Fixture role',
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

describe('the register, as a surface reads it', () => {
  /*
   * The schema already proves the register and the nulls cannot drift apart.
   * This is the other half — the lookup a component uses, which is where a gap
   * stops being a rule and starts being something a resident reads.
   */

  it('offers every path the register carries, and no other', () => {
    expect([...GAP_PATHS].sort()).toEqual(
      Object.keys(rawConfig.pending).sort()
    );
  });

  it('hands back the register wording, not a paraphrase', () => {
    for (const path of GAP_PATHS) {
      const entry = gapFor(path);
      expect(entry.note).toBe(
        (rawConfig.pending as Record<string, { note: string }>)[path].note
      );
      // The 40-character floor is what stops "TODO" closing a gap; asserted
      // here too because this is the value that actually reaches a page.
      expect(entry.note.length).toBeGreaterThan(40);
    }
  });

  it('throws on a path the register does not carry', () => {
    /*
     * The union rejects a typo at compile time. This is the runtime half, for a
     * path that arrives from data rather than from a literal — and the point is
     * that it FAILS rather than rendering an empty block, because a gap nobody
     * can see is worse than no gap surface at all.
     */
    expect(() =>
      // @ts-expect-error — deliberately not a registered path.
      gapFor('lgu.populaton')
    ).toThrow(/no `pending` entry/);
  });

  it('names every unobtained fact a page might try to print', () => {
    // The ten tracked figures, the two contact details and the hotline list.
    // If a surface meets a null that is not here, `gapFor` cannot explain it —
    // and the config parse would already have failed.
    for (const path of [
      // Closed at V1 on 2026-08-10 and therefore NOT here any more: population,
      // censusYear, barangayCount, landAreaKm2. The schema enforces the swap in
      // both directions, so a value without a source or a source without a
      // value fails the parse rather than this list.
      'lgu.households',
      'lgu.psgc',
      'lgu.district',
      'lgu.postalCode',
      'lgu.coordinates',
      'contact.municipalHall.officeHours',
    ]) {
      expect(GAP_PATHS).toContain(path);
    }

    // And the mirror: a figure that now HAS a value must have left the
    // register, or a page would render a gap notice beside a number.
    for (const closed of [
      'lgu.population',
      'lgu.censusYear',
      'lgu.barangayCount',
      'lgu.landAreaKm2',
      // Closed 2026-08-10: a verified Google Maps pin, by instruction.
      'contact.municipalHall.mapUrl',
      // Closed 2026-08-10: six agencies read from the municipality's own
      // Facebook page. The largest gap this register ever held.
      'emergency.municipalHotlines',
    ]) {
      expect(GAP_PATHS).not.toContain(closed);
    }
  });
});
