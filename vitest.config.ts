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
			// A production build (e.g. from a browser-based QA pass) copies the
			// whole source tree, test files included, into .next/standalone —
			// already excluded from coverage below, but not from discovery, so
			// a build left on disk gets every test collected a second time.
			".next/**",
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
			// Ratchet floors: set at the measured coverage on the full unit
			// suite (`pnpm test:coverage:check`, 2026-08-19) minus a 1-2pp
			// safety margin to absorb legitimate churn without blocking PRs.
			// Measured: statements 18.2%, branches 13.9%, functions 20.79%,
			// lines 18.27%. Raise these deliberately as coverage improves —
			// never lower them to make a PR pass.
			thresholds: {
				statements: 17,
				branches: 12,
				functions: 19,
				lines: 17,
			},
		},
		// codemirror-json-schema's ESM build omits file extensions on its
		// relative imports (e.g. "./features/completion"), which fails
		// Node's native ESM resolver. Vitest externalizes node_modules by
		// default (resolved via that native loader); inlining this one
		// package routes it through Vite's own resolver instead, which
		// tolerates the missing extensions.
		server: {
			deps: {
				inline: ["codemirror-json-schema"],
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
