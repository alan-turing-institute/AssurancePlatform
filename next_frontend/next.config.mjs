/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "stagingteastorageaccount.blob.core.windows.net",
        port: "",
        pathname: "**/*",
      },
    ],
  },
};

export default nextConfig;
