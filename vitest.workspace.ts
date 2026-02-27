import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Vitest workspace configuration with two projects:
 * - unit: jsdom environment for component and utility tests
 * - integration: node environment for DB integration tests
 *
 * Run a specific project: pnpm exec vitest --project integration --run
 */
export default defineConfig({
	plugins: [react()],
	test: {
		projects: [
			{
				// Unit tests — same config as vitest.config.ts but explicit
				extends: "./vitest.config.ts",
				test: {
					name: "unit",
					include: ["**/*.{test,spec}.{ts,tsx}"],
					exclude: [
						"node_modules/**",
						"src/__tests__/integration/**",
						"tea-docs/**",
						".claude/**",
					],
				},
			},
			{
				resolve: {
					alias: {
						"@": path.resolve(__dirname, "./"),
						"@/components": path.resolve(__dirname, "./components"),
						"@/hooks": path.resolve(__dirname, "./hooks"),
						"@/lib": path.resolve(__dirname, "./lib"),
						"@/types": path.resolve(__dirname, "./types"),
						"@/actions": path.resolve(__dirname, "./actions"),
						"@/providers": path.resolve(__dirname, "./providers"),
						"@/app": path.resolve(__dirname, "./app"),
						"@/config": path.resolve(__dirname, "./config"),
						"@/store": path.resolve(__dirname, "./store"),
						"@/public": path.resolve(__dirname, "./public"),
						"@/src": path.resolve(__dirname, "./src"),
					},
				},
				test: {
					name: "integration",
					include: ["src/__tests__/integration/**/*.test.ts"],
					environment: "node",
					globals: true,
					setupFiles: ["./src/__tests__/setup.integration.tsx"],
					globalSetup: ["./src/__tests__/scripts/setup-test-db.ts"],
					testTimeout: 30_000,
					hookTimeout: 15_000,
					pool: "forks",
					fileParallelism: false,
					env: {
						DATABASE_URL:
							"postgresql://tea_user:tea_password@localhost:5432/tea_test",
						SKIP_ELEMENT_VALIDATION: "false",
					},
				},
			},
		],
	},
});
