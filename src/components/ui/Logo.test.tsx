import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

/**
 * The mark's failure modes are all silent: a duplicated id breaks the SECOND
 * instance's masks while the first still looks right, and an accessible name on
 * the SVG makes a labelled link announce itself twice. Neither shows up in a
 * screenshot, so both are pinned here.
 */
describe('Logo', () => {
  it('is hidden from assistive technology', () => {
    // The wordmark sits beside it everywhere it appears, and its parent link is
    // already labelled. A name here would be read out twice.
    const { container } = render(<Logo idPrefix="solo" />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role', 'img');
    expect(svg).not.toHaveAttribute('aria-label');
  });

  it('namespaces every id it defines, so two instances can coexist', () => {
    const { container } = render(
      <>
        <Logo idPrefix="header" />
        <Logo idPrefix="footer" />
      </>
    );

    const ids = [...container.querySelectorAll('[id]')].map(node => node.id);

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter(id => id.startsWith('header-'))).toHaveLength(
      ids.length / 2
    );
  });

  it('points every internal reference at its own instance', () => {
    // A `url(#…)` or `href="#…"` that escaped the prefix would resolve to the
    // first instance's defs, which renders correctly right up until it doesn't.
    const { container } = render(<Logo idPrefix="scoped" />);
    const svg = container.querySelector('svg')!;
    const references = [
      ...svg.innerHTML.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g),
    ].map(match => match[1] ?? match[2]);

    expect(references.length).toBeGreaterThan(0);
    expect(references.filter(id => !id.startsWith('scoped-'))).toEqual([]);
  });

  it('takes its fills from theme tokens, never a literal', () => {
    // Colour literals are a build failure repo-wide (guardrails.test.ts); this
    // asserts the positive case — that all four fills are actually tokenised.
    const { container } = render(<Logo idPrefix="tokens" />);
    const svg = container.querySelector('svg')!;

    for (const token of [
      'fill-mark-sun',
      'fill-mark-emblem-light',
      'fill-mark-emblem-mid',
      'fill-mark-emblem-deep',
    ]) {
      expect(svg.querySelector(`.${token}`)).not.toBeNull();
    }

    // The masks are the exception, and are luminance rather than colour:
    // `white` keeps, `black` cuts. Tokenising them would punch a hole in the
    // sun, so they are keywords — but nothing else may be.
    expect(svg.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('draws the same geometry as the archived mark', () => {
    /*
     * brand/logo/ is the source of record and this component is a hand-inlined
     * copy of it, which is a fork waiting to happen: a revision that lands in
     * one and not the other ships a portal whose header disagrees with its own
     * brand folder, and nothing else would notice. Framing, curves and the ray
     * construction are all compared.
     */
    const archived = readFileSync(
      path.join(process.cwd(), 'brand/logo/better-tago-color.svg'),
      'utf8'
    );
    const geometry = (markup: string) => ({
      viewBox: /viewBox="([^"]+)"/.exec(markup)?.[1],
      paths: [...markup.matchAll(/\sd="([^"]+)"/g)].map(match => match[1]),
      transforms: [...markup.matchAll(/\stransform="([^"]+)"/g)].map(
        match => match[1]
      ),
    });

    const { container } = render(<Logo idPrefix="record" />);
    const rendered = geometry(container.innerHTML);

    expect(rendered.paths.length).toBe(7);
    expect(rendered).toEqual(geometry(archived));
  });

  it('renders square, at or above the 32px legibility floor', () => {
    const { container } = render(<Logo idPrefix="sized" />);
    const svg = container.querySelector('svg')!;

    expect(Number(svg.getAttribute('width'))).toBeGreaterThanOrEqual(32);
    expect(svg.getAttribute('width')).toBe(svg.getAttribute('height'));
  });
});
