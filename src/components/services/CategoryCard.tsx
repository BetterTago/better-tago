import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * One category on the index — what it holds, how much of it, and three real
 * examples.
 *
 * The three examples are the point. A category title and a count still make a
 * reader open the page to find out whether their task is in it; three actual
 * service names answer that from the index, which is the failure the official
 * charter listing has today.
 *
 * They are the first three entries in manifest order, never a curated set: a
 * `featured` flag would amend the frozen charter record for a cosmetic reason,
 * and a hand-picked list rots the moment a category grows.
 *
 * The example names are `aria-hidden`. They are not links, and hearing three
 * service titles read out after every category label — thirty-three of them on
 * one page — is noise, not navigation.
 */
export async function CategoryCard({
  slug,
  label,
  description,
  count,
  examples,
}: {
  slug: string;
  label: string;
  description: string;
  count: number;
  examples: string[];
}) {
  const t = await getTranslations('services');

  return (
    <Link
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-5 text-ink hover:border-ink-link hover:bg-surface-tint"
      href={`/services/${slug}`}
    >
      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-display text-lg font-bold text-ink">{label}</span>
        <span className="text-2xs font-semibold tabular-nums text-ink-tertiary">
          {t('officeServiceCount', { count })}
        </span>
      </span>

      <span className="text-sm leading-relaxed text-ink-secondary">
        {description}
      </span>

      {examples.length > 0 && (
        <span
          aria-hidden="true"
          className="flex flex-col gap-1 border-t border-line-subtle pt-2.5 text-sm text-ink-tertiary"
        >
          {examples.map(example => (
            <span key={example}>{example}</span>
          ))}
        </span>
      )}
    </Link>
  );
}
