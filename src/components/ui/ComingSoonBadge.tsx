import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * "Soon" — the marker on a destination that does not exist yet.
 *
 * One component rather than a class string copied into every call site: the
 * badge appears in the header nav, the mobile sheet and both footer link
 * columns, and those drift apart the moment they are written twice.
 *
 * Gold ground, deep-green ink. `--ink-on-accent` is declared once on `:root`
 * and is re-declared by neither the dark theme nor any surface scope, so the
 * pair is 12.02:1 wherever the badge lands, in either theme.
 *
 * The state is never colour alone: the word IS the badge.
 *
 * `tone="on-accent"` inverts the pair for a badge sitting ON a gold ground,
 * where gold-on-gold would vanish — same two colours, same ratio, same size, so
 * every badge on the page reads as one thing.
 */
export function ComingSoonBadge({
  className,
  tone = 'accent',
}: {
  className?: string;
  tone?: 'accent' | 'on-accent';
}) {
  const t = useTranslations('common');

  return (
    <span
      className={cn(
        // `pe-1` against `ps-1.5`: `tracking-caps` hangs 0.1em of letter-spacing
        // off the final glyph, which at this size reads as a visibly off-centre
        // pill unless the trailing padding is taken back.
        //
        // `whitespace-nowrap` because the badge is two words in Filipino
        // ("Malapit na") and one in English. In a narrow container it split
        // across two lines and the pill grew a second row.
        'inline-flex items-center rounded-full py-0 ps-1.5 pe-1 text-2xs font-semibold tracking-caps whitespace-nowrap uppercase',
        tone === 'on-accent'
          ? 'bg-ink-on-accent text-accent-400'
          : 'bg-accent-400 text-ink-on-accent',
        className
      )}
    >
      {t('comingSoon')}
    </span>
  );
}
