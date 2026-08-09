import { describe, expect, it } from 'vitest';

import { isConsecutive, readMarker, renderList } from './charter-markdown.mjs';

/**
 * The formatter's one job is that a marker on the page is the marker the
 * document printed. Every case here is one this archive actually contains, and
 * most of them are ones that shipped wrong before the module existed.
 */

describe('reading the document’s own marker', () => {
  it('takes a sub-number as a sub-number, not as its first digit', () => {
    // Read top-level-first, `2.1 Check…` parses as item 2 whose text starts
    // "1 Check…" — a digit eaten, and a two-level list flattened to one.
    expect(readMarker('2.1 Check the requirement')).toMatchObject({
      kind: 'sub',
      marker: '2.1',
      parent: 2,
      text: 'Check the requirement',
    });
  });

  it('reads a number with no space after the dot', () => {
    // The charters write `1.Original Immunization Card` as often as `1. `.
    expect(readMarker('1.Original Immunization Card')).toMatchObject({
      kind: 'number',
      value: 1,
      text: 'Original Immunization Card',
    });
  });

  it('reads bullets and dashes, which nest one under the other', () => {
    expect(readMarker('• PSA Negative Certification')).toMatchObject({
      kind: 'bullet',
      text: 'PSA Negative Certification',
    });
    expect(readMarker('- Baptismal Certificate')).toMatchObject({
      kind: 'dash',
      text: 'Baptismal Certificate',
    });
  });

  it('reports no marker where the document printed none', () => {
    expect(readMarker('Letter of Request')).toMatchObject({
      kind: 'none',
      marker: null,
    });
  });
});

describe('which runs markdown can reproduce', () => {
  it('accepts a run that counts up, whatever it starts at', () => {
    // CommonMark takes an ordered list's start from its first item.
    expect(isConsecutive([1, 2, 3])).toBe(true);
    expect(isConsecutive([7, 8])).toBe(true);
  });

  it('refuses a run with a gap, or one that repeats', () => {
    // Both are real: one charter skips 6, another reads 1, 1, 1.
    expect(isConsecutive([1, 2, 3, 4, 5, 7])).toBe(false);
    expect(isConsecutive([1, 1, 1])).toBe(false);
  });
});

describe('a list markdown can reproduce', () => {
  it('renders a consecutive run as an ordered list', () => {
    expect(renderList(['1. First', '2. Second', '3. Third']).lines).toEqual([
      '1. First',
      '2. Second',
      '3. Third',
    ]);
  });

  it('keeps a run that starts at seven starting at seven', () => {
    expect(renderList(['7. Animal Screening', '8. Vaccination']).lines).toEqual(
      ['7. Animal Screening', '8. Vaccination']
    );
  });

  it('nests bullets and dashes under the numbered item they follow', () => {
    expect(
      renderList([
        '4. Additional Requirement for late registration:',
        '• PSA Negative Certification',
        '- Baptismal Certificate',
        '5. Valid Identification Card',
      ]).lines
    ).toEqual([
      '4. Additional Requirement for late registration:',
      '   - PSA Negative Certification',
      '      - Baptismal Certificate',
      '5. Valid Identification Card',
    ]);
  });

  it('supplies a bullet only where the document supplied no marker at all', () => {
    expect(
      renderList(['Letter of Request', 'Endorsement from the LCE']).lines
    ).toEqual(['- Letter of Request', '- Endorsement from the LCE']);
  });
});

describe('🔴 what markdown would renumber is not formatted at all', () => {
  it('reports verbatim mode rather than building a list', () => {
    // Rendered as an ordered list, `1, 2, 4` comes back `1, 2, 3`. So it is
    // not rendered as a list: the transcription goes on the page as captured.
    expect(renderList(['1. First', '2. Second', '4. Fourth']).mode).toBe(
      'verbatim'
    );
    expect(renderList(['1. First', '2. Second', '3. Third']).mode).toBe('list');
  });

  it('quotes every line, with its own number, in the document’s order', () => {
    const { lines } = renderList(['1. First', '2. Second', '4. Fourth']);
    expect(lines.filter(line => line !== '>')).toEqual([
      '> 1\\. First',
      '> 2\\. Second',
      '> 4\\. Fourth',
    ]);
  });

  it('keeps a run that repeats a number exactly as printed', () => {
    // The nutrition referral's charter numbers three requirements `1, 1, 1`.
    const { lines } = renderList(['1. One', '1. Two', '1. Three']);
    const quoted = lines.filter(line => line !== '>');
    expect(quoted).toEqual(['> 1\\. One', '> 1\\. Two', '> 1\\. Three']);
    expect(quoted.join('\n')).not.toMatch(/2\\?\./);
    expect(quoted.join('\n')).not.toMatch(/3\\?\./);
  });

  it('separates the quoted lines so they cannot run together', () => {
    // `prettier` strips trailing whitespace from markdown, so a hard break is
    // not a durable separator — a bare `>` between paragraphs is.
    const { lines } = renderList(['1. One', '3. Three']);
    expect(lines).toContain('>');
    expect(lines.every(line => !/ {2}$/.test(line))).toBe(true);
  });

  it('survives being a blockquote — nothing downstream re-indents it', () => {
    const { lines } = renderList(['1. One', '3. Three']);
    expect(lines.every(line => line.startsWith('>'))).toBe(true);
  });
});
