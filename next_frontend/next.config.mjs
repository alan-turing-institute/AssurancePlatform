/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "teamedia.blob.core.windows.net",
        port: "",
        pathname: "/sample-container/**",
      },
    ],
  },
};

export default nextConfig;
