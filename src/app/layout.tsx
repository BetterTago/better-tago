import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';
import './globals.css';

/**
 * The document shell.
 *
 * `<html>` lives HERE, not in `app/[locale]/layout.tsx`. With the shell inside
 * the `[locale]` segment, a client-side switch between locales makes React
 * render a second document into the live one — it cannot reconcile two `<html>`
 * elements, so it appends, and the page ends up with two headers. A root layout
 * is not re-rendered when only a child segment changes, so the shell mounts
 * exactly once per tab and the locale switch stays an ordinary navigation.
 *
 * The cost is that this layout cannot know the locale, so `lang` ships as the
 * default and `<HtmlLang>` in the locale layout corrects it on every switch.
 * The `alternates.languages` hreflang set in that layout's metadata is what
 * covers a crawler that does not run JavaScript.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang={routing.defaultLocale}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        {/* Lets the UA paint the right page background before our CSS lands. */}
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="bg-surface-page font-sans text-ink">{children}</body>
    </html>
  );
}
