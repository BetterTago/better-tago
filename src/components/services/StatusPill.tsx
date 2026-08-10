import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';

/**
 * The one thing a service row says about itself: whether the charter's
 * requirements, fees and steps are on the page yet.
 *
 * 🔴 **The state is carried by the WORDS.** A reader who cannot tell the green
 * ground from the amber one still reads "Not yet transcribed", which is the
 * whole point of publishing an untranscribed service rather than hiding it: the
 * service exists, this office provides it, and this portal does not yet carry
 * the detail. Colour is the second signal, never the first — `theme-tokens.test`
 * measures both pills as text at 4.5:1.
 *
 * ⚠️ As of 2026-08-10 the amber branch has **no live instance** — all 97 records
 * carry `content`. It is covered by a unit test against a synthetic record
 * rather than by an e2e test, which would pass vacuously by rendering nothing.
 */
export async function StatusPill({
  transcribed,
  className,
}: {
  transcribed: boolean;
  className?: string;
}) {
  const t = await getTranslations('services');

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-2xs font-semibold',
        transcribed
          ? 'bg-pill-ok-bg text-pill-ok-ink'
          : 'bg-pill-gap-bg text-pill-gap-ink',
        className
      )}
    >
      {/* The category, for a reader meeting the pill with no context. Visible
          text would repeat what the pill already says. */}
      <span className="sr-only">{t('pillLabel')}: </span>
      {transcribed ? t('pillTranscribed') : t('pillNotTranscribed')}
    </span>
  );
}
