import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * Where you are, as a list rather than as a row of links.
 *
 * 🔴 The LAST crumb is not a link. It is the page the reader is already on, and
 * a link to the current page is a control that does nothing — announced as
 * operable, and then not operating. Screen-reader users hit this constantly on
 * civic sites and it is entirely avoidable: the current page is plain text
 * inside the same list, carrying `aria-current`.
 *
 * The separators are decorative and `aria-hidden`. An `<ol>` already conveys the
 * sequence; a slash read out four times per page does not add to it.
 */

export type Crumb = {
  label: string;
  /** Locale-relative, without the locale prefix. Omit for the current page. */
  href?: string;
};

export async function Breadcrumb({ trail }: { trail: Crumb[] }) {
  const t = await getTranslations('services');

  return (
    <nav
      aria-label={t('breadcrumbLabel')}
      /*
       * Marks the trail as a listed exemption from the 44px touch floor, named
       * in `services.a11y.spec.ts`. A breadcrumb is a row of inline text — WCAG
       * 2.5.8's own inline exception — and padding each crumb to 44px would
       * turn a one-line orientation strip into three stacked buttons above
       * every masthead. Every destination in it is also in the page's own
       * navigation, at full size.
       */
      data-breadcrumb
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-tertiary">
        {trail.map((crumb, index) => (
          <li key={crumb.href ?? crumb.label} className="flex items-center">
            {index > 0 && (
              <span aria-hidden="true" className="mr-2 opacity-55">
                /
              </span>
            )}
            {crumb.href ? (
              <Link
                className="hover:text-ink-link-hover text-ink-link"
                href={crumb.href}
              >
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink-secondary">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
