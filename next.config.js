/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'thumbsnap.com',
      },
      {
        protocol: 'https',
        hostname: '*.thumbsnap.com',
      },
      {
        protocol: 'https',
        hostname: 'qu.ax',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  output: 'standalone',

  typescript: {
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig
