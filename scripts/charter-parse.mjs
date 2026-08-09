/**
 * Parsing a Citizen's Charter PDF, as text, into a list of services.
 *
 * Separate from the harvester so it can be tested against fixtures without a
 * network or a PDF. It is the riskiest code in the harvest — two rounds of
 * quiet, plausible-looking wrong answers came out of it — so it is the part
 * that gets tests.
 *
 * TWO LAYOUT VARIANTS, and the difference is not cosmetic. The executive
 * offices write `Office or Division:` with a colon and number their services.
 * The two legislative documents write `OFFICE OR DIVISION` in caps with no
 * colon, put the section name on the same line as the office name, and — in
 * one case — carry no numbered headings at all.
 */

/** Matches anywhere on a line, so `<Office> External Services` is caught. */
const SECTION_RE = /\b(External|Internal)\s+Services\b/i;
const HEADING_RE = /^\s*(\d{1,2})\.\s+(\S.*?)\s*$/;

/** `Label:  value` or `LABEL    value` — both variants, one pattern. */
const fieldRe = label =>
  new RegExp(`^\\s*${label}\\s*(?::\\s*|\\s{2,})(\\S.*?)\\s*$`, 'im');

/**
 * The single anchor: exactly one per service, in either layout.
 *
 * Anchoring on numbered headings was tried first and silently over-counted by
 * 78% — numbered requirement items ("1. Letter of Request") are textually
 * identical to service headings and no lookahead can separate them. Every
 * service has one Office-or-Division field; nothing else in the document does.
 */
const ANCHOR_RE = /^\s*Office\s+or\s+Division\s*(?::|\s{2,})/i;

/** Crossing one of these means we have walked out of this service's block. */
const BOUNDARY_RE = /CHECKLIST\s+OF\s+REQUIREMENTS|^\s*TOTAL\b/i;

/** Page-break furniture pdftotext leaves behind, e.g. "3|Page". */
const isNoise = line => /^\s*\d+\s*\|\s*Page\s*$/i.test(line) || !line.trim();

const state = value => (value ? 'present' : 'absent');

/** Collapses the runs of whitespace `pdftotext -layout` puts between columns. */
const tidy = value => value.replace(/\s+/g, ' ').trim();

/**
 * The table's column-header row, flattened.
 *
 * This exists because the header WRAPS and its columns INTERLEAVE. A real row
 * comes out of pdftotext as:
 *
 *     CLIENT STEPS   AGENCY ACTION   FEES TO BE PAID   PROCESSING   PERSON
 *                                                         TIME   RESPONSIBLE
 *
 * so "PROCESSING" and "TIME" are not adjacent, and neither are "FEES TO BE"
 * and "PAID". Matching those as phrases reported a fees or processing-time
 * column as MISSING on 74 of 96 services — which would have been published as
 * a finding about the municipality's charter rather than a bug in this file.
 *
 * Worse, the letter-spacing in some documents puts a space INSIDE a word:
 * `PROCESSIN G` appears in one real charter. So the region is returned with
 * all whitespace stripped, and callers match space-free tokens. Nothing about
 * a column header depends on its spacing.
 */
function headerRegion(lines) {
  const start = lines.findIndex(line => /CLIENT\s+STEPS/i.test(line));
  if (start === -1) return '';
  return lines
    .slice(start, start + 3)
    .join(' ')
    .replace(/\s+/g, '');
}

/**
 * Walks back from a service's field block to the numbered heading that titles
 * it, stopping at the previous service's table so a requirement item can never
 * be mistaken for a title. Returns null when the layout carries no heading —
 * a fact about the document, not a failure to try harder.
 */
function titleAbove(lines, anchor) {
  for (let index = anchor - 1; index >= Math.max(0, anchor - 15); index -= 1) {
    const line = lines[index];
    if (BOUNDARY_RE.test(line)) return null;
    const heading = line.match(HEADING_RE);
    if (heading) return { number: Number(heading[1]), title: tidy(heading[2]) };
  }
  return null;
}

/**
 * Which section a line declares, if any. Tested over a two-line window because
 * one document wraps `... Public Employment Office Division External` /
 * `Services` across a line break, which left its three services with no
 * section at all.
 */
function sectionAt(lines, index) {
  const window = `${lines[index]} ${lines[index + 1] ?? ''}`;
  return window.match(SECTION_RE)?.[1].toLowerCase() ?? null;
}

/**
 * The document half of a service id: the filename, lowercased and hyphenated.
 *
 * `Office-of-the-Municipal-Civil-Registrar.pdf`
 *   → `office-of-the-municipal-civil-registrar`
 */
export function documentStem(file) {
  return file
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Stamps each service with a stable id: `<document-stem>#<section>-<ordinal>`.
 *
 * WHY THIS EXISTS. The obvious key — document + section + the charter's own
 * printed number — COLLIDES. Across the real charter it yields 159 distinct
 * keys for 167 services: one office prints `10` twice, two documents carry no
 * numbers at all, and one prints `1 2 3 4 5 6 10 7 8 9 10 11 12 13` for
 * fourteen services. That numbering is data ABOUT the document, faithfully
 * captured, and it is not an identifier.
 *
 * The failure it causes is silent. Anything keyed on a colliding field — the
 * task-title vocabulary above all — assigns one service's title to a different
 * service, and the mistake surfaces much later as a wrong fee on a page a
 * resident acted on. So `number` stays exactly as printed, and `id` is ours.
 *
 * The ordinal is the service's position within its document and section, in
 * parse order. **It is stable only while the document is** — a revision that
 * inserts a service shifts every ordinal after it, which is precisely what the
 * archived `sha256` exists to make detectable before anyone trusts an id again.
 *
 * @param {string} file      the PDF filename, e.g. `Municipal-Health-Office.pdf`
 * @param {Array<object>} services  the parsed services, in document order
 */
export function withServiceIds(file, services) {
  const stem = documentStem(file);
  const counts = new Map();

  return services.map(service => {
    const ordinal = (counts.get(service.section) ?? 0) + 1;
    counts.set(service.section, ordinal);
    return { id: `${stem}#${service.section}-${ordinal}`, ...service };
  });
}

/** @returns {Array<object>} one entry per service, in document order. */
export function parseCharter(text) {
  const lines = text.split('\n');

  const anchors = [];
  let section = null;
  lines.forEach((line, index) => {
    section = sectionAt(lines, index) ?? section;
    if (ANCHOR_RE.test(line)) anchors.push({ index, section });
  });

  return anchors.map((anchor, position) => {
    const end = anchors[position + 1]?.index ?? lines.length;
    const body = lines.slice(anchor.index, end).filter(line => !isNoise(line));
    const block = body.join('\n');
    const header = headerRegion(body);

    const field = label => block.match(fieldRe(label))?.[1];
    const office = field('Office\\s+or\\s+Division');
    const eligibility = field('Who\\s+may\\s+avail');
    const classification = field('Classification');
    const heading = titleAbove(lines, anchor.index);

    return {
      section: anchor.section ?? 'unknown',
      number: heading?.number ?? null,
      title: heading?.title ?? null,
      // A titleless service is real and must be named by a human from the page
      // before it can become anything. Flagged rather than filled in.
      titleStatus: heading ? 'extracted' : 'not-in-layout',
      office: office ? tidy(office) : null,
      classification: classification ? tidy(classification) : null,
      fields: {
        eligibility: state(eligibility),
        requirements: state(/CHECKLIST\s+OF\s+REQUIREMENTS/i.test(block)),
        fees: state(/FEESTOBE/i.test(header)),
        processingTime: state(/PROCESSIN/i.test(header)),
        owningOffice: state(office),
        // The national charter layout has no output or deliverable field. The
        // service title usually implies it, and inferring one from the title
        // would be a guess presented as a fact — so it is recorded as missing.
        output: state(/^\s*Output\s*(?::|\s{2,})/im.test(block)),
      },
    };
  });
}
