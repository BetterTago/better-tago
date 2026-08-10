import { IBM_Plex_Sans, Inter, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';
import { THEME_INIT_SCRIPT } from '@/lib/theme-init';
import './globals.css';

/**
 * Display: headings, stat figures and the wordmark's second line.
 *
 * Chosen for its TABULAR FIGURES, which is not a stylistic preference here —
 * every stat, every hotline and the version string sets `tabular-nums`, and a
 * proportional face makes a column of figures ripple.
 */
const grotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-grotesk',
  display: 'swap',
});

/** Body, and the `<body>` default. Its Filipino diacritics are drawn, not synthesised. */
const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-plex',
  display: 'swap',
});

/*
 * The BetterGov network wordmark face.
 *
 * Not a font borrowed from the reference portal — Inter IS the Kapwa design
 * system's sans (`--font-kapwa-sans`), which @bettergov/kapwa's own README
 * declares with exactly this call. The network shares a wordmark, not a body
 * face, so this must never be promoted to `--font-sans`.
 *
 * ONE weight, 900, because exactly two spans use it: the header and footer
 * lockups. The design asks for black; loading only to 700 and letting the
 * browser synthesise the rest is visibly muddier at wordmark size.
 */
const inter = Inter({
  subsets: ['latin'],
  weight: '900',
  variable: '--font-kapwa-sans',
  display: 'swap',
});

/*
 * There is deliberately NO serif here. The reference portal loads one for a
 * single element — an etymology card — and this portal's history section has no
 * etymology column, because no account of the name "Tago" has been sourced.
 * Loading a face nothing renders costs a request and buys nothing.
 */

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
 * default. Two things correct it: the pre-paint script below, which reads the
 * first path segment before anything renders, and `<HtmlLang>` in the locale
 * layout, which handles every later client-side switch. The
 * `alternates.languages` hreflang set in that layout's metadata is what covers
 * a crawler that does not run JavaScript.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang={routing.defaultLocale}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      // The font variables belong on the shell, not on the locale layout: this
      // element is mounted once per tab, so a client-side locale switch cannot
      // drop them and re-request the faces.
      className={`${grotesk.variable} ${plex.variable} ${inter.variable}`}
    >
      <head>
        {/*
         * Resolves the theme and corrects `lang` BEFORE first paint, so no
         * route renders in the wrong theme for a frame.
         *
         * This is the one and only permitted `dangerouslySetInnerHTML` in the
         * app, and it is safe for exactly one reason: `THEME_INIT_SCRIPT` is a
         * static literal with nothing interpolated into it. A unit test fails
         * on the first `${`. Do not make this script take a parameter.
         *
         * There is deliberately no `<meta name="color-scheme">` beside it: the
         * meta would let the UA paint a dark canvas for a reader whose stored
         * choice is light. `color-scheme` is set per theme in globals.css
         * instead, where the attribute this script writes governs it.
         */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-surface-page font-sans text-ink">{children}</body>
    </html>
  );
}
