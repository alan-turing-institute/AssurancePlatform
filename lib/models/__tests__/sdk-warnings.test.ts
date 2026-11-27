import { readFileSync } from "node:fs";
import { streamText, type Warning } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import { guardedFetch } from "../guarded-fetch";
import { logSdkWarnings } from "../sdk-warnings";

vi.mock("../guarded-fetch", async (importOriginal) => {
	const original = await importOriginal<typeof import("../guarded-fetch")>();
	return { ...original, guardedFetch: vi.fn() };
});

import { chatModelFor, chatProviderOptions } from "../adapters";

const CASE_TEXT = "the audit found the supplier falsified its safety records";

afterEach(() => {
	resetLogSink();
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

it("keeps the text of an SDK warning out of console.warn and the log", async () => {
	vi.stubEnv("LOG_LEVEL", "debug");
	const entries: LogEntry[] = [];
	setLogSink((entry) => {
		entries.push(entry);
	});
	const printed = [
		vi.spyOn(console, "warn").mockImplementation(() => undefined),
		vi.spyOn(console, "info").mockImplementation(() => undefined),
	];
	vi.mocked(guardedFetch).mockResolvedValue(
		new Response(
			readFileSync(
				"lib/plugins/assistant/__tests__/fixtures/openai-answer.sse",
				"utf8"
			),
			{ headers: { "content-type": "text/event-stream" } }
		)
	);
	const access = {
		type: "OPENAI",
		baseUrl: "https://ignored.example",
		apiKey: "sk-test-secret-key",
	} as const;

	// A reasoning part with no OpenAI item id makes the OpenAI provider warn
	// with the part's JSON, case text included.
	const result = streamText({
		model: chatModelFor(access, "gpt-6.1-sol"),
		providerOptions: chatProviderOptions(access),
		maxRetries: 0,
		messages: [
			{ role: "user", content: "Is the supplier safe?" },
			{
				role: "assistant",
				content: [
					{ type: "reasoning", text: CASE_TEXT },
					{ type: "text", text: "Checking." },
				],
			},
			{ role: "user", content: "Go on." },
		],
	});
	await result.consumeStream();
	await result.text;

	expect(entries).toHaveLength(1);
	expect(entries[0]).toMatchObject({
		level: "warn",
		msg: "AI SDK warning",
		type: "other",
	});
	expect(JSON.stringify(entries)).not.toContain(CASE_TEXT);
	for (const spy of printed) {
		expect(spy).not.toHaveBeenCalled();
	}
});

const SECRET = "the audit found the supplier falsified its safety records";

/** What the log receives when the SDK reports these warnings. */
function logged(warnings: object[], level = "debug"): LogEntry[] {
	vi.stubEnv("LOG_LEVEL", level);
	const entries: LogEntry[] = [];
	setLogSink((entry) => {
		entries.push(entry);
	});
	logSdkWarnings({
		warnings: warnings as Warning[],
		provider: "test-provider",
		model: "test-model",
	});
	return entries;
}

/** An entry without the values the logger fills in itself. */
function fieldsOf(entry: LogEntry | undefined) {
	const own = ["ts", "level", "msg", "component"];
	return Object.fromEntries(
		Object.entries(entry ?? {}).filter(([key]) => !own.includes(key))
	);
}

describe("logSdkWarnings", () => {
	it.each([
		[
			"a type and a feature",
			{ type: "unsupported", feature: "topK", details: SECRET },
			{ type: "unsupported", feature: "topK" },
		],
		[
			"a type and a setting",
			{ type: "unsupported-setting", setting: "temperature", details: SECRET },
			{ type: "unsupported-setting", setting: "temperature" },
		],
		[
			"a type, a feature and a setting",
			{ type: "compatibility", feature: "tools", setting: "toolChoice" },
			{ type: "compatibility", feature: "tools", setting: "toolChoice" },
		],
		["a type alone", { type: "other", message: SECRET }, { type: "other" }],
		[
			"a feature that is not text",
			{ type: "unsupported", feature: 5, message: SECRET },
			{ type: "unsupported" },
		],
		[
			"a setting that is not text",
			{ type: "unsupported-setting", setting: { name: SECRET } },
			{ type: "unsupported-setting" },
		],
	])("logs %s with the provider and model, and nothing the warning says", (_label, warning, expected) => {
		const entries = logged([warning]);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.level).toBe("warn");
		expect(fieldsOf(entries[0])).toStrictEqual({
			provider: "test-provider",
			model: "test-model",
			...expected,
		});
		expect(JSON.stringify(entries)).not.toContain(SECRET);
	});

	it("writes one entry for each warning, in order", () => {
		const entries = logged([
			{ type: "other", message: "first" },
			{ type: "unsupported", feature: "second" },
			{ type: "unsupported-setting", setting: "third" },
		]);

		expect(entries.map((entry) => entry.type)).toStrictEqual([
			"other",
			"unsupported",
			"unsupported-setting",
		]);
	});

	it("writes nothing when there are no warnings", () => {
		expect(logged([])).toStrictEqual([]);
	});

	it("writes at the warn level, so the error threshold hides it and the warn threshold shows it", () => {
		const warning = { type: "other", message: SECRET };

		expect(logged([warning], "error")).toStrictEqual([]);
		expect(logged([warning], "warn")).toHaveLength(1);
	});
});
