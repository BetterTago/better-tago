import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SourceRef } from '@/lib/content-schema';
import { localeState } from '@/test/intl-mock';
import { SourceDocument } from './SourceDocument';

vi.mock('next-intl/server', async () => {
  const { intlServerMock } = await import('@/test/intl-mock');
  return intlServerMock();
});

/*
 * The badge is an async Server Component too, and a promise cannot be a child
 * in a client-side render. Stubbed rather than worked around: this file is
 * about the citation, and VerificationBadge has its own tests.
 */
vi.mock('@/components/content/VerificationBadge', () => ({
  VerificationBadge: ({ verification }: { verification: string }) => (
    <span data-testid="verification-badge">{verification}</span>
  ),
}));

const PUBLISHED: SourceRef = {
  label: { en: 'A published office document', fil: 'Isang dokumento' },
  url: 'https://tago.gov.ph/wp-content/uploads/2024/12/An-Office.pdf',
  documentTitle: 'An Office External Services',
  documentType: 'pdf',
  retrievedAt: '2026-08-09',
};

describe('SourceDocument', () => {
  beforeEach(() => {
    localeState.current = 'en';
  });

  it('names the document, the office and the day it was retrieved', async () => {
    render(
      await SourceDocument({
        source: PUBLISHED,
        verification: 'V3',
        office: 'An Office',
      })
    );

    expect(screen.getByText('An Office External Services')).toBeInTheDocument();
    expect(screen.getByText(/An Office$/)).toBeInTheDocument();
    expect(screen.getByText(/August 9, 2026/)).toBeInTheDocument();
  });

  it('links the official original, safely', async () => {
    render(await SourceDocument({ source: PUBLISHED, verification: 'V3' }));
    const link = screen.getByRole('link');

    expect(link).toHaveAttribute('href', PUBLISHED.url);
    expect(link).toHaveAttribute('target', '_blank');
    // A new tab with an opener is a real, if small, hole. It is also the kind
    // of attribute a refactor drops silently.
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('cites a source with no public address instead of linking nothing', async () => {
    /*
     * A letter, a notice posted at the hall, a photograph of a board. Omitting
     * the block would make the page read as an uncited claim; a dead `href`
     * would be worse. The citation renders, and it says what channel it came
     * through.
     */
    render(
      await SourceDocument({
        source: {
          label: { en: 'A notice posted at the municipal hall' },
          url: null,
          documentType: 'notice',
          retrievedAt: '2026-08-09',
        },
        verification: 'V2',
      })
    );

    expect(screen.queryByRole('link')).toBeNull();
    expect(
      screen.getByText(/A notice posted at the municipal hall/)
    ).toBeInTheDocument();
    expect(screen.getByText(/no public web address/i)).toBeInTheDocument();
  });

  it('always carries the deference statement', async () => {
    // "Where this page and that document disagree, the document is right." It
    // is the sentence that makes the citation mean something, and there is no
    // prop that can suppress it.
    render(await SourceDocument({ source: PUBLISHED, verification: 'V3' }));
    expect(screen.getByText(/the document is right/i)).toBeInTheDocument();
  });

  it('shows the verification level rather than hiding it', async () => {
    render(await SourceDocument({ source: PUBLISHED, verification: 'V1' }));
    expect(screen.getByTestId('verification-badge')).toHaveTextContent('V1');
  });

  it('falls back to the English label when Filipino has none', async () => {
    localeState.current = 'fil';
    render(
      await SourceDocument({
        source: {
          label: { en: 'An English-only label' },
          url: null,
          documentType: 'letter',
          retrievedAt: '2026-08-09',
        },
        verification: 'V2',
      })
    );

    expect(screen.getByText('An English-only label')).toBeInTheDocument();
  });

  it('cannot be rendered without a source', () => {
    /*
     * ★ TAGO-103's last criterion, and it is a TYPE guarantee rather than a
     * runtime one: "impossible by construction, not by review". If `source`
     * ever becomes optional or nullable this line starts compiling and
     * `npm run typecheck` fails — which is the assertion.
     */
    // @ts-expect-error — a page with no source cannot call this component.
    void (() => SourceDocument({ verification: 'V3' }));
    // @ts-expect-error — nor can it pass an empty one.
    void (() => SourceDocument({ source: null, verification: 'V3' }));
    expect(true).toBe(true);
  });
});
