import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Proxy all /api/* calls to the Express backend so browser fetches using
  // relative URLs (/api/...) are forwarded transparently. Server components
  // that call fetch() directly use BACKEND_ORIGIN instead (see lib/properties.ts).
  async rewrites() {
    const backendOrigin = process.env.BACKEND_ORIGIN ?? 'http://localhost:4000';
    return [{ source: '/api/:path*', destination: `${backendOrigin}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
