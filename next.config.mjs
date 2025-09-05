/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false, // Enable ESLint checks in production
  },
  typescript: {
    ignoreBuildErrors: false, // Enable TypeScript checks in production
  },
  images: {
    unoptimized: false, // Enable image optimization for better performance
    domains: ['blob.vercel-storage.com'], // Allow external image domains
    formats: ['image/webp', 'image/avif'], // Modern image formats
  },
  // Performance optimizations
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },
  // Compression and caching
  compress: true,
  poweredByHeader: false,
  // API rewrites for integrated backend
  async rewrites() {
    return [
      {
        source: '/api/trading/:path*',
        destination: 'http://localhost:3001/api/trading/:path*',
      },
    ]
  },
}

export default nextConfig