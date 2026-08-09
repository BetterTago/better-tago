import { ArrowUpRight } from 'lucide-react';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { VerificationBadge } from '@/components/content/VerificationBadge';
import type { SourceRef, Verification } from '@/lib/content-schema';
import { CALENDAR_DATE, calendarDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

/**
 * The link back to the primary record, rendered the same way everywhere.
 *
 * This portal restates a municipality's own published information, and a
 * restatement that hides where it came from is a rumour with better typography.
 * Rendering the citation identically on every page is what makes it believable
 * rather than decorative — a reader learns to look for it once.
 *
 * 🔴 `source` is REQUIRED and non-nullable, and that is the criterion rather
 * than a preference: a page with no source cannot call this component, because
 * the type rejects the call. Nothing here can be switched off by a prop either
 * — there is no `hideLink`, no `compact`, no `showSource`. A component that can
 * be told to omit its citation will one day be told to.
 */

const CHANNEL = {
  web: 'channelWeb',
  pdf: 'channelPdf',
  letter: 'channelLetter',
  notice: 'channelNotice',
  photograph: 'channelPhotograph',
} as const satisfies Record<SourceRef['documentType'], string>;

export async function SourceDocument({
  source,
  verification,
  office,
  className,
}: {
  source: SourceRef;
  verification: Verification;
  /** The office that owns the document, where the record names one. */
  office?: string;
  className?: string;
}) {
  const t = await getTranslations('source');
  const format = await getFormatter();
  const locale = await getLocale();

  /*
   * The document's own title, in the reader's language where the record has
   * one. `documentTitle` is the municipality's filing name and is deliberately
   * preferred: it is the string a resident will see at the top of the PDF, and
   * matching it is how they know they opened the right thing.
   */
  const title =
    source.documentTitle ??
    (locale === 'en' ? source.label.en : (source.label.fil ?? source.label.en));

  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface-sunken p-4 sm:p-5',
        className
      )}
    >
      {/*
       * Deliberately not a heading and deliberately not a labelled region.
       *
       * A heading level chosen here is wrong somewhere: this block sits under
       * an `h1` on one page and under an `h2` on another, and a component that
       * hardcodes its own level breaks the outline of whichever page it guessed
       * wrong about. A labelled region would be worse at scale — ninety-seven
       * service pages each announcing one more landmark is noise, not
       * navigation. The label is a styled paragraph, and the block is read in
       * document order like the citation it is.
       */}
      <p className="text-sm font-semibold tracking-wide text-ink-secondary uppercase">
        {t('heading')}
      </p>

      <p className="mt-2 font-semibold text-ink">{title}</p>

      {office && (
        <p className="mt-1 text-sm text-ink-secondary">
          {t('office', { office })}
        </p>
      )}

      <p className="mt-1 text-sm text-ink-secondary">
        {t('retrieved', {
          date: format.dateTime(
            calendarDate(source.retrievedAt),
            CALENDAR_DATE
          ),
        })}
      </p>

      <div className="mt-3">
        <VerificationBadge verification={verification} />
      </div>

      {source.url ? (
        <a
          href={source.url}
          rel="noopener noreferrer"
          target="_blank"
          className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-ink-link hover:text-ink-link-hover"
        >
          {t('openOriginal')}
          <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
        </a>
      ) : (
        /*
         * A letter, a posted notice, a photograph of a board at the hall. The
         * citation still renders — what it cannot do is pretend to be
         * followable. An omitted block would read as an uncited claim, and an
         * `href` to nothing is worse than either.
         */
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-secondary">
          {t('noPublicAddress', { channel: t(CHANNEL[source.documentType]) })}
        </p>
      )}

      <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-secondary">
        {t('deference')}
      </p>
    </div>
  );
}
