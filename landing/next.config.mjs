/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Allow cross-origin HMR requests from cserver-2 and the local domain
  allowedDevOrigins: ['cserver-2', 'ragleaf.com', 'localhost', '127.0.0.1'],

  // Next.js rewrites for local development mode only
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/blog/:slug',
          destination: '/blog/post?slug=:slug',
        },
      ];
    }
    return [];
  }
};

export default nextConfig;
