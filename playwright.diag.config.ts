// TEMPORARY diagnostic config (cid, 2026-08-19) — no globalSetup (do NOT wipe the dev DB),
// no webServer management, reuse the running app. Delete after use.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	testMatch: /sector-diag\.spec\.ts/,
	timeout: 60_000,
	use: {
		baseURL: "http://localhost:3000",
	},
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				launchOptions: {
					executablePath:
						"/home/chris/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
				},
			},
		},
	],
});
