/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
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
