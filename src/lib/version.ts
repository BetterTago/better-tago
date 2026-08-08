import pkg from '../../package.json';

/**
 * The portal version, rendered in the footer.
 *
 * `package.json` is the single source of truth — same pattern as
 * `lgu-config.ts` reading `config/lgu.config.json`. Nothing else in the app
 * should hardcode a version string.
 *
 * MAJOR = the information architecture changed or a published URL broke.
 * MINOR = a page, route, or section shipped. PATCH = content, copy, styling,
 * accessibility, or dependency work. See docs/coding-standards.md.
 */
export const PORTAL_VERSION: string = pkg.version;
