import { afterEach, describe, expect, it, vi } from "vitest";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import { listLocalOrigins } from "../local-addresses";

afterEach(() => {
	resetLogSink();
	vi.unstubAllEnvs();
});

describe("listLocalOrigins", () => {
	it("reduces entries to origins and keeps valid ones when another is invalid", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries: LogEntry[] = [];
		setLogSink((entry) => entries.push(entry));
		vi.stubEnv(
			"TEA_MODELS_LOCAL_ADDRESSES",
			" http://host.docker.internal:11434/ ,tok-en-secret,ftp://a.example,http://u:p-secret@c.example,https://b.example/v1,https://b.example:443"
		);

		expect(listLocalOrigins()).toEqual([
			"http://host.docker.internal:11434",
			"https://b.example",
		]);
		const warnings = entries.filter((entry) => entry.level === "warn");
		expect(warnings.map((warning) => warning.position)).toEqual([2, 3, 4]);
		expect(JSON.stringify(warnings)).not.toContain("tok-en-secret");
		expect(JSON.stringify(warnings)).not.toContain("p-secret");
	});

	it("skips blank entries without a warning and still counts their position", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries: LogEntry[] = [];
		setLogSink((entry) => entries.push(entry));
		vi.stubEnv(
			"TEA_MODELS_LOCAL_ADDRESSES",
			"http://a.example, ,\t,,https://b.example,ftp://c.example"
		);

		expect(listLocalOrigins()).toStrictEqual([
			"http://a.example",
			"https://b.example",
		]);
		const warnings = entries.filter((entry) => entry.level === "warn");
		expect(warnings.map((warning) => warning.position)).toStrictEqual([6]);
	});

	it("returns nothing when the variable is unset or empty", () => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
		expect(listLocalOrigins()).toEqual([]);
	});
});
