import {
  BadgeCheck,
  CircleHelp,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { Verification } from '@/lib/content-schema';
import { cn } from '@/lib/utils';

/**
 * How well a fact is stood up, said in words a resident can act on.
 *
 * `V3` on a page is a code this project invented for its own records; it tells
 * a reader nothing and it looks like a grade. The badge therefore renders the
 * SENTENCE — "read from the municipality's own published document" — and the
 * code never reaches the page at all.
 *
 * 🔴 The level is carried by the text, not by the colour or the icon. A reader
 * who cannot distinguish the amber from the grey still reads "unconfirmed",
 * which is the whole point of labelling a V0 rather than withholding it: the
 * schema lets safety-critical information ship at V0 ONLY while it is labelled,
 * and a label that depends on colour is not one.
 */

const LEVEL = {
  V3: { key: 'v3', Icon: ShieldCheck },
  V2: { key: 'v2', Icon: BadgeCheck },
  V1: { key: 'v1', Icon: CircleHelp },
  V0: { key: 'v0', Icon: TriangleAlert },
} as const satisfies Record<
  Verification,
  { key: string; Icon: typeof ShieldCheck }
>;

export async function VerificationBadge({
  verification,
  className,
}: {
  verification: Verification;
  className?: string;
}) {
  const t = await getTranslations('verification');
  const { key, Icon } = LEVEL[verification];
  const unconfirmed = verification === 'V0';

  return (
    // A `<span>`, not a `<p>`. This is an inline badge and it will end up
    // beside prose — a `<p>` nested in a `<p>` is closed early by the parser,
    // which reparents everything after it and is invisible until it isn't.
    <span
      className={cn(
        'inline-flex items-start gap-2 rounded-full border px-3 py-1 text-sm leading-snug',
        unconfirmed
          ? 'border-line-control bg-surface-raised text-ink-accent-strong'
          : 'border-line bg-surface-raised text-ink-secondary',
        className
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        {/* The category, for a reader arriving at the badge with no context —
            visible text would repeat what the sentence already says. */}
        <span className="sr-only">{t('label')}: </span>
        {t(key)}
      </span>
    </span>
  );
}
