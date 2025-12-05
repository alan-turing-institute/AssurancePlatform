import path from "node:path";
import react from "@vitejs/plugin-react";
import type { InlineConfig } from "vitest";
import { defineConfig } from "vitest/config";

const baseTestConfig: InlineConfig = {
	environment: "jsdom",
	setupFiles: ["./src/__tests__/setup.tsx"],
	globals: true,
	css: true,

	// Configure parallel execution
	pool: "forks",
	poolOptions: {
		forks: {
			singleFork: false, // Enable parallel execution
			maxForks: 4, // Limit concurrent processes to prevent resource exhaustion
		},
	},

	// Test categorization and filtering
	include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
	exclude: ["node_modules", "dist", ".idea", ".git", ".cache", "tea-docs/**"],

	// Test timeout configuration
	testTimeout: 15_000, // 15 seconds - balanced for most tests
	hookTimeout: 10_000, // 10 seconds
	teardownTimeout: 5000, // 5 seconds

	// Retry configuration for flaky tests
	retry: 1, // Reduce retries to improve performance

	// Multiple reporters configuration
	reporters: process.env.CI
		? ["default", ["junit", { outputFile: "./test-results/junit.xml" }]]
		: ["default"],

	// Optimized coverage collection
	coverage: {
		enabled: true,
		provider: "v8",
		reporter: ["json", "html"],
		reportsDirectory: "./coverage",
		exclude: [
			"node_modules/**",
			"src/__tests__/**",
			"**/*.d.ts",
			"**/*.config.{js,ts,mjs,cjs}",
			"src/types/**",
			".next/**",
			"public/**",
			"logs/**",
			"tea-docs/**",
			"coverage/**",
			"dist/**",
			"**/*.spec.{js,ts,jsx,tsx}",
			"**/*.test.{js,ts,jsx,tsx}",
		],
		include: [
			"app/**",
			"components/**",
			"hooks/**",
			"lib/**",
			"actions/**",
			"providers/**",
		],
		all: true,
		clean: true,
		skipFull: false,
		thresholds: {
			global: {
				statements: 80,
				branches: 80,
				functions: 80,
				lines: 80,
			},
		},
	},

	// Performance optimizations
	maxConcurrency: 5,
	passWithNoTests: false,
	allowOnly: process.env.CI !== "true",
	dangerouslyIgnoreUnhandledErrors: false,

	// Better error output
	outputFile: process.env.CI ? "./test-results/output.json" : undefined,
};

export default defineConfig({
	plugins: [react()],
	test: {
		...baseTestConfig,
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
	// Optimization for module resolution
	optimizeDeps: {
		include: ["react", "react-dom", "@testing-library/react"],
	},
});
