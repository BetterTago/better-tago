import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

/**
 * The task-title vocabulary, enforced.
 *
 * `docs/task-titles.md` writes the rules down; this file is what makes them
 * true. The rule that matters most — A TITLE MAY NOT NAME AN OFFICE — is
 * exactly the kind that review keeps letting through, because whoever writes a
 * page has the office's own PDF open in front of them and the office's words
 * are the nearest ones to hand.
 *
 * Nothing here reads `content/`. The vocabulary is a work list, not a page, and
 * these are plain YAML reads with no Next runtime involved.
 */

const ROOT = process.cwd();

type Office = {
  verbatim: string;
  canonical: string | null;
  note: string | null;
};

type Entry = {
  id: string;
  section: 'external' | 'internal' | 'unknown';
  charterTitle: string | null;
  charterTitleSource: string;
  taskTitle: string | null;
  slug: string | null;
  office: { verbatim: string; canonical: string | null };
  excluded: string | null;
  answers: string | null;
  notes: string | null;
};

type Group = { id: string; question: string; members: string[]; note: string };

type Vocabulary = {
  coverage: Record<string, number>;
  namingRules: {
    imperativeVerbs: string[];
    residentAcronyms: Record<string, string>;
    forbiddenInTitles: string[];
    roleExceptions: Record<string, string>;
  };
  offices: Office[];
  groups: Group[];
  services: Entry[];
};

type InventoryService = {
  id: string;
  section: string;
  title: string | null;
  office: string;
};

const read = <T>(file: string): T =>
  yaml.load(readFileSync(path.join(ROOT, 'inventory', file), 'utf8')) as T;

const vocabulary = read<Vocabulary>('task-vocabulary.yaml');
const inventory = read<{ services: InventoryService[] }>(
  'charter-services.yaml'
);

const entries = vocabulary.services;
const external = entries.filter(entry => entry.section === 'external');
const internal = entries.filter(entry => entry.section === 'internal');
const rules = vocabulary.namingRules;

/** Every title, lowercased once — most checks below are case-insensitive. */
const titles = external.map(entry => ({
  id: entry.id,
  title: entry.taskTitle as string,
}));

const slugOf = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

describe('the scan itself', () => {
  /*
   * Without this, a renamed file or a changed shape turns every assertion below
   * into a green no-op — which is worse than no test, because it looks like
   * somebody checked 167 services.
   */
  it('is actually reading both files', () => {
    expect(inventory.services.length).toBeGreaterThan(100);
    expect(entries.length).toBeGreaterThan(100);
    expect(vocabulary.offices.length).toBeGreaterThan(20);
    expect(rules.imperativeVerbs.length).toBeGreaterThan(5);
  });
});

describe('coverage — no service is unaccounted for', () => {
  it('has exactly one entry per enumerated service', () => {
    const inventoryIds = inventory.services.map(service => service.id).sort();
    const entryIds = entries.map(entry => entry.id).sort();
    expect(entryIds).toEqual(inventoryIds);
  });

  it('names no service the inventory does not have', () => {
    const known = new Set(inventory.services.map(service => service.id));
    expect(
      entries.filter(entry => !known.has(entry.id)).map(e => e.id)
    ).toEqual([]);
  });

  it('gives every external service a task title', () => {
    expect(
      external.filter(entry => !entry.taskTitle?.trim()).map(entry => entry.id)
    ).toEqual([]);
  });

  it('records the section the inventory recorded', () => {
    const sections = new Map(
      inventory.services.map(service => [service.id, service.section])
    );
    expect(
      entries
        .filter(entry => sections.get(entry.id) !== entry.section)
        .map(entry => entry.id)
    ).toEqual([]);
  });
});

describe('internal services are excluded, not titled', () => {
  /*
   * Every charter covers external services, which a resident can ask for, and
   * internal ones, which are government-to-government. Publishing an internal
   * service as a resident task sends somebody to a counter for something they
   * cannot request — a wasted trip caused by this project, not by the office.
   */
  it('gives no internal service a task title', () => {
    expect(
      internal.filter(entry => entry.taskTitle !== null).map(entry => entry.id)
    ).toEqual([]);
  });

  it('states a reason for every one of them, rather than leaving it blank', () => {
    // Silence and a decision look identical afterwards. Only one of them is one.
    expect(
      internal.filter(entry => !entry.excluded?.trim()).map(entry => entry.id)
    ).toEqual([]);
  });

  it('excludes no external service', () => {
    expect(
      external.filter(entry => entry.excluded !== null).map(entry => entry.id)
    ).toEqual([]);
  });
});

describe('rule 2 — a title never names an office', () => {
  /*
   * THE rule. A resident does not know which office does the thing; not knowing
   * is why they came. A title that leads with the office answers a question
   * nobody asked and buries the one they did.
   */
  const forbidden = rules.forbiddenInTitles.map(
    token =>
      new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  );

  const offenders = (title: string): string[] =>
    rules.forbiddenInTitles.filter((_, index) => forbidden[index].test(title));

  it('fires on a doctored title', () => {
    // A guardrail that has never gone red is not known to work.
    expect(
      offenders('Get a permit from the Municipal Health Office')
    ).not.toEqual([]);
    expect(offenders('Apply at the Business Licensing Division')).not.toEqual(
      []
    );
  });

  it('does not fire on a correctly-written title', () => {
    expect(offenders('Renew a business permit')).toEqual([]);
  });

  it('holds for every title in the vocabulary', () => {
    const found = titles
      .filter(entry => offenders(entry.title).length > 0)
      .map(entry => `${entry.id} → "${entry.title}"`);
    expect(found).toEqual([]);
  });

  it('is documented in full, in the file a contributor actually reads', () => {
    /*
     * `docs/task-titles.md` is where somebody looks up the rule; this YAML is
     * what enforces it. Prose that lists five of fourteen tokens reads as
     * complete and is not — the doc said "Office, Division, Bureau, Department,
     * Unit" while the build also rejected Municipal, Municipality, Sangguniang
     * and the office acronyms, so a contributor could follow the documentation
     * exactly and still be surprised by a red build.
     *
     * Compared as a SET, in both directions: a token missing from the doc
     * under-states the rule, and a token listed there but no longer enforced
     * claims a rule the build does not back.
     */
    const doc = readFileSync(path.join(ROOT, 'docs', 'task-titles.md'), 'utf8');

    const paragraph = doc
      .split('**The enforced list, in full**')[1]
      ?.split('\n\n')[1];

    // Anchored on a marker this doc owns. If the section is renamed, this fails
    // loudly rather than quietly checking an empty string.
    expect(paragraph).toBeTruthy();

    const documented = [...(paragraph ?? '').matchAll(/`([^`]+)`/g)].map(
      match => match[1].toLowerCase()
    );

    expect(documented.sort()).toEqual(
      [...rules.forbiddenInTitles].map(token => token.toLowerCase()).sort()
    );
  });
});

describe('rule 1 — verb first, imperative', () => {
  const permitted = new Set(rules.imperativeVerbs);

  it('starts every title with a permitted verb', () => {
    const found = titles
      .filter(entry => !permitted.has(entry.title.split(/\s+/)[0]))
      .map(entry => `${entry.id} → "${entry.title}"`);
    expect(found).toEqual([]);
  });

  it('rejects a noun-phrase title', () => {
    expect(permitted.has('Processing')).toBe(false);
    expect(permitted.has('Issuance')).toBe(false);
    expect(permitted.has('Securing')).toBe(false);
  });
});

describe('rule 3 — no acronym a resident would not recognise', () => {
  const declared = new Set(Object.keys(rules.residentAcronyms));
  const acronymsIn = (title: string): string[] =>
    (title.match(/\b[A-Z]{2,}\b/g) ?? []).filter(found => !declared.has(found));

  it('fires on an undeclared acronym', () => {
    expect(acronymsIn('Pay the annual MTOP fees')).toEqual(['MTOP']);
  });

  it('permits a declared one', () => {
    expect(acronymsIn('Get a PSA copy of a birth certificate')).toEqual([]);
  });

  it('holds for every title', () => {
    const found = titles
      .filter(entry => acronymsIn(entry.title).length > 0)
      .map(entry => `${entry.id} → ${acronymsIn(entry.title).join(', ')}`);
    expect(found).toEqual([]);
  });

  it('keeps the declared list honest — every acronym is defended and used', () => {
    /*
     * An exemption for something that no longer appears stops anyone reading
     * the list, at which point the live ones stop being seen.
     */
    const used = new Set(
      titles.flatMap(entry => entry.title.match(/\b[A-Z]{2,}\b/g) ?? [])
    );
    expect([...declared].filter(acronym => !used.has(acronym))).toEqual([]);
    expect(
      Object.entries(rules.residentAcronyms)
        .filter(([, reason]) => !reason?.trim())
        .map(([acronym]) => acronym)
    ).toEqual([]);
  });
});

describe('the role exceptions stay honest', () => {
  it('defends each one, and each is actually used', () => {
    const used = titles.map(entry => entry.title.toLowerCase());
    const stale = Object.keys(rules.roleExceptions).filter(
      role => !used.some(title => title.includes(role.toLowerCase()))
    );
    expect(stale).toEqual([]);
    expect(
      Object.entries(rules.roleExceptions)
        .filter(([, reason]) => !reason?.trim())
        .map(([role]) => role)
    ).toEqual([]);
  });
});

describe('slugs', () => {
  it('derives every slug from its title', () => {
    const found = external
      .filter(entry => entry.slug !== slugOf(entry.taskTitle as string))
      .map(entry => `${entry.id} → ${entry.slug}`);
    expect(found).toEqual([]);
  });

  it('keeps every slug unique — two pages cannot claim one URL', () => {
    const slugs = external.map(entry => entry.slug as string);
    const duplicated = slugs.filter(
      (slug, index) => slugs.indexOf(slug) !== index
    );
    expect([...new Set(duplicated)]).toEqual([]);
  });

  it('keeps every slug kebab-case', () => {
    expect(
      external
        .filter(entry => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.slug ?? ''))
        .map(entry => entry.id)
    ).toEqual([]);
  });

  it('gives no internal service a slug', () => {
    expect(
      internal.filter(entry => entry.slug !== null).map(e => e.id)
    ).toEqual([]);
  });
});

describe('rule 5 — grouped, never merged', () => {
  const byId = new Map(entries.map(entry => [entry.id, entry]));

  it('gives every group at least two members', () => {
    expect(
      vocabulary.groups.filter(group => group.members.length < 2).map(g => g.id)
    ).toEqual([]);
  });

  it('keeps every member as its own entry', () => {
    // The whole point: one resident question, several charter services, and
    // each service keeps its own fee, requirements and processing time.
    const missing = vocabulary.groups.flatMap(group =>
      group.members.filter(id => !byId.has(id)).map(id => `${group.id} → ${id}`)
    );
    expect(missing).toEqual([]);
  });

  it('points every member back at its group', () => {
    const wrong = vocabulary.groups.flatMap(group =>
      group.members
        .filter(id => byId.get(id)?.answers !== group.id)
        .map(id => `${id} should answer ${group.id}`)
    );
    expect(wrong).toEqual([]);
  });

  it('points no entry at a group that does not exist', () => {
    const known = new Set(vocabulary.groups.map(group => group.id));
    expect(
      entries
        .filter(entry => entry.answers !== null && !known.has(entry.answers))
        .map(entry => `${entry.id} → ${entry.answers}`)
    ).toEqual([]);
  });

  it('states the resident question each group answers', () => {
    expect(
      vocabulary.groups.filter(group => !group.question?.trim()).map(g => g.id)
    ).toEqual([]);
  });
});

describe('rule 6 — verbatim is preserved, never replaced', () => {
  it('carries every verbatim office string the charter uses', () => {
    const roster = new Set(vocabulary.offices.map(office => office.verbatim));
    const missing = [
      ...new Set(inventory.services.map(service => service.office)),
    ].filter(verbatim => !roster.has(verbatim));
    expect(missing).toEqual([]);
  });

  it('maps every roster row to a canonical office', () => {
    expect(
      vocabulary.offices
        .filter(office => !office.canonical?.trim())
        .map(office => office.verbatim)
    ).toEqual([]);
  });

  it('leaves no roster row unused', () => {
    // A row for a string the charter no longer contains is a stale claim about
    // the document.
    const used = new Set(inventory.services.map(service => service.office));
    expect(
      vocabulary.offices
        .filter(office => !used.has(office.verbatim))
        .map(office => office.verbatim)
    ).toEqual([]);
  });

  it('records each entry’s office exactly as the inventory has it', () => {
    const offices = new Map(
      inventory.services.map(service => [service.id, service.office])
    );
    expect(
      entries
        .filter(entry => entry.office.verbatim !== offices.get(entry.id))
        .map(entry => entry.id)
    ).toEqual([]);
  });

  it('records a charterTitleSource this file knows how to check', () => {
    /*
     * Without this the check below is opt-out: invent a fourth value and the
     * entry matches neither branch, so nothing verifies its title at all.
     */
    const allowed = new Set(['extracted', 'not-in-layout', 'read-from-pdf']);
    expect(
      entries
        .filter(entry => !allowed.has(entry.charterTitleSource))
        .map(entry => `${entry.id} → ${entry.charterTitleSource}`)
    ).toEqual([]);
  });

  it('does not tidy a charter title it did not read from the document', () => {
    /*
     * The quiet failure this catches: somebody fixes the capitals on an ALL
     * CAPS title, completes one that trails off mid-sentence, or gives a name
     * to one of the entries whose document carries no heading — and the
     * inventory and the vocabulary now disagree about what the municipality
     * published. Where a title genuinely had to be read from the PDF, the entry
     * says so, and that is the ONLY case where the two may differ.
     *
     * This covers `not-in-layout` as well as `extracted`. Checking only the
     * latter left the nine title-less internal entries free to acquire an
     * invented service name that nothing would object to — which is exactly the
     * unsourced claim this project exists not to make.
     */
    const published = new Map(
      inventory.services.map(service => [service.id, service.title])
    );
    const altered = entries
      .filter(entry => entry.charterTitleSource !== 'read-from-pdf')
      .filter(entry => entry.charterTitle !== published.get(entry.id))
      .map(entry => `${entry.id} → ${JSON.stringify(entry.charterTitle)}`);
    expect(altered).toEqual([]);
  });

  it('flags every human-supplied title as read-from-pdf, and only those', () => {
    const published = new Map(
      inventory.services.map(service => [service.id, service.title])
    );
    const readFromPdf = entries.filter(
      entry => entry.charterTitleSource === 'read-from-pdf'
    );

    // Each one must actually differ from what the extractor got — otherwise the
    // flag is decoration.
    expect(
      readFromPdf
        .filter(entry => entry.charterTitle === published.get(entry.id))
        .map(entry => entry.id)
    ).toEqual([]);

    // And each must say why it needed a human.
    expect(
      readFromPdf.filter(entry => !entry.notes?.trim()).map(entry => entry.id)
    ).toEqual([]);
  });
});

describe('the coverage block is counted, not claimed', () => {
  /*
   * `coverage:` states how much of the charter this file accounts for, and it
   * is the first thing anybody reads. Left unchecked it is a number somebody
   * typed once: delete half the entries and it still says 99, which reads as
   * "covered" long after it stopped being true.
   */
  const stated = vocabulary.coverage;

  it('matches what the file actually contains', () => {
    expect(stated.total).toBe(entries.length);
    expect(stated.external).toBe(external.length);
    expect(stated.internal).toBe(internal.length);
    expect(stated.titled).toBe(
      external.filter(entry => entry.taskTitle !== null).length
    );
    expect(stated.readFromPdf).toBe(
      entries.filter(entry => entry.charterTitleSource === 'read-from-pdf')
        .length
    );
    expect(stated.officeStrings).toBe(vocabulary.offices.length);
    expect(stated.canonicalOffices).toBe(
      new Set(vocabulary.offices.map(office => office.canonical)).size
    );
  });

  it('accounts for every enumerated service, with nothing left over', () => {
    expect(stated.external + stated.internal).toBe(stated.total);
    expect(stated.total).toBe(inventory.services.length);
  });
});

describe('no person is named', () => {
  /*
   * The charter's PERSON RESPONSIBLE column is the one that could carry a name,
   * and it is deliberately not captured. A name here would be an unsourced
   * assertion sitting outside the data layer, where nothing carries a source or
   * a check date beside it.
   */
  const HONORIFICS = /\b(?:Mr|Mrs|Ms|Miss|Dr|Atty|Engr|Hon|Sr|Jr)\b\.?\s+[A-Z]/;

  it('uses no personal honorific anywhere in the vocabulary', () => {
    const text = readFileSync(
      path.join(ROOT, 'inventory', 'task-vocabulary.yaml'),
      'utf8'
    );
    expect(HONORIFICS.test(text)).toBe(false);
  });
});
