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
   */

  it('rejects a null fact with no entry explaining it', () => {
    const { landAreaKm2: _dropped, ...pending } = rawConfig.pending as Record<
      string,
      string
    > & { landAreaKm2?: string };
    void _dropped;

    const withoutEntry = {
      ...rawConfig,
      pending: Object.fromEntries(
        Object.entries(pending).filter(([key]) => key !== 'lgu.landAreaKm2')
      ),
    };

    const result = lguConfigSchema.safeParse(withoutEntry);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('lgu.landAreaKm2');
  });

  it('rejects an entry that no longer describes a gap', () => {
    // A register full of closed items stops being read, and then the open ones
    // stop being seen.
    const result = lguConfigSchema.safeParse({
      ...rawConfig,
      pending: {
        ...rawConfig.pending,
        'lgu.province':
          'This field has a value, so this entry is stale and should fail.',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a one-word excuse', () => {
    const result = lguConfigSchema.safeParse({
      ...rawConfig,
      pending: { ...rawConfig.pending, 'lgu.population': 'TODO' },
    });
    expect(result.success).toBe(false);
  });

  it('still lists every fact this project has not obtained', () => {
    // Not a snapshot — a floor. If this drops to zero the register is either
    // finished (celebrate) or has been quietly emptied (do not celebrate).
    expect(Object.keys(lguConfig.pending).length).toBeGreaterThan(10);
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
});
