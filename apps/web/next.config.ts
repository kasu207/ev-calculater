import type { NextConfig } from 'next';

const wurzel = new URL('../../', import.meta.url).pathname;

const nextConfig: NextConfig = {
  output: 'standalone',
  // Im Monorepo muss Next wissen, ab wo es Dateien für das Standalone-Bundle sammelt.
  outputFileTracingRoot: wurzel,
  // Die Schriftdateien für das Vorschaubild liegen ausserhalb von public.
  outputFileTracingIncludes: {
    '/opengraph-image': ['./assets/**'],
    '/rechner/opengraph-image': ['./assets/**'],
  },
  transpilePackages: ['@ampmatch/core'],
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
