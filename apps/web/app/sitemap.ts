import type { MetadataRoute } from 'next';
import { basisUrl } from '@/lib/seite';

export default function sitemap(): MetadataRoute.Sitemap {
  const basis = basisUrl();
  const stand = new Date();

  return [
    { url: `${basis}/`, lastModified: stand, priority: 1 },
    { url: `${basis}/impressum`, lastModified: stand, priority: 0.2 },
    { url: `${basis}/datenschutz`, lastModified: stand, priority: 0.2 },
  ];
}
