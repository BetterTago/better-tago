import { describe, expect, it } from 'vitest';
import { markdownOutline, slugify } from './markdown-outline';

describe('slugify', () => {
  it('produces a fragment that survives being pasted into a message', () => {
    expect(slugify('What the charter calls it')).toBe(
      'what-the-charter-calls-it'
    );
    expect(slugify('If something goes wrong')).toBe('if-something-goes-wrong');
  });

  it('drops the punctuation a charter heading carries', () => {
    expect(slugify('The municipality’s own document')).toBe(
      'the-municipality-s-own-document'
    );
    expect(slugify('Fees — and what they cover')).toBe(
      'fees-and-what-they-cover'
    );
  });

  it('folds diacritics rather than dropping the word', () => {
    expect(slugify('Niño')).toBe('nino');
  });
});

describe('markdownOutline', () => {
  const body = [
    '# Get an employment clearance certification',
    '',
    '> Transcribed from the document below.',
    '',
    '## What the charter calls it',
    '',
    'Some prose.',
    '',
    '## What the charter says',
    '',
    '### Checklist of requirements',
    '',
    '## If something goes wrong',
    '',
    '## The official document',
  ].join('\n');

  it('returns the ## headings, in document order', () => {
    expect(markdownOutline(body)).toEqual([
      { id: 'what-the-charter-calls-it', text: 'What the charter calls it' },
      { id: 'what-the-charter-says', text: 'What the charter says' },
      { id: 'if-something-goes-wrong', text: 'If something goes wrong' },
      { id: 'the-official-document', text: 'The official document' },
    ]);
  });

  it('ignores the h1 and every deeper level', () => {
    const texts = markdownOutline(body).map(heading => heading.text);
    expect(texts).not.toContain('Get an employment clearance certification');
    expect(texts).not.toContain('Checklist of requirements');
  });

  it('strips inline markdown so the rail reads as words', () => {
    expect(markdownOutline('## **Fees** and [where](/x) to pay')).toEqual([
      { id: 'fees-and-where-to-pay', text: 'Fees and where to pay' },
    ]);
  });

  it('gives repeated headings distinct ids', () => {
    // Both rail items would otherwise scroll to the first one, and the second
    // section would be unreachable from the rail entirely.
    expect(markdownOutline('## Fees\n\n## Fees').map(h => h.id)).toEqual([
      'fees',
      'fees-2',
    ]);
  });

  it('skips a ## inside a fenced block', () => {
    const fenced = ['## Real', '', '```', '## Not a heading', '```'].join('\n');
    expect(markdownOutline(fenced).map(heading => heading.text)).toEqual([
      'Real',
    ]);
  });

  it('returns an empty outline for a body with no headings', () => {
    // The rail renders nothing rather than breaking — it is a shortcut to
    // content already on the page, never the only route to it.
    expect(markdownOutline('Just a paragraph.')).toEqual([]);
    expect(markdownOutline('')).toEqual([]);
  });
});
