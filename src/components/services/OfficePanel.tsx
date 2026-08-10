import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { lguConfig } from '@/lib/lgu-config';

/**
 * Which office provides this, and where to find it — TAGO-207's half of the
 * page.
 *
 * ## Why several offices, and not one
 *
 * The design sheet draws a single office per category. Six of the eleven
 * categories have two or three: *Treasury and property* alone is split across
 * the accounting, assessor and budget offices. Printing the first one would be a
 * wrong answer for two thirds of the services in that category, so the panel
 * lists every office it finds, with the count each provides.
 *
 * ## What it does not say, and why
 *
 * **No opening hours.** Removed by instruction on 2026-08-10 as not applicable
 * here: this panel answers *who provides this and where do I go*, and a counter
 * time is a different question that belongs to the office directory (TAGO-107)
 * if it belongs anywhere. `contact.municipalHall.officeHours` is `null` with a
 * `pending` register entry, so the fact remains recorded as missing in the one
 * place that tracks missing facts — it is simply not surfaced on a service page.
 *
 * 🔴 What has not changed is the rule underneath it: an unobtained fact is never
 * filled in. A plausible "8:00–17:00" here would send somebody to a closed
 * counter with this portal's name on it, and `services.spec.ts` still fails on
 * any time-shaped string appearing on these pages.
 *
 * The address is the municipal hall's own — true of every office listed, and the
 * only location this project has a source for. The office name is TEXT rather
 * than a link: TAGO-107, the office directory route, has not shipped. When it
 * does, this is the one place to change.
 */
export async function OfficePanel({
  heading,
  offices,
  footer,
}: {
  heading: string;
  /** `count` is omitted on a service page, where there is only this service. */
  offices: { name: string; count?: number }[];
  footer?: ReactNode;
}) {
  const t = await getTranslations('services');
  const hall = lguConfig.contact.municipalHall;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface-raised p-4 sm:p-5">
      <p className="text-2xs font-semibold tracking-label text-ink-tertiary uppercase">
        {heading}
      </p>

      <ul className="flex flex-col gap-1.5">
        {offices.map(office => (
          <li key={office.name} className="flex flex-wrap items-baseline gap-2">
            <span className="font-display font-bold text-ink">
              {office.name}
            </span>
            {office.count !== undefined && (
              <span className="text-2xs tabular-nums text-ink-tertiary">
                {t('officeServiceCount', { count: office.count })}
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="text-sm leading-relaxed text-ink-secondary">
        {hall.address}
      </p>

      {footer && (
        <div className="border-t border-line-subtle pt-2.5">{footer}</div>
      )}
    </div>
  );
}
