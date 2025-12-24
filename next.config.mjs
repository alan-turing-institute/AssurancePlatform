import nextra from "nextra";

const withNextra = nextra({
	contentDirBasePath: "/docs",
	defaultShowCopyCode: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
	output: process.env.NODE_ENV === "development" ? undefined : "standalone",
	// Exclude content directory from file watching to reduce memory usage in dev
	// Doc changes require a manual browser refresh
	webpack: (config, { dev }) => {
		if (dev) {
			config.watchOptions = {
				...config.watchOptions,
				ignored: ["**/content/**", "**/node_modules/**"],
			};
		}
		return config;
	},
	images: {
		unoptimized: process.env.NODE_ENV === "development",
		remotePatterns: [
			{
				protocol: "https",
				hostname: "stagingteastorageaccount.blob.core.windows.net",
				port: "",
				pathname: "**/*",
			},
			{
				protocol: "https",
				hostname: "teastorageaccount.blob.core.windows.net",
				port: "",
				pathname: "**/*",
			},
			{
				protocol: "https",
				hostname: "images.unsplash.com",
				port: "",
				pathname: "**/*",
			},
			{
				protocol: "https",
				hostname: "res.cloudinary.com",
				port: "",
				pathname: "**/*",
			},
			{
				protocol: "http",
				hostname: "tea-backend",
				port: "8000",
				pathname: "**/*",
			},
			{
				protocol: "http",
				hostname: "localhost",
				port: "8000",
				pathname: "**/*",
			},
		],
	},
	// Redirect old /documentation URLs to new /docs URLs
	async redirects() {
		return [
			{
				source: "/documentation",
				destination: "/docs",
				permanent: true,
			},
			{
				source: "/documentation/:path*",
				destination: "/docs/:path*",
				permanent: true,
			},
		];
	},
};

export default withNextra(nextConfig);
