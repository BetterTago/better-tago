import type { MetadataRoute } from 'next';
import { lguConfig } from '@/lib/lgu-config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${lguConfig.portal.domain}/sitemap.xml`,
  };
}
