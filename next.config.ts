import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Cache Components: nothing is cached implicitly. Opt in per function with
  // the 'use cache' directive plus cacheLife/cacheTag.
  cacheComponents: true,
};

export default withNextIntl(nextConfig);
