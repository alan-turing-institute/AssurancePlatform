import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const cpuCount = os.cpus().length;

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		setupFiles: ["./src/__tests__/setup/index.ts"],
		globals: true,
		css: true,
		pool: "forks",
		poolOptions: {
			forks: {
				singleFork: false,
				maxForks: Math.max(cpuCount - 1, 4),
			},
		},
		include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		exclude: [
			"node_modules",
			"dist",
			".idea",
			".git",
			".cache",
			"tea-docs/**",
			".claude/**",
			"e2e/**",
			"src/__tests__/integration/**",
		],
		testTimeout: 15_000,
		hookTimeout: 10_000,
		teardownTimeout: 5000,
		retry: 1,
		reporters: process.env.CI
			? ["default", ["junit", { outputFile: "./test-results/junit.xml" }]]
			: ["default"],
		coverage: {
			enabled: !!process.env.COVERAGE,
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
				"**/*.md",
				"**/*.bak",
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
				statements: 20,
				branches: 20,
				functions: 20,
				lines: 20,
			},
		},
		maxConcurrency: 10,
		passWithNoTests: false,
		allowOnly: process.env.CI !== "true",
		dangerouslyIgnoreUnhandledErrors: false,
		outputFile: process.env.CI ? "./test-results/output.json" : undefined,
	},
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
	optimizeDeps: {
		include: ["react", "react-dom", "@testing-library/react"],
	},
});
