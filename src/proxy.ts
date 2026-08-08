import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Locale negotiation.
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`; the contract is unchanged,
 * so next-intl's `createMiddleware` is still the right factory. Do NOT add a
 * `middleware.ts` alongside this.
 *
 * It lives in `src/`, not the repo root: with a `src/` directory present, Next
 * only picks the file up from there. At the root it compiles to an empty
 * middleware manifest and `/` returns 404 instead of negotiating a locale.
 */
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals, and files with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
