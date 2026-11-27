import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let loadedLogging: typeof import("../logger") | undefined;

/** Loads the pool config and the logger it writes to as one fresh pair. */
async function freshModules() {
	vi.resetModules();
	const config = await import("../db-pool-config");
	const logging = await import("../logger");
	loadedLogging = logging;
	const entries: unknown[] = [];
	logging.setLogSink((entry) => {
		entries.push(entry);
	});
	return { config, logging, entries };
}

describe("resolveDbPoolTimeoutMs with a fresh module", () => {
	beforeEach(() => {
		vi.stubEnv("LOG_LEVEL", "debug");
	});

	afterEach(() => {
		loadedLogging?.resetLogSink();
		loadedLogging = undefined;
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it.each([
		["unset", undefined],
		["empty", ""],
		["blank", "   "],
	])("gives the default without a warning when the value is %s", async (_label, value) => {
		vi.stubEnv("DB_POOL_TIMEOUT_MS", value);
		const { config, entries } = await freshModules();

		expect(config.resolveDbPoolTimeoutMs()).toBe(
			config.DEFAULT_DB_POOL_TIMEOUT_MS
		);
		expect(entries).toStrictEqual([]);
	});

	it("reads a value with surrounding spaces as its number", async () => {
		vi.stubEnv("DB_POOL_TIMEOUT_MS", " 250 ");
		const { config, entries } = await freshModules();

		expect(config.resolveDbPoolTimeoutMs()).toBe(250);
		expect(entries).toStrictEqual([]);
	});

	it("warns once with the value and the fallback for an unusable value", async () => {
		vi.stubEnv("DB_POOL_TIMEOUT_MS", "-5");
		const { config, entries } = await freshModules();

		config.resolveDbPoolTimeoutMs();
		config.resolveDbPoolTimeoutMs();

		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			level: "warn",
			event: "db.pool.invalid_timeout_config",
			value: "-5",
			fallbackMs: config.DEFAULT_DB_POOL_TIMEOUT_MS,
		});
	});
});
