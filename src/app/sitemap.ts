import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import {
  getCharterSections,
  getManifest,
  getServicesByOffice,
} from '@/lib/content';
import { lguConfig } from '@/lib/lgu-config';

/**
 * Every indexable page, generated from the content manifests.
 *
 * 🔴 **This used to publish one URL.** It emitted the home page per locale and
 * nothing else, behind a comment saying it would read the manifests "once
 * content exists". Content existed: 97 services, 11 categories, 22 charter
 * documents and 18 office views — roughly 300 pages, none of which a search
 * engine had any way to find. On a portal whose whole purpose is making a
 * municipality's own published information findable, that was the single most
 * consequential thing not working.
 *
 * Derived, never listed. A new markdown page under an existing route appears
 * here by itself — the same promise `generateStaticParams` makes — which is why
 * this reads the manifests rather than a hardcoded array that would be wrong the
 * first time somebody added a service.
 *
 * ## What is deliberately absent
 *
 * **Every search route.** `/search`, `/search/[query]` and
 * `/search/[query]/[category]` all set `robots: noindex`, because a crawler
 * indexing queries produces thousands of near-duplicate URLs of a small civic
 * site. Listing them here would contradict the pages themselves.
 *
 * ## `lastModified` is the CHECK date, not the build date
 *
 * `new Date()` here would tell a crawler that every page changed on every
 * deploy, which is false and trains it to ignore the field. `lastCheckedAt` is
 * the day a human last read the page against its source — the only date this
 * project can honestly put on a page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { domain } = lguConfig.portal;

  const [sections, offices, documents] = await Promise.all([
    getCharterSections(),
    getServicesByOffice(),
    getManifest('charter', 'documents'),
  ]);

  /** One entry per locale, cross-linked to its twin — hreflang, in the sitemap. */
  const entry = (path: string, lastModified?: string): MetadataRoute.Sitemap =>
    routing.locales.map(locale => ({
      url: `${domain}/${locale}${path}`,
      ...(lastModified ? { lastModified } : {}),
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map(other => [other, `${domain}/${other}${path}`])
        ),
      },
    }));

  return [
    ...entry(''),
    ...entry('/contact'),
    ...entry('/emergency'),
    ...entry('/gaps'),
    ...entry('/services'),

    ...sections.flatMap(section => [
      ...entry(`/services/${section.category}`),
      ...section.pages.flatMap(page =>
        entry(`/services/${section.category}/${page.slug}`, page.lastCheckedAt)
      ),
    ]),

    ...offices.flatMap(group => entry(`/services/office/${group.office.slug}`)),

    ...documents.flatMap(document =>
      entry(`/charter/documents/${document.slug}`, document.lastCheckedAt)
    ),
  ];
}
