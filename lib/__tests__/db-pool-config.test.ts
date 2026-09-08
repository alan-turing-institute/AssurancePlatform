import { afterEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_DB_POOL_TIMEOUT_MS,
	resolveDbPoolTimeoutMs,
} from "../db-pool-config";
import { type LogEntry, resetLogSink, setLogSink } from "../logger";

function captureLogs(): LogEntry[] {
	const entries: LogEntry[] = [];
	setLogSink((entry) => {
		entries.push(entry);
	});
	return entries;
}

describe("resolveDbPoolTimeoutMs", () => {
	afterEach(() => {
		resetLogSink();
		vi.unstubAllEnvs();
	});

	it("defaults to DEFAULT_DB_POOL_TIMEOUT_MS when unset", () => {
		vi.stubEnv("DB_POOL_TIMEOUT_MS", "");
		expect(resolveDbPoolTimeoutMs()).toBe(DEFAULT_DB_POOL_TIMEOUT_MS);
	});

	it("honours a tiny configured value", () => {
		vi.stubEnv("DB_POOL_TIMEOUT_MS", "1");
		expect(resolveDbPoolTimeoutMs()).toBe(1);
	});

	it("honours a larger configured value", () => {
		vi.stubEnv("DB_POOL_TIMEOUT_MS", "12000");
		expect(resolveDbPoolTimeoutMs()).toBe(12_000);
	});

	it("falls back to the default and warns once for a non-numeric value", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		vi.stubEnv("DB_POOL_TIMEOUT_MS", "not-a-number");
		const entries = captureLogs();

		expect(resolveDbPoolTimeoutMs()).toBe(DEFAULT_DB_POOL_TIMEOUT_MS);
		resolveDbPoolTimeoutMs();
		resolveDbPoolTimeoutMs();

		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			level: "warn",
			event: "db.pool.invalid_timeout_config",
			value: "not-a-number",
		});
	});

	it("falls back to the default for a non-positive value", () => {
		vi.stubEnv("DB_POOL_TIMEOUT_MS", "0");
		expect(resolveDbPoolTimeoutMs()).toBe(DEFAULT_DB_POOL_TIMEOUT_MS);

		vi.stubEnv("DB_POOL_TIMEOUT_MS", "-100");
		expect(resolveDbPoolTimeoutMs()).toBe(DEFAULT_DB_POOL_TIMEOUT_MS);
	});
});
