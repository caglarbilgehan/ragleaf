/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Allow cross-origin HMR requests from cserver-2 and the local domain
  allowedDevOrigins: ['cserver-2', 'ragleaf.com', 'localhost', '127.0.0.1'],
};

export default nextConfig;
