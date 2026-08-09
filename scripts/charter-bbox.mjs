/**
 * Reading a Citizen's Charter PDF as GEOMETRY rather than as reflowed text.
 *
 * `charter-parse.mjs` answers "which services are in this document, and does
 * each one HAVE a fees column". This answers "what is IN that column", which is
 * a different and much harder question, and it is the one a resident's money
 * depends on.
 *
 * WHY NOT `pdftotext -layout`. That is what the harvest uses, and it is right
 * for detecting a column and wrong for reading one. `-layout` reflows a table
 * into fixed-width text, and in these documents the cells do not survive it: a
 * vertically-merged `None` in the fees column emits once, on a line of its own,
 * with nothing left to say which rows it covered. Reconstructing rows from that
 * is guesswork, and guesswork here puts a wrong fee on a page somebody acts on.
 *
 * `-bbox-layout` gives every word an x/y box. Columns become arithmetic.
 *
 * LINES, NOT BLOCKS. poppler groups words into lines and lines into blocks, and
 * neither unit is the cell:
 *
 *   - one block, one cell:   "Go to information section then present and
 *                             submit the documentary requirements"  (3 lines)
 *   - one block, TWO cells:  "PROCESSING TIME" / "5 Minutes"        (2 lines,
 *                             a column header and a value poppler merged)
 *
 * So geometry is done per LINE, and lines are re-joined into a cell only when
 * they share a block AND a column. That is what stops a column header being
 * read as a fee.
 *
 * Header MATCHING lives in `charter-values.mjs`, and it compares fragments with
 * all spacing stripped. Not tidiness — necessity: the header wraps
 * ("PROCESSING" on one line, "TIME" on the next) and one real document
 * letter-spaces it into `PROCESSIN G`, with a space inside the word.
 * `charter-parse.mjs` learned that the expensive way, reporting a fees column
 * missing on 74 of 96 services — which would have shipped as a finding about
 * the municipality's charter rather than a bug in a regex.
 */

import { spawnSync } from 'node:child_process';

/** The five columns of the national charter's client-steps table, in order. */
export const STEP_COLUMNS = [
  { key: 'clientStep', match: /^CLIENTSTEPS?$/ },
  { key: 'agencyAction', match: /^AGENCYACTIONS?$/ },
  { key: 'fee', match: /^FEESTOBEPAID$|^FEES?$/ },
  { key: 'processingTime', match: /^PROCESSIN?G?TIME$/ },
  { key: 'personResponsible', match: /^PERSONRESPONSIBLE$/ },
];

/** The two columns of the requirements table. */
export const REQUIREMENT_COLUMNS = [
  { key: 'item', match: /^CHECKLISTOFREQUIREMENTS?$/ },
  { key: 'whereToSecure', match: /^WHERETOSECURE$/ },
];

const XML_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
};

const decode = value =>
  value.replace(
    /&(?:amp|lt|gt|quot|apos|#39);/g,
    entity => XML_ENTITIES[entity] ?? entity
  );

/**
 * Every line in the document, with its page, its block, and its box.
 *
 * Word spacing inside a line is normalised to single spaces — poppler's own
 * inter-word gaps are a rendering artefact, not content, and every downstream
 * comparison is against the same normalisation. Nothing else is touched: no
 * case folding, no currency tidying, no unicode folding. A fee reaches the
 * caller exactly as the document prints it.
 */
export function pdfLines(file) {
  const result = spawnSync('pdftotext', ['-bbox-layout', file, '-'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });

  if (result.error?.code === 'ENOENT') {
    throw new Error(
      'pdftotext not found. Install poppler-utils:\n' +
        '  sudo apt-get install poppler-utils'
    );
  }
  if (result.status !== 0) {
    throw new Error(`pdftotext failed on ${file}: ${result.stderr}`);
  }

  return linesFromXml(result.stdout);
}

/** Split out so the parser can be tested against a fixture, with no PDF. */
export function linesFromXml(xml) {
  const lines = [];
  let page = 0;
  let block = 0;

  for (const pageMatch of xml.matchAll(
    /<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g
  )) {
    page += 1;
    const pageWidth = Number(pageMatch[1]);
    for (const blockMatch of pageMatch[3].matchAll(
      /<block\b[^>]*>([\s\S]*?)<\/block>/g
    )) {
      block += 1;
      for (const lineMatch of blockMatch[1].matchAll(
        /<line\b[^>]*>([\s\S]*?)<\/line>/g
      )) {
        const words = [
          ...lineMatch[1].matchAll(
            /<word xMin="([\d.-]+)" yMin="([\d.-]+)" xMax="([\d.-]+)" yMax="([\d.-]+)"[^>]*>([\s\S]*?)<\/word>/g
          ),
        ];
        if (words.length === 0) continue;

        const text = decode(words.map(word => word[5]).join(' '))
          .replace(/\s+/g, ' ')
          .trim();
        if (!text) continue;

        lines.push({
          page,
          pageWidth,
          block,
          x0: Math.min(...words.map(word => Number(word[1]))),
          y0: Math.min(...words.map(word => Number(word[2]))),
          x1: Math.max(...words.map(word => Number(word[3]))),
          y1: Math.max(...words.map(word => Number(word[4]))),
          text,
        });
      }
    }
  }

  return lines;
}

/** Page-break furniture, e.g. "3|Page" or a bare page number. */
export const isPageFurniture = text =>
  /^\d{1,3}\s*\|\s*Page$/i.test(text) ||
  /^Page\s+\d{1,3}(\s+of\s+\d+)?$/i.test(text);

/**
 * ⚠️ Column detection does NOT live here, and the reason is measured.
 *
 * A header-row slicer was written first, and against the real archive it had no
 * anchor to slice on: of 447 pages, **13** carry all five column headers, 164
 * carry some, and **270 carry none at all**, because the table continues onto
 * pages that do not repeat it. Carrying the previous page's boundaries forward
 * is worse than nothing — the civil registrar's table sits at a different x on
 * page 3 than on page 2, and inherited boundaries put `Php200.00` under
 * processing time.
 *
 * `charter-values.mjs` finds columns from GUTTERS instead — the vertical bands
 * no glyph crosses — which needs no header, and names them from header
 * fragments where a page has them. The header-row slicer is deleted rather than
 * kept beside it: a dead alternative in this file is something a later
 * contributor reaches for, and it does not work.
 */
