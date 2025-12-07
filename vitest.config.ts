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
		pool: "forks",
		poolOptions: {
			forks: {
				singleFork: false,
				maxForks: 4,
			},
		},
		include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		exclude: ["node_modules", "dist", ".idea", ".git", ".cache", "tea-docs/**"],
		testTimeout: 15_000,
		hookTimeout: 10_000,
		teardownTimeout: 5000,
		retry: 1,
		reporters: process.env.CI
			? ["default", ["junit", { outputFile: "./test-results/junit.xml" }]]
			: ["default"],
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
		maxConcurrency: 5,
		passWithNoTests: false,
		allowOnly: process.env.CI !== "true",
		dangerouslyIgnoreUnhandledErrors: false,
		outputFile: process.env.CI ? "./test-results/output.json" : undefined,
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
