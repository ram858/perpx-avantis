/** @type {import('next').NextConfig} */
const allowedFrameAncestors = [
  "'self'",
  "https://*.warpcast.com",
  "https://warpcast.com",
  "https://*.farcaster.xyz",
  "https://farcaster.xyz",
  "https://*.base.org",
  "https://base.org",
  "https://base.app",
  "https://*.base.app",
  "https://base.dev",
];

const nextConfig = {
  // Optimize for Base Mini App
  reactStrictMode: true,
  
  // Webpack configuration to handle Node.js modules
  webpack: (config, { isServer }) => {
    // Exclude Node.js modules from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
      };
    }
    
    // Ignore optional dependencies that may not be installed
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        '@vercel/kv': 'commonjs @vercel/kv',
        'pg': 'commonjs pg',
        'typeorm': 'commonjs typeorm',
      });
    }
    
    // Ignore optional @vercel/kv in client-side builds
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@vercel/kv': false,
      };
    }
    
    return config;
  },
  
  // Experimental features
  experimental: {
    optimizeCss: true,
  },

  async headers() {
    const frameAncestors = allowedFrameAncestors.join(" ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
