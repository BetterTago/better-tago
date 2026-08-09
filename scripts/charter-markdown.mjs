/**
 * The charter's own lists, rendered as markdown that does not change them.
 *
 * These documents number things, and the numbers are not decoration — a
 * resident may be reading this page beside the paper form on the counter, and
 * an office may be reading "requirement 7" back to them over the phone. So the
 * one rule this module exists to keep is:
 *
 *   🔴 EVERY MARKER ON THE PAGE IS THE ONE THE DOCUMENT PRINTED.
 *      Nothing is renumbered, nothing is supplied where the document supplied
 *      one, and nothing is dropped.
 *
 * That is harder than it sounds, because markdown renumbers ordered lists by
 * design. `1. 2. 3.` survives a round trip; `1, 2, 4, 5` comes back as
 * `1, 2, 3, 4`, and `1, 1, 1` comes back as `1, 2, 3` — silently, in the
 * renderer, long after anybody reviewed the file. Eleven of these charters
 * number lists that do not count up, including one that reads `1, 1, 1` and one
 * that starts at 7.
 *
 * ⚠️ SCOPE, since 2026-08-10: this module formats the ONE charter list still
 * rendered as a markdown list — the *where to secure* addresses a document
 * prints beside the list as a whole. Everything else on a service page is the
 * charter's own tables, where markdown has no list to renumber. A `renderSteps`
 * lived here for the version that laid steps out as a list; it was deleted with
 * that version rather than left as a dead alternative.
 *
 * ─── SO IT FORMATS ONLY WHAT IT CAN FORMAT FAITHFULLY ────────────────────────
 *
 * Every entry point returns `{ mode, lines }`, and the mode is the whole
 * design:
 *
 *   **`list`** — the structure is one markdown reproduces exactly, so it is
 *   rendered as a real list and reads like one.
 *
 *   **`verbatim`** — it is not, so nothing is attempted. The transcription goes
 *   onto the page as it came out of the document, line for line.
 *
 * 🔴 Verbatim is not a failure state. It is the answer for a document whose
 * structure markdown cannot hold, and both alternatives were tried first and
 * were worse: formatting those tables anyway renumbered them, and refusing to
 * publish them took the set from 99 services to 14. What a resident needs is
 * the document's own words, complete and in order — not a tidier arrangement of
 * them, and not silence.
 *
 * WHAT `list` MODE CAN REPRODUCE:
 *
 * **A consecutive numbered run.** CommonMark takes an ordered list's start from
 * its first item and counts up, so `7. 8.` renders as 7 and 8. Exact.
 *
 * **A sub-number — `2.1`, `2.2`** → an indented paragraph under its parent, not
 * escaped and not a list. It needs neither: a CommonMark ordered-list marker is
 * digits then `.` or `)` then a SPACE, and `2.1 ` has a digit after the dot, so
 * it can never be parsed as a marker and can never be renumbered.
 *
 * **Bullets and dashes** → nested list items. That swaps `•` for the renderer's
 * own bullet glyph, which is a rendering of the same marker rather than a
 * renumbering of it — no item's identity changes.
 *
 * Anything else is `verbatim`.
 */

/** A sub-number: `2.1`, `3.10`. Checked FIRST — see `readMarker`. */
const SUB = /^\s*(\d{1,2})\.(\d{1,2})\s*\.?\s*(\S[\s\S]*)$/;

/** A top-level number: `1.`, `7)`, and `1.Original` with no space. */
const NUMBER = /^\s*(\d{1,2})\s*[.)]\s*(\S[\s\S]*)$/;

/**
 * A bullet the document prints.
 *
 * `*` requires whitespace after it, unlike the other glyphs. Without that,
 * `**You:** Submit…` — the label this project adds to a step — parses as a
 * bullet whose text is `*You:** Submit…`, eating one asterisk and breaking the
 * bold. A real bullet is always followed by space.
 */
const BULLET = /^\s*(?:([•·▪◦])\s*|(\*)\s+)(\S[\s\S]*)$/;

/** A dash, which these charters use one level below a bullet. */
const DASH = /^\s*[-–—]\s+(\S[\s\S]*)$/;

/**
 * The document's own marker, and the text after it.
 *
 * 🔴 SUB-NUMBERS ARE MATCHED FIRST. Read top-level-first, `2.1 Check the
 * requirement` parses as item **2** whose text begins "1 Check the
 * requirement" — a digit silently eaten, and the hierarchy the document drew
 * flattened into a single level.
 */
export function readMarker(text) {
  const value = String(text ?? '');

  const sub = value.match(SUB);
  if (sub) {
    return {
      kind: 'sub',
      marker: `${sub[1]}.${sub[2]}`,
      parent: Number(sub[1]),
      text: sub[3],
    };
  }

  const numbered = value.match(NUMBER);
  if (numbered) {
    return {
      kind: 'number',
      marker: numbered[1],
      value: Number(numbered[1]),
      text: numbered[2],
    };
  }

  const bullet = value.match(BULLET);
  if (bullet) {
    return { kind: 'bullet', marker: bullet[1] ?? bullet[2], text: bullet[3] };
  }

  const dash = value.match(DASH);
  if (dash) return { kind: 'dash', marker: '-', text: dash[1] };

  return { kind: 'none', marker: null, text: value };
}

/** Whether a run of top-level numbers is one markdown can reproduce. */
export function isConsecutive(numbers) {
  return numbers.every(
    (value, index) => index === 0 || value === numbers[index - 1] + 1
  );
}

/** `4.` → `4\.` — the CommonMark escape that stops a list from forming. */
const escapeMarker = text =>
  text.replace(
    /^(\s*)(\d{1,2})([.)])/,
    (_, space, number, dot) => `${space}${number}\\${dot}`
  );

const INDENT = '   ';

/**
 * ─── THE TWO MODES, AND THE LINE BETWEEN THEM ────────────────────────────────
 *
 * **`list`** — the charter's structure is one markdown can reproduce exactly,
 * so it is rendered as a real list and reads like one.
 *
 * **`verbatim`** — it is not, so nothing is attempted. The transcription goes
 * onto the page as it came out of the document, line for line, and this project
 * stops trying to improve it.
 *
 * 🔴 The second mode is not a failure state, it is the honest one. A charter
 * that numbers `1, 1, 1`, or that runs two numbered sequences down one table,
 * has a structure markdown cannot hold — and every attempt to hold it anyway
 * either renumbered the list or dropped a line. What a resident needs from
 * those sections is the document's own words, complete and in order, not a
 * tidier arrangement of them.
 *
 * Verbatim lines are emitted as blockquote paragraphs. That is the one shape
 * that survives everything: `>` stops `prettier` from re-indenting or
 * re-wrapping, the escape stops markdown from reading a marker as a list, and a
 * blank `>` between lines keeps them from running together. It also reads as
 * what it is — a passage quoted from the municipality's document.
 */

/** The transcription, unchanged, in the one shape nothing downstream rewrites. */
export function renderVerbatim(lines) {
  const kept = lines.filter(line => String(line ?? '').trim() !== '');
  if (kept.length === 0) return [];

  return kept.flatMap((line, index) => {
    const quoted = `> ${escapeMarker(String(line).trim())}`;
    return index === 0 ? [quoted] : ['>', quoted];
  });
}

/**
 * A charter list as markdown.
 *
 * @param {string[]} items  each carrying the document's own marker, if it had one
 * @returns {{mode: 'list'|'verbatim', lines: string[]}}
 */
export function renderList(items) {
  if (items.length === 0) return { mode: 'list', lines: [] };

  const parsed = items.map(readMarker);
  const numbers = parsed
    .filter(entry => entry.kind === 'number')
    .map(entry => entry.value);

  // A run markdown would renumber is not rendered as a list at all.
  if (numbers.length > 0 && !isConsecutive(numbers)) {
    return { mode: 'verbatim', lines: renderVerbatim(items) };
  }

  const nested = numbers.length > 0;
  const out = [];

  for (const entry of parsed) {
    if (entry.kind === 'number') {
      out.push(`${entry.marker}. ${entry.text}`);
    } else if (entry.kind === 'sub') {
      // An indented PARAGRAPH, not a list item: the sub-number is already in
      // the text and adding a bullet in front of it would double the marker.
      out.push('', `${INDENT}${entry.marker} ${entry.text}`);
    } else if (entry.kind === 'bullet') {
      out.push(`${nested ? INDENT : ''}- ${entry.text}`);
    } else if (entry.kind === 'dash') {
      out.push(`${nested ? INDENT.repeat(2) : INDENT}- ${entry.text}`);
    } else {
      out.push(`${nested ? INDENT : ''}- ${entry.text}`);
    }
  }

  return { mode: 'list', lines: out };
}
