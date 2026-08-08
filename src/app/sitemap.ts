import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { lguConfig } from '@/lib/lgu-config';

/**
 * Generated from the route set, and — once content exists — from the content
 * manifests, so a new markdown page appears here with no code change.
 *
 * Today that is one route per locale, because one route is all there is.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const { domain } = lguConfig.portal;

  return routing.locales.map(locale => ({
    url: `${domain}/${locale}`,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map(other => [other, `${domain}/${other}`])
      ),
    },
  }));
}
