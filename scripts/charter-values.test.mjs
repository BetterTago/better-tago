import { describe, expect, it } from 'vitest';

import { linesFromXml } from './charter-bbox.mjs';
import {
  columnsFromGutters,
  DURATION_RE,
  extractService,
  FEE_RE,
  guttersIn,
  headerFragmentsOn,
  nameColumns,
} from './charter-values.mjs';

/**
 * The extractor reads MONEY out of a PDF, so every way it can be quietly wrong
 * gets a test here. Its failures do not throw — they put a plausible figure
 * under a plausible heading, and the only thing standing between that and a
 * resident acting on it is this file.
 *
 * Fixtures are hand-built bbox XML rather than PDFs: the geometry is the input,
 * and writing it out makes the case being tested legible instead of hidden
 * inside a binary.
 */

/** One line of poppler's `-bbox-layout` output. */
const line = (x0, y0, x1, y1, text) =>
  `<line xMin="${x0}" yMin="${y0}" xMax="${x1}" yMax="${y1}">` +
  text
    .split(' ')
    .map(
      (word, index, all) =>
        `<word xMin="${x0 + ((x1 - x0) / all.length) * index}" yMin="${y0}" ` +
        `xMax="${x0 + ((x1 - x0) / all.length) * (index + 1)}" yMax="${y1}">${word}</word>`
    )
    .join('') +
  '</line>';

const block = (...lines) => `<block>${lines.join('')}</block>`;
const page = (...blocks) =>
  `<page width="842.000000" height="595.400000"><flow>${blocks.join('')}</flow></page>`;
const doc = (...pages) => `<doc>${pages.join('')}</doc>`;

const widths = new Map([
  [1, 842],
  [2, 842],
]);

/**
 * A minimal but REAL service: four labelled fields, a two-column requirements
 * table, a five-column steps table with a vertically-merged fee, and a total.
 */
const SERVICE = doc(
  page(
    block(line(36, 100, 300, 112, '1. Registration of Something')),
    block(line(40, 130, 130, 142, 'Office or Division:')),
    block(line(300, 130, 450, 142, 'Office of the Something')),
    block(line(40, 150, 110, 162, 'Classification:')),
    block(line(300, 150, 340, 162, 'Simple')),
    block(line(40, 170, 150, 182, 'Type of Transaction:')),
    block(line(300, 170, 460, 182, 'G2C - Government to Citizen')),
    block(line(40, 190, 120, 202, 'Who may avail:')),
    block(line(300, 190, 400, 202, 'Any resident')),
    block(line(150, 215, 300, 227, 'CHECKLIST OF REQUIREMENTS')),
    block(line(570, 215, 660, 227, 'WHERE TO SECURE')),
    block(line(80, 235, 210, 247, '1. Birth Certificate')),
    block(line(400, 235, 500, 247, 'PSA')),
    block(line(80, 255, 230, 267, '2. Valid Identification Card')),
    block(line(400, 255, 520, 267, 'Any government office')),
    // The steps table's header row, wrapped exactly as the real ones wrap.
    block(line(110, 285, 170, 297, 'CLIENT STEPS')),
    block(line(275, 285, 350, 297, 'AGENCY ACTION')),
    block(
      line(418, 285, 468, 297, 'FEES TO BE'),
      line(430, 299, 455, 311, 'PAID')
    ),
    block(
      line(490, 285, 545, 297, 'PROCESSING'),
      line(500, 299, 530, 311, 'TIME')
    ),
    block(line(658, 285, 759, 297, 'PERSON RESPONSIBLE')),
    // Row 1.
    block(line(63, 330, 200, 342, 'Submit the requirements')),
    block(line(230, 330, 340, 342, 'Receive and check')),
    block(line(500, 330, 555, 342, '15 Minutes')),
    block(line(580, 330, 670, 342, 'Registry Staff')),
    // Row 2 — the resident does nothing here, so the client column is empty.
    block(line(230, 370, 370, 382, 'Encode and print')),
    block(line(500, 370, 555, 382, '10 Minutes')),
    block(line(580, 370, 670, 382, 'Registry Staff')),
    // The fee, printed ONCE across both rows, sitting between them.
    block(line(425, 352, 460, 364, 'Php200.00')),
    // The total row: a figure and nothing anybody does.
    block(line(425, 410, 460, 422, 'Php200.00')),
    block(line(500, 410, 555, 422, '25 Minutes'))
  )
);

const serviceOf = xml => extractService(linesFromXml(xml), widths);

describe('the fixture is actually being parsed', () => {
  it('reads every line, so a test cannot pass on an empty document', () => {
    expect(linesFromXml(SERVICE).length).toBeGreaterThan(20);
  });
});

describe('the four labelled fields', () => {
  it('reads each one from the line to its right, not the line below', () => {
    const service = serviceOf(SERVICE);
    expect(service.officeOrDivision).toBe('Office of the Something');
    expect(service.classification).toBe('Simple');
    expect(service.typeOfTransaction).toBe('G2C - Government to Citizen');
    expect(service.whoMayAvail).toBe('Any resident');
  });
});

describe('the requirements table', () => {
  it('pairs each requirement with where it is secured', () => {
    expect(serviceOf(SERVICE).requirements).toEqual([
      { item: '1. Birth Certificate', marked: true, whereToSecure: 'PSA' },
      {
        item: '2. Valid Identification Card',
        marked: true,
        whereToSecure: 'Any government office',
      },
    ]);
  });

  it('does not read the where-to-secure column as a second requirement', () => {
    // The failure this replaced: reading order alone emits `1. Birth
    // Certificate` then `PSA` as two requirements, and the second one is not a
    // requirement at all — it is where the first is obtained.
    const items = serviceOf(SERVICE).requirements.map(entry => entry.item);
    expect(items).not.toContain('PSA');
  });
});

describe('the steps table', () => {
  it('keeps a row together across five columns that do not share a y', () => {
    const [first] = serviceOf(SERVICE).steps;
    expect(first).toMatchObject({
      clientStep: 'Submit the requirements',
      agencyAction: 'Receive and check',
      processingTime: '15 Minutes',
      personResponsible: 'Registry Staff',
    });
  });

  it('leaves the client column empty on a step the resident takes no part in', () => {
    // A sparse client-step column is the DESIGN of these tables, not a merge.
    // Treating it as one emptied four of five columns on the first real
    // document tried.
    const [, second] = serviceOf(SERVICE).steps;
    expect(second.clientStep).toBeUndefined();
    expect(second.agencyAction).toBe('Encode and print');
  });

  it('does not read a wrapped column header as a value', () => {
    // `FEES TO BE` / `PAID` and `PROCESSING` / `TIME` wrap in the real
    // documents. Read as data, `PAID` becomes a fee.
    const service = serviceOf(SERVICE);
    const everything = JSON.stringify(service.steps);
    expect(everything).not.toMatch(/\bPAID\b/);
    expect(everything).not.toMatch(/\bPROCESSING\b/);
    expect(service.fees).not.toContain('PAID');
  });

  it('does not merge two rows of one column into a single cell', () => {
    // `Receive and check` and `Encode and print` are 28pt apart — the same gap
    // as the two lines of a wrapped header. Distance alone cannot separate
    // them, which is why cell merging requires a shared block.
    const actions = serviceOf(SERVICE).steps.map(step => step.agencyAction);
    expect(actions).toContain('Receive and check');
    expect(actions).toContain('Encode and print');
    // Each stays its own cell. Asserted per cell rather than over the joined
    // list, which concatenates them whether or not they merged.
    expect(actions.every(action => !/check\s+Encode/.test(action ?? ''))).toBe(
      true
    );
  });
});

describe('a vertically-merged cell', () => {
  it('is reported as merged rather than spread across the rows it covers', () => {
    const service = serviceOf(SERVICE);
    expect(service.mergedColumns).toContain('fee');
    expect(service.extractionFlags).toContain('merged-cells-not-attributed');
  });

  it('never invents a per-row fee for the rows it could not be attributed to', () => {
    // poppler reports where a merged cell's text SITS, which is the middle of
    // its span. Distributing it would put a transcribed-looking fee on rows the
    // document never assigned one to.
    const withFee = serviceOf(SERVICE).steps.filter(step => step.fee);
    expect(withFee.length).toBeLessThan(2);
  });
});

describe("the charter's own total row", () => {
  it('is recognised without the word TOTAL, by carrying no action and no person', () => {
    expect(serviceOf(SERVICE).total).toMatchObject({
      fee: 'Php200.00',
      processingTime: '25 Minutes',
      labelled: false,
    });
  });

  it('is taken out of the steps, so it is never rendered as a step', () => {
    const steps = serviceOf(SERVICE).steps;
    expect(steps).toHaveLength(2);
    expect(JSON.stringify(steps)).not.toContain('25 Minutes');
  });
});

describe('figures are carried byte-for-byte', () => {
  it('leaves the charter notation exactly as printed', () => {
    // The archive carries `P 1,000.00`, `P1250.00`, `Php200.00` and
    // `PHP100.00`, several inside one document. That inconsistency is what the
    // counter will say. Normalising it is what ★ TAGO-202 criterion 3 forbids.
    for (const printed of [
      'P 1,000.00',
      'P1250.00',
      'P200.00',
      'P 3,000',
      'Php200.00',
      'PHP100.00',
      '₱ 500.00',
    ]) {
      expect(printed.match(new RegExp(FEE_RE.source, FEE_RE.flags))).toEqual([
        printed,
      ]);
    }
  });

  it('reads a duration without rounding it', () => {
    for (const printed of [
      '15 Minutes',
      '3 Working Days',
      '1 Hour',
      '30 minutes',
    ]) {
      expect(
        printed.match(new RegExp(DURATION_RE.source, DURATION_RE.flags))
      ).toEqual([printed]);
    }
  });

  it('never matches money across a line break', () => {
    // A `P` ending one line and a `2` starting the next produced fifteen fees
    // that appear in no document, when the scan ran over joined text.
    const joined = 'costs P\n2 copies required';
    const perLine = joined
      .split('\n')
      .flatMap(one => one.match(new RegExp(FEE_RE.source, FEE_RE.flags)) ?? []);
    expect(perLine).toEqual([]);
  });
});

describe('gutters, which is how columns are found without a header', () => {
  it('finds the bands no glyph crosses', () => {
    const lines = linesFromXml(
      doc(
        page(
          block(line(40, 100, 200, 112, 'left cell')),
          block(line(300, 100, 400, 112, 'right cell'))
        )
      )
    );
    const gaps = guttersIn(lines, 842);
    expect(gaps.some(([from, to]) => from <= 210 && to >= 290)).toBe(true);
  });

  it('ignores a full-width line, which would otherwise bridge every column', () => {
    // A service description or a requirement that wrapped across the whole
    // table crosses every gutter and collapses a five-column page to one.
    const lines = linesFromXml(
      doc(
        page(
          block(
            line(
              40,
              80,
              800,
              92,
              'a description spanning the entire page width'
            )
          ),
          block(line(40, 100, 200, 112, 'left cell')),
          block(line(300, 100, 400, 112, 'right cell'))
        )
      )
    );
    expect(columnsFromGutters(lines, 842).length).toBeGreaterThan(1);
  });
});

describe('naming a column, and refusing to guess a figure', () => {
  const lines = linesFromXml(
    doc(
      page(
        block(line(40, 100, 200, 112, 'Do the thing')),
        block(line(300, 100, 400, 112, 'Php50.00')),
        block(line(500, 100, 600, 112, '10 Minutes'))
      )
    )
  );

  it('names a column by what it contains when there is no header at all', () => {
    // 270 of the archive's 447 pages carry no header row: the table continues
    // and the header does not repeat. Content is the only signal left.
    const named = nameColumns(columnsFromGutters(lines, 842), lines, null);
    expect(named.find(column => column.key === 'fee')?.via).toBe('content');
    expect(named.find(column => column.key === 'processingTime')?.via).toBe(
      'content'
    );
  });

  it('records a positional guess as a guess', () => {
    const named = nameColumns(columnsFromGutters(lines, 842), lines, null);
    const guessed = named.filter(column => column.via === 'position');
    expect(guessed.every(column => column.key !== 'fee')).toBe(true);
  });

  it('drops a fee whose column was named by position alone', () => {
    // The real failure: one Tourism service lays out four columns rather than
    // five, and naming by order put the responsible officer under
    // `agencyAction`. A figure named that way is not published.
    const prose = linesFromXml(
      doc(
        page(
          block(line(40, 100, 200, 112, 'Do the thing')),
          block(line(300, 100, 480, 112, 'The office does something')),
          block(line(600, 100, 700, 112, 'Somebody Senior'))
        )
      )
    );
    const service = extractService(prose, widths);
    expect(service.fees).toEqual([]);
    expect(service.steps.every(step => !step.fee)).toBe(true);
  });
});

describe('a wrapped header is still a header', () => {
  it('matches the fragments rather than the phrase', () => {
    // `PROCESSING` and `TIME` arrive as separate lines, and one real document
    // letter-spaces it into `PROCESSIN G`. Matching phrases reported a fees
    // column missing on 74 of 96 services — a bug that would have shipped as a
    // finding about the municipality's charter.
    const lines = linesFromXml(
      doc(
        page(
          block(
            line(418, 285, 468, 297, 'FEES TO BE'),
            line(430, 299, 455, 311, 'PAID')
          ),
          block(
            line(490, 285, 545, 297, 'PROCESSIN G'),
            line(500, 299, 530, 311, 'TIME')
          )
        )
      )
    );
    const found = headerFragmentsOn(lines);
    expect(found.map(header => header.key).sort()).toEqual([
      'fee',
      'processingTime',
    ]);
  });
});

describe('the requirements list has to read as a list of things to bring', () => {
  /*
   * Added after review. The steps-shaped gate below passed `register-a-birth` —
   * five columns, timed rows, a total — and it shipped a requirements table
   * with forty items, nine of them bare bullets and thirty-eight with no
   * source. A resident could not have told what to bring from it, and it looked
   * complete, which is worse than the index-and-link page it replaced.
   */
  const withRequirements = rows =>
    doc(
      page(
        block(line(40, 130, 130, 142, 'Office or Division:')),
        block(line(300, 130, 450, 142, 'Office of the Something')),
        block(line(150, 215, 300, 227, 'CHECKLIST OF REQUIREMENTS')),
        block(line(570, 215, 660, 227, 'WHERE TO SECURE')),
        ...rows,
        // TWO step headers, because one is a stray word and `headerFragmentsOn`
        // will not call a table off a single hit — with only `CLIENT STEPS` the
        // requirements and steps regions overlap and the fixture tests nothing.
        block(line(110, 285, 170, 297, 'CLIENT STEPS')),
        block(line(275, 285, 350, 297, 'AGENCY ACTION')),
        block(line(63, 330, 200, 342, 'Do the thing')),
        block(line(500, 330, 555, 342, '15 Minutes')),
        block(line(425, 330, 460, 342, 'Php50.00'))
      )
    );

  it("keeps the charter's own bullet instead of supplying one", () => {
    /*
     * The markers sit in their own narrow column in these documents, so a
     * bullet and the text it introduces are separate lines. An earlier version
     * consumed the bullet and the renderer then added a markdown one on top —
     * which renumbers a list a resident may be reading against the paper form.
     */
    const service = serviceOf(
      withRequirements([
        block(line(80, 235, 210, 247, '1. Birth Certificate')),
        block(line(400, 235, 500, 247, 'PSA')),
        block(line(33, 255, 38, 267, '\u2022')),
        block(line(80, 255, 300, 267, 'Marriage Certificate of the parents')),
      ])
    );
    expect(service.requirements.map(entry => entry.item)).toEqual([
      '1. Birth Certificate',
      '\u2022 Marriage Certificate of the parents',
    ]);
    expect(service.requirements.every(entry => entry.marked)).toBe(true);
  });

  it('joins a wrapped requirement instead of making it a second one', () => {
    /*
     * "Notarized Affidavit of delayed registration of birth with" and
     * "corroboration of two(2) witnesses" are two lines of ONE requirement, and
     * geometry cannot tell them from two — they share a column, a block and a
     * line rhythm. A line with no list marker continues the one above it.
     */
    const service = serviceOf(
      withRequirements([
        block(
          line(
            80,
            235,
            210,
            247,
            '1. Notarized Affidavit of delayed registration'
          )
        ),
        block(line(400, 235, 500, 247, 'Any Notary Public')),
        block(line(80, 255, 300, 267, 'with corroboration of two witnesses')),
      ])
    );
    expect(service.requirements).toHaveLength(1);
    expect(service.requirements[0].item).toBe(
      '1. Notarized Affidavit of delayed registration with corroboration of two witnesses'
    );
  });

  it('refuses to guess a pairing the document does not print', () => {
    /*
     * One tall address cell beside several requirements. Which requirement each
     * address belongs to is not in the geometry, so NOTHING is paired and the
     * addresses are carried separately. Attaching them by proximity would send
     * somebody to the wrong counter with a citation on it.
     */
    const service = serviceOf(
      withRequirements([
        block(line(80, 235, 210, 247, '1. Birth Certificate')),
        block(line(80, 255, 230, 267, '2. Marriage Certificate')),
        block(line(80, 271, 230, 283, '3. Valid Identification Card')),
        block(
          line(400, 235, 560, 247, 'PSA Tandag City'),
          line(400, 249, 560, 261, 'Any government office')
        ),
      ])
    );
    expect(service.requirements.every(entry => !entry.whereToSecure)).toBe(
      true
    );
    expect(service.unpairedSources.length).toBeGreaterThan(0);
  });

  it('accepts a list that pairs each requirement with a source', () => {
    const service = serviceOf(
      withRequirements([
        block(line(80, 235, 210, 247, '1. Birth Certificate')),
        block(line(400, 235, 500, 247, 'PSA')),
        block(line(80, 255, 230, 267, '2. Valid Identification Card')),
        block(line(400, 255, 520, 267, 'Any government office')),
      ])
    );
    expect(service.confidence).toBe('high');
    expect(service.requirements).toHaveLength(2);
  });
});

describe('the confidence it reports', () => {
  it('is high only when the office, the columns and the rows all resolved', () => {
    expect(serviceOf(SERVICE).confidence).toBe('high');
  });

  it('falls to needs-human when a page yields no columns', () => {
    const flat = linesFromXml(
      doc(
        page(
          block(line(40, 100, 800, 112, 'one full width line and nothing else'))
        )
      )
    );
    expect(extractService(flat, widths).confidence).toBe('needs-human');
  });
});
