/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: process.env.NODE_ENV === 'development',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'stagingteastorageaccount.blob.core.windows.net',
        port: '',
        pathname: '**/*',
      },
      {
        protocol: 'https',
        hostname: 'teastorageaccount.blob.core.windows.net',
        port: '',
        pathname: '**/*',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '**/*',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '**/*',
      },
      {
        protocol: 'http',
        hostname: 'tea-backend',
        port: '8000',
        pathname: '**/*',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '**/*',
      },
    ],
  },
  rewrites() {
    return [
      {
        source: '/documentation',
        destination: '/documentation/index.html',
      },
    ];
  },
};

export default nextConfig;
