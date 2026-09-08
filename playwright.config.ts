import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	globalSetup: "./e2e/global-setup.ts",
	testDir: "./e2e",
	timeout: 30_000,
	expect: {
		timeout: 5000,
	},
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 2 : undefined,
	// The "github" reporter only annotates the PR — it never writes a
	// playwright-report/ folder, so CI's "Upload Playwright report" step had
	// nothing to upload, pass or fail (0 artifacts on a failed run, 2026-07-17).
	// Keep github annotations and also emit the html report CI uploads.
	reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "setup",
			testMatch: /auth\.setup\.ts/,
		},
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				storageState: "e2e/.auth/chris.json",
			},
			dependencies: ["setup"],
		},
	],
	webServer: {
		command: process.env.CI ? "node .next/standalone/server.js" : "pnpm dev",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
