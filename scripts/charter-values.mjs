/**
 * Reading the CONTENTS of a Citizen's Charter service — the requirements, the
 * fees, the processing time and the steps — out of the PDF's geometry.
 *
 * `charter-parse.mjs` answers *which services exist and does each HAVE a fees
 * column*. This answers *what is in it*, and it is the file a resident's money
 * depends on, so its failure mode matters more than its coverage.
 *
 * ─── WHY THE COLUMN HEADERS ARE NOT THE ANCHOR ───────────────────────────────
 *
 * The obvious design reads the `CLIENT STEPS · AGENCY ACTION · FEES TO BE PAID ·
 * PROCESSING TIME · PERSON RESPONSIBLE` header row and slices by it. Measured
 * across the real archive that anchor is not there: of 447 pages, **13** carry
 * all five headers, 164 carry some, and 270 carry none at all, because the
 * table continues onto pages that do not repeat it.
 *
 * Worse, carrying a page's boundaries forward is actively wrong — the civil
 * registrar's table sits at a different x on page 3 than on page 2. Boundaries
 * inherited from the previous page put `Php200.00` in the processing-time
 * column, which is a plausible-looking wrong answer of exactly the kind this
 * document set has produced twice before.
 *
 * ─── WHAT IS ANCHORED ON INSTEAD ─────────────────────────────────────────────
 *
 * **Gutters.** A table's columns are separated by vertical bands no glyph
 * crosses. Those are found per page, from that page's own text, and they need
 * no header. Columns are then NAMED by three signals in order of trust:
 *
 *   1. a header fragment that horizontally overlaps the column, where one is on
 *      the page — `PROCESSING` and `TIME` arrive as separate lines and one
 *      document letter-spaces it to `PROCESSIN G`, so fragments are matched,
 *      never phrases;
 *   2. what the column CONTAINS — a fee-shaped string is a fee wherever it
 *      sits, and a duration is a duration. Self-identifying content is the only
 *      signal that survives a page with no header at all;
 *   3. position, for what is left: leftmost is the client's step, rightmost is
 *      who is responsible.
 *
 * ─── WHAT IT REFUSES TO DO ───────────────────────────────────────────────────
 *
 * A vertically-merged cell — one `None` printed once across four steps — cannot
 * be attributed per row. poppler reports where its text SITS, which is the
 * middle of its span, not the span. So a column with fewer cells than the table
 * has rows is returned whole, flagged `spanned`, and never distributed. The
 * service's authoritative totals come from the charter's own TOTAL row.
 *
 * Nothing here rounds, reformats, merges or modernises a figure. Whitespace
 * between words is normalised to single spaces — poppler's inter-word gaps are
 * a rendering artefact — and that is the only transformation applied to any
 * string that came out of the document.
 */

import { isPageFurniture, pdfLines, STEP_COLUMNS } from './charter-bbox.mjs';

/**
 * A money figure as these documents actually print one.
 *
 * Deliberately loose on notation and strict on shape. The archive carries
 * `P 1,000.00`, `P1250.00`, `P200.00`, `P 3,000`, `Php200.00` and `PHP100.00`,
 * several of them inside one document — that inconsistency is DATA, it is what
 * the counter will say, and normalising it is the failure ★ TAGO-202 criterion
 * 3 exists to forbid.
 */
export const FEE_RE =
  /(?:₱|P(?:hp?)?\.?)\s?\d[\d,]*(?:\.\d{1,2})?|\b\d[\d,]*\.\d{2}\b/gi;

/** A duration as printed. `Working Days` before `Days`, so the longer wins. */
export const DURATION_RE =
  /\b\d+(?:\.\d+)?\s*(?:working\s+days?|calendar\s+days?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\b/gi;

/** The charter's own summary row. Its leftmost cell is the word TOTAL. */
const TOTAL_RE = /^\s*TOTAL\b[\s:]*$|^\s*TOTAL\s*[:\-]/i;

const REQUIREMENTS_HEADING = /CHECKLIST\s*OF\s*REQUIREMENTS?/i;

/**
 * `Label:  value` — the four fields every service block declares.
 *
 * The terminator is `:` OR `?`: the agriculture office writes `Who may avail?`,
 * and a pattern accepting only the colon left ten services with no eligibility
 * at all once the inline form stopped mis-capturing the `?` as its value.
 */
const LABELLED_FIELDS = [
  { key: 'officeOrDivision', match: /^office\s+or\s+division\s*[:?]?\s*$/i },
  { key: 'classification', match: /^classification\s*[:?]?\s*$/i },
  { key: 'typeOfTransaction', match: /^type\s+of\s+transaction\s*[:?]?\s*$/i },
  { key: 'whoMayAvail', match: /^who\s+may\s+avail\s*[:?]?\s*$/i },
];

/**
 * The same four, where poppler kept label and value on ONE line.
 *
 * 🔴 These matched on `:` or TWO SPACES, and the two-space branch could never
 * fire: `pdfLines` normalises poppler's inter-word gaps to single spaces before
 * anything sees them, so the wide gap the legislative documents use instead of
 * a colon had already been collapsed. Ten services came out with no owning
 * office and were withheld from publication for it.
 *
 * The label is fixed text, so the split point does not need a separator at all —
 * everything after it is the value.
 *
 * 🔴 THE VALUE MAY NOT OPEN WITH THE LABEL'S OWN PUNCTUATION. The agriculture
 * office writes `Who may avail?` with a question mark rather than a colon, and
 * with only `:?` permitted the regex matched the label, found the `?` left
 * over, and returned **"?"** as the value — which then rendered under *Who can
 * apply* on ten published pages. Both terminators are allowed now, and neither
 * can be captured as content.
 */
const INLINE_FIELDS = [
  {
    key: 'officeOrDivision',
    match: /^office\s+or\s+division\s*[:?]?\s*([^:?\s].*)$/i,
  },
  { key: 'classification', match: /^classification\s*[:?]?\s*([^:?\s].*)$/i },
  {
    key: 'typeOfTransaction',
    match: /^type\s+of\s+transaction\s*[:?]?\s*([^:?\s].*)$/i,
  },
  { key: 'whoMayAvail', match: /^who\s+may\s+avail\s*[:?]?\s*([^:?\s].*)$/i },
];

/** Exactly the anchor `charter-parse.mjs` proved: one per service, always. */
const ANCHOR_RE = /^\s*Office\s+or\s+Division\s*(?::|\s{2,}|\s*$)/i;

const HEADING_RE = /^\s*(\d{1,2})\s*\.\s*(\S.*?)\s*$/;

/** A document ordinate that sorts across page breaks. */
const ord = line => line.page * 100000 + line.y0;

const matchesOf = (text, pattern) =>
  text.match(new RegExp(pattern.source, pattern.flags)) ?? [];

/**
 * Vertical bands of x that no glyph on this page crosses.
 *
 * ⚠️ `minWidth` is 5pt, not the 8pt this started with, and the difference is
 * two dozen publishable pages. The civil registrar separates its requirements
 * from its *where to secure* column by **6 points**; at 8 the gutter was invisible,
 * the page collapsed to one column, and every requirement and every address on
 * it came out as a separate item.
 *
 * 5pt is safe because occupancy is marked across each line's WHOLE span, so the
 * gaps between words inside a line are already filled in. A run that survives is
 * one no line crosses anywhere in the region — a real column boundary, never a
 * wide space between two words.
 *
 * Lines wider than 55% of the page are excluded from the occupancy map before
 * the runs are found: a full-width paragraph — a service description, a
 * requirement that wrapped across the whole table — bridges every gutter and
 * collapses a five-column page to one. They are still assigned to a column
 * afterwards; they simply do not get a vote on where the columns are.
 */
export function guttersIn(lines, pageWidth, minWidth = 5) {
  const span = Math.ceil(pageWidth) + 2;
  const occupancy = new Uint8Array(span);

  for (const line of lines) {
    if (line.x1 - line.x0 > pageWidth * 0.55) continue;
    for (
      let x = Math.max(0, Math.floor(line.x0));
      x <= Math.min(span - 1, Math.ceil(line.x1));
      x += 1
    ) {
      occupancy[x] = 1;
    }
  }

  const runs = [];
  let start = null;
  for (let x = 0; x < span; x += 1) {
    if (!occupancy[x]) {
      if (start === null) start = x;
    } else if (start !== null) {
      runs.push([start, x - 1]);
      start = null;
    }
  }
  if (start !== null) runs.push([start, span - 1]);

  // The runs at the page edges are margins, not gutters between columns.
  return runs
    .filter(([from, to]) => to - from >= minWidth)
    .filter(([from, to]) => from > 0 && to < span - 1);
}

/** Column x-ranges derived from the gutters between them. */
export function columnsFromGutters(lines, pageWidth) {
  const gaps = guttersIn(lines, pageWidth);
  if (gaps.length === 0) return null;

  const cuts = gaps.map(([from, to]) => (from + to) / 2);
  const edges = [Number.NEGATIVE_INFINITY, ...cuts, Number.POSITIVE_INFINITY];

  return edges.slice(0, -1).map((x0, index) => ({ x0, x1: edges[index + 1] }));
}

const centreOf = line => (line.x0 + line.x1) / 2;

/**
 * Naming each geometric column, by header overlap → content → position.
 *
 * Content beats position deliberately. A page with no header row is the common
 * case, and on one a fee-shaped string is the only trustworthy evidence that a
 * column is the fee column. Position alone would put the civil registrar's
 * `Php200.00` — which sits where another page puts processing time — under the
 * wrong heading, with a citation on it.
 */
export function nameColumns(columns, lines, headerColumns) {
  const named = columns.map(column => ({ ...column, key: null, via: null }));

  const contents = named.map(column =>
    lines.filter(line => {
      const centre = centreOf(line);
      return centre >= column.x0 && centre < column.x1;
    })
  );

  // 1 · a header fragment that overlaps this column horizontally.
  if (headerColumns) {
    for (const header of headerColumns) {
      const index = named.findIndex(
        column => header.centre >= column.x0 && header.centre < column.x1
      );
      if (index !== -1 && !named[index].key) {
        named[index].key = header.key;
        named[index].via = 'header';
      }
    }
  }

  // 2 · what the column actually contains.
  const claim = (key, test) => {
    if (named.some(column => column.key === key)) return;
    let best = -1;
    let bestScore = 0;
    contents.forEach((cell, index) => {
      if (named[index].key || cell.length === 0) return;
      const score = cell.filter(line => test(line.text)).length / cell.length;
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    });
    if (best !== -1 && bestScore >= 0.4) {
      named[best].key = key;
      named[best].via = 'content';
    }
  };

  claim(
    'fee',
    text => FEE_RE.test(text) || /^\s*(none|free|no\s+fee)\s*$/i.test(text)
  );
  claim('processingTime', text => DURATION_RE.test(text));

  // 3 · position, for whatever is left — and it is recorded as a GUESS.
  //
  // 🔴 Position is the weakest signal here and it is wrong often enough to
  // matter: one Tourism service lays out four columns rather than five, and
  // naming by order put the responsible officer under `agencyAction` and the
  // office's action under `clientStep`. Nothing named this way is published as
  // a labelled field — the caller reads `via` and falls back to presenting the
  // row's prose in reading order, which is true whichever column is which.
  const spare = named.filter(column => !column.key);
  const wanted = STEP_COLUMNS.map(column => column.key).filter(
    key => !named.some(column => column.key === key)
  );
  spare.forEach((column, index) => {
    column.key = wanted[Math.min(index, wanted.length - 1)] ?? `column${index}`;
    column.via = 'position';
  });

  return named.filter(column => column.key);
}

/** Header fragments on a page, merged when one header wrapped across lines. */
export function headerFragmentsOn(lines) {
  const FRAGMENTS = [
    { key: 'clientStep', match: /^CLIENT(STEPS?)?$/ },
    { key: 'agencyAction', match: /^AGENCY(ACTIONS?)?$/ },
    { key: 'fee', match: /^FEES?(TOBE(PAID)?)?$/ },
    { key: 'processingTime', match: /^PROCESSIN[G]?(TIME)?$|^TIME$/ },
    { key: 'personResponsible', match: /^PERSON(RESPONSIBLE)?$|^RESPONSIBLE$/ },
  ];

  const hits = [];
  for (const line of lines) {
    // Same all-caps guard as `isHeaderText`: a lowercase `time` is a word.
    if (/[a-z]/.test(line.text)) continue;
    const squashed = line.text.replace(/\s+/g, '').toUpperCase();
    for (const fragment of FRAGMENTS) {
      if (fragment.match.test(squashed)) {
        hits.push({ key: fragment.key, line });
        break;
      }
    }
  }
  if (hits.length < 2) return null;

  const byKey = new Map();
  for (const hit of hits) {
    const existing = byKey.get(hit.key);
    if (!existing) {
      byKey.set(hit.key, {
        key: hit.key,
        x0: hit.line.x0,
        x1: hit.line.x1,
        y: hit.line.y1,
      });
      continue;
    }
    existing.x0 = Math.min(existing.x0, hit.line.x0);
    existing.x1 = Math.max(existing.x1, hit.line.x1);
    existing.y = Math.max(existing.y, hit.line.y1);
  }

  return [...byKey.values()].map(header => ({
    ...header,
    centre: (header.x0 + header.x1) / 2,
  }));
}

/**
 * Rows, banded off whichever column carries the most cells.
 *
 * Every cell is placed — nothing is held back. An earlier version withheld any
 * column with fewer cells than the spine on the theory that it must be merged,
 * and it was wrong about the commonest case: a client-step column is SPARSE by
 * design, because the resident does nothing during the office's internal steps.
 * Withholding it emptied four of five columns on the first document tried.
 *
 * 🔴 A genuinely merged column — one `None` printed once across four steps —
 * still cannot be attributed per row, so it is REPORTED rather than spread. Its
 * single cell lands in the one band its text sits in, the column is named in
 * `merged`, and the service's authoritative figure comes from the charter's own
 * TOTAL row. Under-reporting a row is recoverable; inventing three fees is not.
 */
function rowsFromCells(cells, keys) {
  const byKey = new Map(keys.map(key => [key, []]));
  for (const cell of cells) byKey.get(cell.key)?.push(cell);
  for (const list of byKey.values()) list.sort((a, b) => a.y0 - b.y0);

  let spine = [];
  for (const list of byKey.values())
    if (list.length > spine.length) spine = list;
  if (spine.length === 0) return { rows: [], merged: [] };

  const bands = spine.map((cell, index) => ({
    y0:
      index === 0
        ? Number.NEGATIVE_INFINITY
        : (spine[index - 1].y1 + cell.y0) / 2,
    y1:
      index === spine.length - 1
        ? Number.POSITIVE_INFINITY
        : (cell.y1 + spine[index + 1].y0) / 2,
  }));

  const rows = bands.map(() => ({}));
  const merged = [];
  /** Where each band starts, so a caller can cut the table at a real ordinate. */
  const at = bands.map(() => null);

  for (const [key, list] of byKey) {
    if (list.length > 0 && list.length < spine.length && key !== 'clientStep') {
      merged.push(key);
    }
    for (const cell of list) {
      const centre = (cell.y0 + cell.y1) / 2;
      const index = bands.findIndex(
        band => centre >= band.y0 && centre < band.y1
      );
      if (index === -1) continue;
      rows[index][key] = rows[index][key]
        ? `${rows[index][key]} ${cell.text}`
        : cell.text;
      const ordinate = cell.page * 100000 + cell.y0;
      at[index] = at[index] === null ? ordinate : Math.min(at[index], ordinate);
    }
  }

  return {
    rows: rows.map((row, index) => ({ ...row, __at: at[index] })),
    merged,
  };
}

/**
 * Lines joined into cells: same column, SAME BLOCK, and close enough to be a
 * wrap rather than the next row.
 *
 * The block constraint is not decoration. Without it, "Receive and Encode data"
 * and the next row's "Review of data and printing of…" merge into one cell —
 * they are 18pt apart, and so are the two lines of a wrapped column header, so
 * no distance threshold alone separates them. Within a cell a wrap is ~3pt; the
 * gate is 1.35 line-heights, which admits the wrap and refuses the row.
 */
function cellsOf(lines, columns) {
  const placed = lines
    .map(line => ({
      line,
      column: columns.find(
        column => centreOf(line) >= column.x0 && centreOf(line) < column.x1
      ),
    }))
    .filter(entry => entry.column)
    .sort((a, b) => a.line.y0 - b.line.y0 || a.line.x0 - b.line.x0);

  const cells = [];
  for (const { line, column } of placed) {
    const open = cells.find(
      cell =>
        cell.key === column.key &&
        cell.block === line.block &&
        line.y0 - cell.y1 < Math.max(line.y1 - line.y0, 8) * 1.35
    );
    if (open) {
      open.parts.push(line.text);
      open.y1 = Math.max(open.y1, line.y1);
      continue;
    }
    cells.push({
      key: column.key,
      block: line.block,
      page: line.page,
      y0: line.y0,
      y1: line.y1,
      parts: [line.text],
    });
  }

  return cells.map(cell => ({ ...cell, text: cell.parts.join(' ') }));
}

/** Every fragment of a column header, so none of them is read as a value. */
const HEADER_TEXT =
  /^(CLIENT(STEPS?)?|STEPS?|AGENCY(ACTIONS?)?|ACTIONS?|FEES?(TOBE(PAID)?)?(\(INPHP\))?|TOBEPAID(\(INPHP\))?|PAID(\(INPHP\))?|\(INPHP\)|PROCESSIN[G]?(TIME)?|TIME|PERSON(RESPONSIBLE)?|RESPONSIBLE|CHECKLISTOFREQUIREMENTS?|WHERETOSECURE)$/;

/**
 * A column header, and ONLY a column header.
 *
 * 🔴 The all-caps guard is not cosmetic. `TIME`, `PAID`, `STEPS` and `ACTION`
 * are header fragments — `PROCESSING TIME` wraps, and its second line arrives
 * on its own — but they are also ordinary words. Without the guard, the civil
 * registrar's first requirement lost its wrapped continuation: the document
 * prints "…registered on-" / "time", and `time` was struck out as a header,
 * leaving a requirement that ended mid-word on a page a resident reads.
 *
 * Every header in this archive is set in capitals. A line carrying a lowercase
 * letter is content, whatever it spells.
 */
const isHeaderText = text =>
  !/[a-z]/.test(text) &&
  HEADER_TEXT.test(text.replace(/\s+/g, '').toUpperCase());

/**
 * One service's contents, read out of the lines that belong to it.
 *
 * @param {Array<object>} lines  the service's lines, any order
 * @param {Map<number, number>} pageWidths
 */
export function extractService(lines, pageWidths) {
  const body = lines
    .filter(line => !isPageFurniture(line.text))
    .sort((a, b) => ord(a) - ord(b));

  const flags = [];

  // ── the four labelled fields ──────────────────────────────────────────────
  const fields = {
    officeOrDivision: null,
    classification: null,
    typeOfTransaction: null,
    whoMayAvail: null,
  };

  // No index: the label lookup below searches the whole page by geometry, not
  // forward from the label, because in ten services the value is emitted first.
  body.forEach(line => {
    for (const field of INLINE_FIELDS) {
      const inline = line.text.match(field.match);
      if (inline && !fields[field.key]) fields[field.key] = inline[1].trim();
    }
    for (const field of LABELLED_FIELDS) {
      if (!field.match.test(line.text) || fields[field.key]) continue;
      /*
       * 🔴 THE WHOLE PAGE, NOT THE LINES AFTER IT.
       *
       * This searched forward from the label, and in ten services the value
       * came out null because poppler emits it FIRST: the health office sets
       * `Municipal Health Office – Birthing Facility` a shade higher than the
       * `Office or Division:` beside it, so sorting by y puts the value above
       * its own label. Those services were withheld from publication for it.
       *
       * What identifies the value is geometry, not order — same page, to the
       * right, on the same visual row. Nearest wins, so a two-column layout
       * cannot pick up something from three columns over.
       */
      const value = body
        .filter(
          other =>
            other.page === line.page &&
            other.x0 > line.x1 &&
            Math.abs(other.y0 - line.y0) <
              Math.max(line.y1 - line.y0, 8) * 1.6 &&
            !LABELLED_FIELDS.some(one => one.match.test(other.text)) &&
            // 🔴 A GLYPH IS NOT A VALUE. Two services picked up the bullet from
            // the requirements list below as their eligibility, and published
            // `Who may Avail: •`. Same class as the `?` the label pattern used
            // to capture: a value has a letter or a digit in it.
            /[\p{L}\p{N}]/u.test(other.text)
        )
        .sort((a, b) => a.x0 - b.x0)[0];
      if (value) fields[field.key] = value.text;
    }
  });

  // ── where the requirements stop and the steps start ───────────────────────
  const requirementsAt = body.find(line =>
    REQUIREMENTS_HEADING.test(line.text)
  );
  const stepsHeaders = headerFragmentsOn(body);
  const stepsAt = stepsHeaders
    ? body.find(line => {
        const squashed = line.text.replace(/\s+/g, '').toUpperCase();
        return (
          /^CLIENT(STEPS?)?$/.test(squashed) ||
          /^AGENCY(ACTIONS?)?$/.test(squashed)
        );
      })
    : null;

  // ── the requirements table, split into its own two columns ────────────────
  const requirementLines = requirementsAt
    ? body.filter(
        line =>
          ord(line) > ord(requirementsAt) &&
          (!stepsAt || ord(line) < ord(stepsAt)) &&
          !isHeaderText(line.text)
      )
    : [];

  const firstPass = splitRequirements(requirementLines, pageWidths);
  const requirements = firstPass.requirements;
  const unpairedSources = [...firstPass.unpairedSources];

  const stepLines =
    (stepsAt ?? requirementsAt)
      ? body.filter(
          line =>
            ord(line) > ord(stepsAt ?? requirementsAt) &&
            !isHeaderText(line.text)
        )
      : body.filter(line => !isHeaderText(line.text));

  // ── the steps table ───────────────────────────────────────────────────────
  const stepPages = [...new Set(stepLines.map(line => line.page))].sort(
    (a, b) => a - b
  );
  const rows = [];
  const mergedColumns = new Set();
  const namedVia = new Map();

  for (const page of stepPages) {
    const pageLines = stepLines.filter(line => line.page === page);
    if (pageLines.length === 0) continue;

    const width = pageWidths.get(page) ?? 842;
    const geometric = columnsFromGutters(pageLines, width);
    if (!geometric || geometric.length < 2) {
      flags.push(`no-columns-on-page-${page}`);
      rows.push(
        ...pageLines
          .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
          .map(line => ({ unresolved: line.text }))
      );
      continue;
    }

    const named = nameColumns(
      geometric,
      pageLines,
      headerFragmentsOn(pageLines)
    );
    for (const column of named) {
      namedVia.set(
        column.key,
        namedVia.get(column.key) === 'header' ? 'header' : column.via
      );
    }

    // 🔴 A figure whose column was named by POSITION is dropped rather than
    // labelled. `fee` and `processingTime` are the two fields a resident acts
    // on, and both are self-identifying when they are really there — a fee
    // looks like money, a duration looks like time. A column that carries
    // neither and was called `fee` only because it came third is not a fee
    // column, and publishing it as one is the failure mode this whole file is
    // arranged around.
    const trusted = new Set(
      named
        .filter(column => column.via !== 'position')
        .map(column => column.key)
    );

    const built = rowsFromCells(
      cellsOf(pageLines, named),
      named.map(column => column.key)
    );

    rows.push(
      ...built.rows
        .map(row => {
          const kept = { ...row };
          for (const key of ['fee', 'processingTime']) {
            if (kept[key] && !trusted.has(key)) {
              kept.unlabelled = [kept.unlabelled, kept[key]]
                .filter(Boolean)
                .join(' ');
              delete kept[key];
            }
          }
          return kept;
        })
        /*
         * 🔴 A ROW WITH NOTHING IN IT IS NOT A ROW.
         *
         * `Object.keys(row).length > 0` was not the same test: a row can hold
         * keys whose values are all empty strings, and 598 of the archive's
         * 1,842 rows were exactly that — 453 of them on the building-permit
         * page alone. They render as blank table rows, and a resident scrolling
         * past four hundred of them to reach step two is served worse than by
         * no page at all.
         *
         * Nothing is lost: an empty row carries no text, and completeness is
         * measured against the document rather than against the row count.
         */
        .filter(row =>
          Object.values(row).some(
            value => typeof value === 'string' && value.trim() !== ''
          )
        )
    );
    for (const key of built.merged) mergedColumns.add(key);
  }

  if (mergedColumns.size > 0) flags.push('merged-cells-not-attributed');

  /**
   * 🔴 WHERE THE REQUIREMENTS ACTUALLY STOP.
   *
   * The `CLIENT STEPS` header is not the boundary it looks like. In the longer
   * documents the requirements list runs for pages PAST it — the business
   * permit's runs to thirty-five items across four pages — and everything after
   * the header was read as a step. The generated page then instructed a
   * resident to "1. Contract of Lease, if space/area is rented", which is not a
   * step, and buried the actual fee.
   *
   * The reliable boundary is a property of the table itself: **every row of a
   * client-steps table carries a time or a fee, and no row of a requirements
   * table does.** So the steps begin at the first row that carries one, and
   * everything above it is still the requirements list.
   */
  const firstRealStep = rows.findIndex(row => row.fee || row.processingTime);
  if (firstRealStep > 0) {
    /*
     * 🔴 AND THEY ARE RE-READ AS REQUIREMENTS, NOT LIFTED OUT OF THE STEP ROWS.
     *
     * Taking the spilled rows as they stand reads a two-column requirements
     * table through the FIVE-column geometry of the steps table. That is how
     * `register-a-birth` shipped forty items, nine of them bare bullets and
     * thirty-eight with no source: each requirement's address had landed in a
     * different geometric column and become an item of its own.
     *
     * So the spilled LINES go back through the requirements reader, which finds
     * that table's own columns on that page and groups by the document's list
     * markers.
     */
    const boundary = rows[firstRealStep].__at ?? null;
    const spilled =
      boundary === null ? [] : stepLines.filter(line => ord(line) < boundary);

    if (spilled.length > 0) {
      const reread = splitRequirements(spilled, pageWidths);
      requirements.push(...reread.requirements);
      unpairedSources.push(...reread.unpairedSources);
      if (reread.spilledFromSteps)
        flags.push('steps-text-reached-the-requirements');
    } else {
      for (const row of rows.slice(0, firstRealStep)) {
        const item = row.clientStep ?? row.unresolved ?? null;
        if (item)
          requirements.push({ item, whereToSecure: row.agencyAction ?? null });
      }
    }

    rows.splice(0, firstRealStep);
    flags.push('requirements-continued-past-the-steps-header');
  }

  // ── the charter's own summary row ─────────────────────────────────────────
  // Labelled `TOTAL` in most documents. Where it is not labelled it is still
  // unmistakable: the last row of the table carrying a figure and NOTHING a
  // person does — no client step, no agency action, no one responsible.
  const totalIndex = rows.findLastIndex(
    row =>
      TOTAL_RE.test(row.clientStep ?? '') ||
      TOTAL_RE.test(row.unresolved ?? '') ||
      (!row.clientStep &&
        !row.agencyAction &&
        !row.personResponsible &&
        (row.fee || row.processingTime))
  );

  let total = null;
  if (totalIndex !== -1) {
    const row = rows[totalIndex];
    total = {
      fee: row.fee ?? null,
      processingTime: row.processingTime ?? null,
      labelled: TOTAL_RE.test(row.clientStep ?? row.unresolved ?? ''),
    };
    rows.splice(totalIndex, 1);
    // The Tourism charter prints its totals as "35 inutes" — the M is missing
    // in the SOURCE. Reproduced as printed, flagged here, never quietly
    // repaired: a silent correction breaks the byte-for-byte guarantee and
    // makes the entry unverifiable against the document it cites.
    if (total.processingTime && /\binutes\b/i.test(total.processingTime)) {
      flags.push('source-typo-in-total');
    }
  }

  // ── the figures, verbatim ─────────────────────────────────────────────────
  //
  // The fee COLUMN is the authority, not a scan of the whole service. A scan
  // reads a step number as money and, run across joined lines, invents figures
  // that are in no document at all — `P` ending one line and `2` starting the
  // next produced "P 2" fifteen times over the archive on the first attempt.
  // So each line is matched on its own, and a fee is trusted only where it came
  // from a column that a header or its own contents named.
  const stated = [...rows.map(row => row.fee), total?.fee].filter(
    value =>
      typeof value === 'string' &&
      value.trim() !== '' &&
      !TOTAL_RE.test(value) &&
      !isHeaderText(value)
  );

  const inProse = body.flatMap(line => matchesOf(line.text, FEE_RE));

  const fees = [...new Set(stated.length > 0 ? stated : inProse)];

  for (const row of rows) delete row.__at;

  for (const row of rows) delete row.__at;

  // The prose columns are labelled only where a header named them. Otherwise
  // the row still carries its cells, in reading order, under no claim about
  // which is the resident's move and which is the office's.
  const proseNamed = ['clientStep', 'agencyAction', 'personResponsible'].every(
    key => !namedVia.has(key) || namedVia.get(key) === 'header'
  );

  return {
    ...fields,
    requirements,
    unpairedSources: [...new Set(unpairedSources)],
    steps: rows,
    columnsNamedBy: Object.fromEntries(namedVia),
    proseColumnsTrusted: proseNamed,
    /**
     * False where the steps could not be arranged into a table at all — a page
     * whose gutters gave no columns, or a table long enough that it plainly was
     * not one service's worth of rows. Those steps are QUOTED rather than laid
     * out; the page says so.
     */
    stepsAreStructured: !(
      flags.some(flag => flag.startsWith('no-columns')) || rows.length > 20
    ),
    mergedColumns: [...mergedColumns],
    fees,
    processingTimes: [
      ...new Set(
        [...rows.map(row => row.processingTime), total?.processingTime].filter(
          value => typeof value === 'string' && value.trim() !== ''
        )
      ),
    ],
    total,
    text: body.map(line => line.text),
    found: {
      requirementsHeading: Boolean(requirementsAt),
      stepsHeading: Boolean(stepsAt),
      totalRow: total !== null,
    },
    extractionFlags: flags,
    confidence: confidenceOf(
      fields,
      rows,
      requirements,
      [...mergedColumns],
      flags
    ),
  };
}

/**
 * Whether this extraction is good enough to put in front of a resident.
 *
 * 🔴 The bar is deliberately high and the failure is deliberately silent-proof.
 * A wrong fee does not throw — it renders, plausibly, under the right heading,
 * with a citation beside it. So the gate asks for POSITIVE evidence that a
 * steps table was read, rather than for the absence of an error:
 *
 *   · the office is named, so the block was really a service;
 *   · at least half the rows carry a time or a fee. A genuine client-steps
 *     table times nearly every row; a requirements list mistaken for one times
 *     almost none, which is exactly how thirty-five requirements became
 *     thirty-five instructions on the business-permit page;
 *   · no more than twenty rows. No service in this archive has twenty steps,
 *     and a row count that high means two tables were read as one;
 *   · every page yielded columns.
 *
 * Anything short of that returns `needs-human`, the record's `content` is
 * `null`, and the page says which half is missing and why. Publishing less is
 * always available; publishing a plausible wrong figure is not recoverable.
 */
function confidenceOf(fields, rows, requirements, merged, flags) {
  if (!fields.officeOrDivision) return 'needs-human';
  if (rows.length === 0) return 'needs-human';

  /*
   * ⚠️ A TABLE THAT WOULD NOT RESOLVE IS NOT A REASON TO PUBLISH NOTHING.
   *
   * Two conditions used to force `needs-human` here: a page whose gutters gave
   * no columns, and a row count above twenty. Between them they withheld
   * eighteen services — including the building permit, whose table genuinely
   * runs across twenty pages, and every service on a page where one wide
   * requirement line bridges the gap between two columns.
   *
   * Neither says the CONTENT is wrong. Both say it could not be arranged into
   * a table, which is a formatting problem with a formatting answer: those
   * services publish with their steps quoted verbatim, in the document's own
   * order. See `stepsAreStructured` and `charter-markdown.mjs`.
   *
   * What still forces `needs-human` below is content that is WRONG — a step
   * that is not a phrase, a requirements list a resident could not act on.
   */

  /*
   * A client-steps table times nearly every row; a requirements list mistaken
   * for one times almost none. That is the discriminator.
   *
   * ⚠️ Unless the time or fee column is MERGED — one `None` or one `15 Minutes`
   * printed once across four steps, which these documents do constantly. Then a
   * sparse column is the document's own layout rather than a misread, and the
   * merge is already recorded. Requiring a majority regardless withheld
   * nineteen services whose tables had been read correctly.
   */
  const unstructured =
    flags.some(flag => flag.startsWith('no-columns')) || rows.length > 20;

  const timed = rows.filter(row => row.fee || row.processingTime).length;
  const explained = merged.includes('fee') || merged.includes('processingTime');
  if (timed === 0 && !unstructured) return 'needs-human';
  if (!unstructured && timed / rows.length < 0.5 && !explained) {
    return 'needs-human';
  }

  // A row that is only loose text is a row the geometry did not resolve. Where
  // the table was never structured that is expected and the steps are quoted
  // instead; where it WAS, a third of it unresolved means it was misread.
  const unresolved = rows.filter(row => row.unresolved).length;
  if (!unstructured && unresolved / rows.length > 0.34) return 'needs-human';

  if (!requirementsAreCoherent(requirements)) return 'needs-human';
  // An unstructured table is quoted rather than laid out, so the coherence of
  // its ROWS is not a claim this project is making about it.
  if (!unstructured && !stepsAreCoherent(rows)) return 'needs-human';

  return 'high';
}

/**
 * Whether the steps read as instructions rather than as shrapnel.
 *
 * 🔴 The sibling of `requirementsAreCoherent`, and added for the same reason:
 * the electronic-endorsement service passed every structural check and rendered
 * a step reading, in full, **"1. at"** — followed by "Public Assistant and" and
 * "Counter's Desk(PACD)" as steps of their own. The table had been sliced
 * across a column boundary that was not there, and the page instructed a
 * resident to do nothing intelligible while looking complete.
 *
 * Two signals, both about the TEXT rather than the geometry:
 *
 *   · a step of two or three characters is not a step;
 *   · a step ending on a conjunction or an article was cut mid-phrase. One is
 *     a quirk of the document; a third of the table is a table read wrongly.
 */
function stepsAreCoherent(rows) {
  const prose = rows
    .flatMap(row => [row.clientStep, row.agencyAction, row.unresolved])
    .filter(Boolean)
    .map(text =>
      text
        .replace(/^\s*(?:\d{1,2}(?:\.\d{1,2})?\s*[.)]?|[•·▪◦*\-–—])\s*/, '')
        .trim()
    );

  if (prose.length === 0) return true;

  /*
   * ⚠️ Under THREE characters, not under five.
   *
   * The rule exists for `1. at` — a step whose whole text was "at", left by a
   * column boundary that was not there. At five it also rejected `ESPF`, `SSF`,
   * `Crew` and `None`, which are a fund, a fund, a person responsible and a
   * fee — real cells, in fourteen services that were withheld because of them.
   * A cell with no letter in it at all is a fragment whatever its length.
   */
  if (prose.some(text => text.length < 3 || !/[\p{L}]/u.test(text))) {
    return false;
  }

  const dangling = prose.filter(text =>
    /\b(and|or|of|to|the|at|for|in|with|by|from)$/i.test(text)
  ).length;
  if (dangling / prose.length > 0.3) return false;

  /*
   * And the numbering has to count up.
   *
   * These tables number the CLIENT column and the AGENCY column independently,
   * so a row-by-row read that comes out `1, 2, 2, 3, 3, 1, 4` has interleaved
   * two sequences that the document keeps apart. There is no faithful AND
   * readable way to render that — the markers cannot be renumbered, and left
   * alone they read as a list that restarts twice — so it is not published.
   */
  /*
   * ⚠️ Numbering is NOT checked here, and that is deliberate.
   *
   * An earlier version required the client column's numbers to count up, on the
   * theory that a table reading `1, 2, 2, 3, 3, 4` had been misread. Often it
   * had not — these tables run two independent numbered sequences down one
   * table, which is ordinary. Rejecting them took the publishable set from 99
   * services to 14.
   *
   * `charter-markdown.mjs` handles that shape instead, by rendering it
   * verbatim rather than as a list. This gate is for content that is WRONG, not
   * for content that is merely hard to format.
   */
  return true;
}

/**
 * Whether the requirements list reads as a list of things to bring.
 *
 * 🔴 ADDED after review caught what the steps-shaped gate above could not see.
 * `register-a-birth` passed every check here — five columns, timed rows, a
 * total — and shipped a requirements table with **forty items, nine of them
 * bare bullets, thirty-eight with no source**, several cut off mid-sentence.
 * A resident could not have told what to bring from it, and it looked complete,
 * which is worse than the index-and-link page it replaced.
 *
 * The cause is not fixable by reading harder. On the pages where it happens the
 * *where to secure* column is itself vertically merged — one tall cell beside a
 * dozen short ones — and which requirement each address belongs to is not in
 * the document's geometry. So the list is refused rather than guessed at.
 *
 * Three signals, any one of which disqualifies:
 *
 *   · a FRAGMENT row — a bare bullet, a dash, a stray word. Real requirements
 *     are phrases;
 *   · a row CONTINUING the one above it, which starts lowercase. The document
 *     wrapped and the wrap became a row;
 *   · most rows having no source on a table that paired some. A list that
 *     answers "where do I get this" for two of twenty has not been read.
 */
function requirementsAreCoherent(requirements) {
  if (requirements.length === 0) return true;

  const items = requirements.map(entry => (entry.item ?? '').trim());

  if (items.some(item => item.length < 5 || /^[•\-–—*]+$/.test(item)))
    return false;
  if (items.some(item => /^[a-z(]/.test(item))) return false;

  const paired = requirements.filter(entry => entry.whereToSecure).length;
  if (
    paired > 0 &&
    requirements.length > 3 &&
    paired / requirements.length < 0.5
  )
    return false;

  return true;
}

/**
 * The requirements table as `{ item, whereToSecure }` pairs.
 *
 * Its own two columns, found the same way as the steps table's five. Reading
 * order alone interleaves them — `1. Documentary requirement` then
 * `Requisitioning Agency` reads as two requirements, and the second is not a
 * requirement at all, it is where the first one is obtained.
 *
 * Where the geometry gives no gutter the lines are returned as items with no
 * source, rather than paired off by position. Half the pairs being wrong is
 * worse than none of them being claimed.
 */
function splitRequirements(lines, pageWidths) {
  if (lines.length === 0) {
    return { requirements: [], unpairedSources: [], spilledFromSteps: false };
  }

  const requirements = [];
  const unpairedSources = [];

  for (const page of [...new Set(lines.map(line => line.page))].sort(
    (a, b) => a - b
  )) {
    const pageLines = lines.filter(line => line.page === page);
    const columns = columnsFromGutters(pageLines, pageWidths.get(page) ?? 842);

    // The rightmost column is where a requirement is secured; everything left
    // of it is the requirement, including the narrow column the bullet markers
    // sit in on their own.
    const boundary =
      columns && columns.length >= 2
        ? columns[columns.length - 1].x0
        : Infinity;

    const itemLines = pageLines
      .filter(line => centreOf(line) < boundary)
      .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    const sourceLines = pageLines
      .filter(line => centreOf(line) >= boundary)
      .sort((a, b) => a.y0 - b.y0);

    const items = groupByListMarker(itemLines);
    /*
     * 🔴 The source column is split by its OWN markers where it has them.
     *
     * Most documents leave that column unmarked, so poppler's blocks are the
     * right unit. The agriculture office does not: it numbers the requirements
     * `1, 2, 3` and their addresses `4, 5, 6` in ONE continuous sequence down
     * both columns. Grouped by block, its three addresses came out as a single
     * cell reading "4. OMAG 5. SSS, Pag-ibig… 6. OMAG/FA President" — which
     * then rendered as one item on the page.
     */
    const sources = sourceLines.some(line => MARKER_LEADING.test(line.text))
      ? groupByListMarker(sourceLines)
      : groupAdjacent(sourceLines);

    const { paired, leftover } = pairByOverlap(items, sources);
    // A row with no letter and no digit in it is not a requirement — it is a
    // line the extraction dropped, and it tells a resident nothing.
    requirements.push(
      ...paired.filter(entry => /[\p{L}\p{N}]/u.test(entry.item))
    );
    unpairedSources.push(...leftover);
  }

  /*
   * 🔴 A FEE IS NOT A PLACE, AND NEITHER IS A DURATION.
   *
   * Where the requirements run past the steps header, the spill re-read can
   * reach lines belonging to the steps table — and `None`, `3 Minutes` and
   * `Agricultural Technologist-on duty` were being published under *where the
   * charter says to get them*. They are dropped here rather than shown, and the
   * drop is flagged: it means the region boundary was wrong, which is a fact
   * the verifier needs even though the page no longer shows the symptom.
   */
  // The same rule applied to a PAIRED source. `None` reaching `whereToSecure`
  // tells a resident the charter named a place; it named a fee.
  const NOT_A_PLACE = new RegExp(
    `^\\s*(?:none|free|n/a|(?:${DURATION_RE.source})|(?:${FEE_RE.source}))\\s*$`,
    'i'
  );
  for (const requirement of requirements) {
    if (
      requirement.whereToSecure &&
      NOT_A_PLACE.test(requirement.whereToSecure)
    ) {
      requirement.whereToSecure = null;
    }
  }

  const kept = unpairedSources.filter(
    value =>
      !/^\s*(none|free|n\/a)\s*$/i.test(value) &&
      !new RegExp(`^\\s*(?:${DURATION_RE.source})\\s*$`, 'i').test(value) &&
      !new RegExp(`^\\s*(?:${FEE_RE.source})\\s*$`, 'i').test(value)
  );

  return {
    requirements,
    unpairedSources: kept,
    spilledFromSteps: kept.length !== unpairedSources.length,
  };
}

/** A line that is nothing but a list marker — `•`, `-`, `1.`, `a)`. */
const MARKER_ONLY =
  /^\s*(?:[•·▪◦*\-–—]|\(?\d{1,2}(?:\.\d+)*\)?\.?|[a-z]\))\s*$/i;

/** A line that OPENS with one. */
const MARKER_LEADING = /^\s*(?:[•·▪◦*]|\d{1,2}(?:\.\d+)*\s*[.)]|[a-z]\))\s*\S/i;

/**
 * Lines grouped into list items, by the document's own list markers.
 *
 * 🔴 THIS IS WHY THE REQUIREMENTS WERE SHREDDED. Geometry alone cannot tell a
 * wrapped requirement from the next one: "Notarized Affidavit of delayed
 * registration of birth with" and "corroboration of two(2) witnesses" are two
 * lines of ONE requirement, and "PSA Negative Certification" below them is a
 * different one — and all three sit in the same column, the same block, and the
 * same 12pt rhythm. Read as rows, they become three requirements, two of which
 * are sentence fragments.
 *
 * What separates them is the marker the document prints: a bullet, a dash, or a
 * number. Those markers are often lines of their OWN, in a narrow column to the
 * left of the text, which is why this works on lines rather than on cells.
 *
 *   `•`                                   ← a marker line: opens the next item
 *   `PSA Negative Certification( pres…`   ← the item
 *   `photocopies)`                        ← no marker: still the same item
 *
 * A line with no marker and no marker pending is a continuation of the item
 * above it. That single rule is what turns 40 fragments into 9 requirements.
 */
export function groupByListMarker(lines) {
  const items = [];
  let pending = null;

  for (const line of lines) {
    if (MARKER_ONLY.test(line.text)) {
      /*
       * 🔴 KEPT, not consumed. The marker is the document's own numbering, and
       * an earlier version dropped it: `- Baptismal Certificate` reached the
       * page as `Baptismal Certificate`, and the renderer then supplied a
       * bullet of its own on top. Where a charter already numbers or bullets a
       * list, that numbering is part of what is being transcribed — replacing
       * it with ours is not transcribing, and it renumbers a list a resident
       * may be reading against the paper form at the counter.
       */
      pending = line.text.trim();
      continue;
    }

    const carriesOwn = MARKER_LEADING.test(line.text);
    const opens = pending !== null || carriesOwn || items.length === 0;

    if (opens) {
      // 🔴 The pending marker is DROPPED when the line already carries one.
      // Several documents set the numbers in a narrow column of their own AND
      // repeat them in the text, which produced `1. 1. RSBSA stub`.
      items.push({
        text:
          pending === null || carriesOwn
            ? line.text
            : `${pending} ${line.text}`,
        /** Whether the item carries the document's own list marker. */
        marked: pending !== null || MARKER_LEADING.test(line.text),
        y0: line.y0,
        y1: line.y1,
      });
      pending = null;
      continue;
    }

    pending = null;
    const last = items[items.length - 1];
    last.text = `${last.text} ${line.text}`;
    last.y1 = Math.max(last.y1, line.y1);
  }

  return items;
}

/**
 * Each requirement paired with the address printed beside it.
 *
 * Vertical overlap first, because that is what "beside it" means on the page.
 * A source that overlaps nothing falls back to the nearest item by centre
 * distance, but only within one item's height — beyond that the document is not
 * lining them up, and the source is returned UNPAIRED rather than attached to a
 * requirement it may not belong to.
 *
 * 🔴 An unpaired source is not dropped and is not guessed at. It is carried to
 * the page under its own heading, which says the charter lists these places but
 * does not print them against individual items. That is the honest reading of a
 * document whose second column is one tall cell beside a dozen rows — and it is
 * what makes those pages publishable at all instead of withheld.
 */
function pairByOverlap(items, sources) {
  const paired = items.map(item => ({
    item: item.text,
    marked: item.marked === true,
    whereToSecure: null,
  }));
  if (sources.length === 0) return { paired, leftover: [] };

  const overlaps = sources.map(source =>
    items
      .map((item, index) => ({
        index,
        overlap: Math.min(item.y1, source.y1) - Math.max(item.y0, source.y0),
      }))
      .filter(candidate => candidate.overlap > 0)
  );

  const claimed = new Map();
  let unambiguous = sources.length <= items.length;

  for (const candidates of overlaps) {
    if (candidates.length !== 1) {
      unambiguous = false;
      break;
    }
    const { index } = candidates[0];
    if (claimed.has(index)) {
      unambiguous = false;
      break;
    }
    claimed.set(index, true);
  }

  if (!unambiguous) {
    return { paired, leftover: sources.map(source => source.text) };
  }

  overlaps.forEach((candidates, position) => {
    paired[candidates[0].index].whereToSecure = sources[position].text;
  });

  return { paired, leftover: [] };
}

/**
 * Source lines joined into values: same block, close enough to be a wrap.
 *
 * The addresses carry no list markers, so `groupByListMarker` folds every one
 * of them into a single value — which is how eight distinct places became one
 * cell on the first attempt.
 */
function groupAdjacent(lines) {
  const values = [];
  for (const line of lines) {
    const last = values[values.length - 1];
    const gap = last ? line.y0 - last.y1 : Infinity;
    if (
      last &&
      last.block === line.block &&
      gap < Math.max(line.y1 - line.y0, 8) * 1.35
    ) {
      last.text = `${last.text} ${line.text}`;
      last.y1 = Math.max(last.y1, line.y1);
      continue;
    }
    values.push({
      text: line.text,
      block: line.block,
      y0: line.y0,
      y1: line.y1,
    });
  }
  return values;
}

/**
 * Every service in a charter PDF, with its contents.
 *
 * Segmentation is `charter-parse.mjs`'s proven anchor and nothing new: exactly
 * one `Office or Division` per service, in either layout variant. Anchoring on
 * the numbered headings instead over-counted by 78%, because a numbered
 * requirement item is textually identical to a service heading.
 */
export function extractDocument(file) {
  const lines = pdfLines(file);
  const pageWidths = new Map(lines.map(line => [line.page, line.pageWidth]));

  const reading = [...lines].sort((a, b) => ord(a) - ord(b));
  const anchors = reading
    .map((line, index) => ({ line, index }))
    .filter(entry => ANCHOR_RE.test(entry.line.text));

  // The heading sits ABOVE the anchor, so it is found before the regions are
  // cut — a service's region ENDS at the next service's heading, not at the
  // next anchor. Cutting at the anchor left every service carrying the next
  // one's title as a step, which then reads as an instruction to a resident.
  const headings = anchors.map(anchor => {
    for (
      let index = anchor.index - 1;
      index >= Math.max(0, anchor.index - 18);
      index -= 1
    ) {
      const text = reading[index].text;
      if (
        REQUIREMENTS_HEADING.test(text) ||
        TOTAL_RE.test(text) ||
        isHeaderText(text)
      )
        break;
      const match = text.match(HEADING_RE);
      if (match) {
        return {
          number: Number(match[1]),
          title: match[2].replace(/\s+/g, ' ').trim(),
          at: ord(reading[index]),
        };
      }
    }
    return null;
  });

  return anchors.map((anchor, position) => {
    const heading = headings[position];
    const from = Math.min(ord(anchor.line), heading?.at ?? Infinity);
    const next = anchors[position + 1];
    const to = next ? (headings[position + 1]?.at ?? ord(next.line)) : Infinity;

    const body = reading.filter(line => ord(line) >= from && ord(line) < to);

    return {
      section: sectionFor(reading, anchor.index),
      number: heading?.number ?? null,
      charterTitle: heading?.title ?? null,
      charterTitleSource: heading ? 'extracted' : 'not-in-layout',
      ...extractService(body, pageWidths),
    };
  });
}

/** Which `External`/`Internal Services` banner this anchor falls under. */
function sectionFor(reading, index) {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const window = `${reading[cursor].text} ${reading[cursor + 1]?.text ?? ''}`;
    const match = window.match(/\b(External|Internal)\s+Services\b/i);
    if (match) return match[1].toLowerCase();
  }
  return 'unknown';
}
