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
				// Unit tests — extends main vitest.config.ts (which uses setup/index.ts)
				extends: "./vitest.config.ts",
				test: {
					name: "unit",
					include: ["**/*.{test,spec}.{ts,tsx}"],
					exclude: [
						"node_modules/**",
						"src/__tests__/integration/**",
						"e2e/**",
						"tea-docs/**",
						".claude/**",
					],
				},
			},
			{
				resolve: {
					alias: {
						"@": path.resolve(import.meta.dirname, "./"),
						"@/components": path.resolve(import.meta.dirname, "./components"),
						"@/hooks": path.resolve(import.meta.dirname, "./hooks"),
						"@/lib": path.resolve(import.meta.dirname, "./lib"),
						"@/types": path.resolve(import.meta.dirname, "./types"),
						"@/actions": path.resolve(import.meta.dirname, "./actions"),
						"@/providers": path.resolve(import.meta.dirname, "./providers"),
						"@/app": path.resolve(import.meta.dirname, "./app"),
						"@/config": path.resolve(import.meta.dirname, "./config"),
						"@/store": path.resolve(import.meta.dirname, "./store"),
						"@/public": path.resolve(import.meta.dirname, "./public"),
						"@/src": path.resolve(import.meta.dirname, "./src"),
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
