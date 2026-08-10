import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { Logo } from '@/components/ui/Logo';
import { NavLink } from '@/components/ui/NavLink';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Wordmark } from '@/components/ui/Wordmark';
import type { NavItem } from '@/data/navigation';
import { PRIMARY_NAV } from '@/data/navigation';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { lguConfig } from '@/lib/lgu-config';
import { MobileNav } from './MobileNav';
import { NavDisclosure } from './NavDisclosure';

/**
 * The sticky header.
 *
 * A Server Component. The four interactive pieces — `LocaleSwitcher`,
 * `ThemeToggle`, `MobileNav`, `NavDisclosure` — are client leaves imported into
 * it, and **the navigation tree never crosses the boundary**: every disclosure
 * receives its child links ALREADY RENDERED as `children`. That is what keeps
 * `navigation.ts` and the i18n runtime out of the browser bundle entirely.
 *
 * One `navRow` builds both surfaces from the same tree, so a destination cannot
 * be in the desktop row and missing from the mobile sheet — the failure that is
 * invisible until somebody opens the site on a phone.
 */
export async function SiteHeader({ locale }: { locale: Locale }) {
  const [t, tNav] = await Promise.all([
    getTranslations('header'),
    getTranslations('nav'),
  ]);

  /**
   * One row of the navigation, at either size.
   *
   * A leaf is a plain `<li>` with a `NavLink`. A parent is a `NavDisclosure`,
   * which renders its own `<li>` and the nested `<ul>` — so the submenu is a
   * real child of its parent's list item in both places and the two surfaces
   * cannot drift apart.
   */
  function navRow(item: NavItem, variant: 'dropdown' | 'inline') {
    const desktop = variant === 'dropdown';

    // Mobile rows carry a rule between them and fill the sheet; desktop rows
    // sit inline in the header bar.
    const parentClass = desktop
      ? 'inline-flex min-h-11 items-center text-sm font-medium'
      : 'flex min-h-12 w-full items-center border-b border-line-subtle text-base';

    const childClass = desktop
      ? 'flex min-h-11 items-center rounded-lg px-2.5 text-sm hover:bg-surface-control'
      : 'flex min-h-11 items-center text-sm';

    if (!item.children) {
      return (
        <li key={item.messageKey}>
          <NavLink
            item={item}
            variant={desktop ? 'inline' : 'badge'}
            className={parentClass}
          />
        </li>
      );
    }

    return (
      <NavDisclosure
        key={item.messageKey}
        label={tNav(item.messageKey)}
        variant={variant}
        buttonClassName={parentClass}
      >
        {item.children.map(child => (
          <li key={child.messageKey}>
            <NavLink item={child} variant="badge" className={childClass} />
          </li>
        ))}
      </NavDisclosure>
    );
  }

  return (
    // `relative`, because the mobile panel is absolutely positioned against
    // this element and travels with the sticky bar.
    <header className="sticky top-0 z-40 relative border-b border-line bg-surface-page/85 backdrop-blur-sm backdrop-saturate-150">
      {/*
        `flex-wrap` and `min-w-0` are what make this row's width independent of
        the font, and both are load-bearing rather than defensive.

        A flex item defaults to `min-width: auto`, so without `min-w-0` the
        wordmark forces its full text width and the control group forces its
        own — and the row fits 320px only while the developer's machine happens
        to resolve a narrow face. A bare CI runner resolves a wider one and the
        page scrolls sideways by a few pixels, which is exactly how this was
        caught the first time.

        The fix is not a tighter gap, which only moves the threshold. With the
        wordmark allowed to shrink and the row allowed to wrap, there is no font
        wide enough to overflow it.
      */}
      <div className="page-measure flex flex-wrap items-center gap-x-3 gap-y-1 py-2 sm:gap-x-6">
        <Link
          href="/"
          className="flex min-h-11 min-w-0 items-center gap-3"
          aria-label={t('homeLink', { portal: lguConfig.portal.name })}
        >
          {/* aria-hidden inside the mark, because this link is already labelled
              — an <svg role="img"> here would make it announce twice.

              gap-3, not gap-2: the mark's clear-space rule is one emblem radius
              on every side, which is 8.4px once the mark is drawn at 36. 8px
              would sit inside its own keep-out field. */}
          <Logo idPrefix="site-header" />
          <Wordmark />
        </Link>

        {/*
          A real `<ul>`, not a row of loose links: the submenus need a parent
          `<li>` to nest inside, and a reader browsing by structure gets the
          group sizes for free.

          `gap-3` at `lg`, widening only at `xl`. Every label carries a chevron
          and Filipino runs 15–25% longer on all five, so the Filipino set is
          the sizing case — the row has to hold the mark, the nav and three
          controls inside the page measure at 1024px with the LONGER strings.
        */}
        <nav aria-label={tNav('label')} className="hidden lg:block">
          <ul className="flex items-center gap-3 xl:gap-4">
            {PRIMARY_NAV.map(item => navRow(item, 'dropdown'))}
          </ul>
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {/*
            Always visible, at every width. It was briefly hidden below `sm`
            with a duplicate inside the mobile sheet, which cost a reader on a
            320px phone two taps to change language and — worse — put the
            control behind a menu they had no reason to open. One switcher, one
            place, every width.
          */}
          <LocaleSwitcher current={locale} />
          <ThemeToggle />
          <MobileNav>
            <ul className="grid">
              {PRIMARY_NAV.map(item => navRow(item, 'inline'))}
            </ul>
          </MobileNav>
        </div>
      </div>
    </header>
  );
}
