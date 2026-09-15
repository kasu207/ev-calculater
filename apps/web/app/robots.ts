import type { MetadataRoute } from 'next';
import { basisUrl } from '@/lib/seite';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: `${basisUrl()}/sitemap.xml`,
  };
}
