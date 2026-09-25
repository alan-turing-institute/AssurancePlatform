import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const devAllowedOrigins = process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(",")
	.map((s) => s.trim())
	.filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
	output: process.env.NODE_ENV === "development" ? undefined : "standalone",
	// Next 16 blocks cross-origin dev requests (HMR, /_next/static chunks) by
	// default. Set NEXT_DEV_ALLOWED_ORIGINS (comma-separated hosts, no
	// protocol) when running `next dev` for LAN review; leave it unset for a
	// normal localhost-only dev server and for production, where this key is
	// never consulted.
	...(devAllowedOrigins?.length
		? { allowedDevOrigins: devAllowedOrigins }
		: {}),
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
			// D1 phase 2 — the approved 1.0 page map moved these under the
			// TEA Curriculum and introduced Platform Guide as a new top-level
			// section.
			{
				source: "/docs/curriculum/quick-reference/:path*",
				destination: "/docs/platform-guide/reference/:path*",
				permanent: true,
			},
			{
				source: "/docs/curriculum/hands-on/case-studies/:path*",
				destination: "/docs/curriculum/case-studies/:path*",
				permanent: true,
			},
			{
				source: "/docs/curriculum/hands-on",
				destination: "/docs/curriculum",
				permanent: true,
			},
			{
				source: "/docs/curriculum/tea-specialist",
				destination: "/docs/curriculum/after-1-0",
				permanent: true,
			},
			{
				source: "/docs/curriculum/tea-expert",
				destination: "/docs/curriculum/after-1-0",
				permanent: true,
			},
			{
				source: "/docs/data-retention-policy",
				destination: "/docs/platform-guide/data-retention-policy",
				permanent: true,
			},
			// The standalone guides were removed from the curriculum (2026-09).
			{
				source: "/docs/curriculum/standalone/:path*",
				destination: "/docs/curriculum",
				permanent: true,
			},
		];
	},
};

export default withMDX(nextConfig);
