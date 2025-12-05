import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		setupFiles: ["./src/__tests__/setup.tsx"],
		globals: true,
		css: true,
		// Enable parallel execution for better performance
		pool: "forks",
		poolOptions: {
			forks: {
				singleFork: false,
				maxForks: 4,
			},
		},
		// Test categorization and filtering
		include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		exclude: ["node_modules", "dist", ".idea", ".git", ".cache", "tea-docs/**"],
		// Reduced timeout for faster failure detection
		testTimeout: 10_000,
		hookTimeout: 5000,
		teardownTimeout: 2000,
		// No retries for performance testing
		retry: 0,
		// Simple reporter for performance
		reporters: ["basic"],
		// Disable coverage for performance runs
		coverage: {
			enabled: false,
		},
		// Performance optimizations
		maxConcurrency: 10,
		passWithNoTests: false,
		allowOnly: false,
		dangerouslyIgnoreUnhandledErrors: false,
		// Disable file watching
		watch: false,
		// Bail on first failure to save time
		bail: 1,
	},
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
			"@/data": path.resolve(__dirname, "./data"),
			"@/public": path.resolve(__dirname, "./public"),
			"@/src": path.resolve(__dirname, "./src"),
		},
	},
	optimizeDeps: {
		include: ["react", "react-dom", "@testing-library/react"],
	},
});
