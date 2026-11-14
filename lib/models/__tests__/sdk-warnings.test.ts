import { readFileSync } from "node:fs";
import { streamText } from "ai";
import { afterEach, expect, it, vi } from "vitest";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import { guardedFetch } from "../guarded-fetch";

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
