import { afterEach, describe, expect, it, vi } from "vitest";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import { listAllowedBaseUrls } from "../allowed-base-urls";

afterEach(() => {
	resetLogSink();
	vi.unstubAllEnvs();
});

describe("listAllowedBaseUrls", () => {
	it("trims entries, strips trailing slashes and keeps valid ones when another is invalid", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries: LogEntry[] = [];
		setLogSink((entry) => entries.push(entry));
		vi.stubEnv(
			"ASSISTANT_ALLOWED_BASE_URLS",
			" https://a.example/v1/ ,tok-en-secret,https://b.example/v1"
		);

		expect(listAllowedBaseUrls()).toEqual([
			"https://a.example/v1",
			"https://b.example/v1",
		]);
		const warnings = entries.filter((entry) => entry.level === "warn");
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatchObject({ position: 2 });
		expect(JSON.stringify(warnings)).not.toContain("tok-en-secret");
	});

	it("returns nothing when the variable is unset", () => {
		vi.stubEnv("ASSISTANT_ALLOWED_BASE_URLS", "");
		expect(listAllowedBaseUrls()).toEqual([]);
	});
});
