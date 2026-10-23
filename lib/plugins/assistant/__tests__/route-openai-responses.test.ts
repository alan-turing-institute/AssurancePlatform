import { readFileSync } from "node:fs";
import {
	readUIMessageStream,
	tool,
	type UIMessage,
	type UIMessageChunk,
} from "ai";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { POST } from "@/app/api/cases/[id]/assistant/route";
import { chatModelFor, chatProviderOptions } from "@/lib/models/adapters";
import { guardedFetch } from "@/lib/models/guarded-fetch";
import { canAccessCase } from "@/lib/permissions";
import { resolveChatModel } from "@/lib/plugins/assistant/model-config";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import { caseHasHealthStatus } from "@/lib/services/health-status-service";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";

vi.mock("@/lib/models/guarded-fetch", () => ({ guardedFetch: vi.fn() }));
const requireAuth = vi.hoisted(() => vi.fn().mockResolvedValue("user-1"));

vi.mock("@/lib/api-response", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/api-response")>()),
	requireAuth,
}));
vi.mock("@/lib/services/plugin-enablement-service", () => ({
	assertPluginEnabledForUser: vi.fn(),
}));
vi.mock("@/lib/services/health-status-service", () => ({
	caseHasHealthStatus: vi.fn(),
}));
vi.mock("@/lib/services/health-claim-access", () => ({
	HEALTH_PLUGIN_ID: "tea.health",
}));
vi.mock("@/lib/plugins/assistant/tools", () => ({
	buildSystemPrompt: vi.fn(() => ""),
	createCaseTools: vi.fn(),
}));
vi.mock("@/lib/plugins/assistant/selected-element", () => ({
	resolveSelectedElement: vi.fn().mockResolvedValue(null),
	selectionPrompt: vi.fn(() => ""),
}));
vi.mock("@/lib/permissions", () => ({ canAccessCase: vi.fn() }));
vi.mock("@/lib/plugins/assistant/model-config", () => ({
	modelAccessFor: vi.fn(),
	resolveChatModel: vi.fn(),
}));

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const CONNECTION = {
	type: "OPENAI",
	baseUrl: "https://api.openai.com/v1",
	apiKey: "connection-key",
} as const;
const user: UIMessage = {
	id: "u1",
	role: "user",
	parts: [{ type: "text", text: "Check the case" }],
};
const lookup = vi.fn(({ query }: { query: string }) => `Found ${query}`);

function fixture(name: string) {
	return new Response(
		readFileSync(
			`lib/plugins/assistant/__tests__/fixtures/openai-${name}.sse`,
			"utf8"
		),
		{ headers: { "content-type": "text/event-stream" } }
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(assertPluginEnabledForUser).mockResolvedValue({ data: true });
	vi.mocked(canAccessCase).mockResolvedValue(true);
	vi.mocked(caseHasHealthStatus).mockResolvedValue(false);
	vi.mocked(createCaseTools).mockReturnValue({
		lookup: tool({
			inputSchema: z.object({ query: z.string() }),
			execute: lookup,
		}),
	} as unknown as ReturnType<typeof createCaseTools>);
	vi.mocked(resolveChatModel).mockResolvedValue({
		model: chatModelFor(CONNECTION, "gpt-6.1-sol"),
		providerOptions: chatProviderOptions(CONNECTION),
		secrets: { apiKey: CONNECTION.apiKey, baseUrl: CONNECTION.baseUrl },
	});
	vi.mocked(guardedFetch).mockImplementation((_url, init) => {
		const body = JSON.parse(String(init?.body));
		const hasResult = body.input.some(
			(item: { type: string }) => item.type === "function_call_output"
		);
		return Promise.resolve(fixture(hasResult ? "answer" : "tool"));
	});
});
afterEach(() => vi.unstubAllGlobals());

async function reply(messages: UIMessage[]) {
	// A stray use of global fetch must fail rather than contact a real provider.
	vi.stubGlobal(
		"fetch",
		vi.fn(() => {
			throw new Error("Unexpected network request");
		})
	);
	const response = await POST(
		new Request("http://localhost/api/cases/x/assistant", {
			method: "POST",
			body: JSON.stringify({ messages }),
		}),
		{ params: Promise.resolve({ id: CASE_ID }) }
	);
	if (response.status !== 200) {
		throw new Error(`Route returned ${response.status}`);
	}
	const chunks: UIMessageChunk[] = (await response.text())
		.split("\n")
		.filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
		.map((line) => JSON.parse(line.slice(6)));
	const stream = new ReadableStream<UIMessageChunk>({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(chunk);
			}
			controller.close();
		},
	});
	let message: UIMessage | undefined;
	for await (const current of readUIMessageStream({
		stream,
		onError: (error) => {
			throw error;
		},
	})) {
		message = current;
	}
	if (!message) {
		throw new Error("No assistant message received");
	}
	return { message, chunks };
}

function bodies() {
	return vi
		.mocked(guardedFetch)
		.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
}

it("streams a Responses tool call, executes it, sends its result and streams the final text through the route", async () => {
	const { message, chunks } = await reply([user]);
	expect(lookup).toHaveBeenCalledTimes(1);
	expect(lookup.mock.calls[0]?.[0]).toEqual({ query: "x" });
	expect(chunks.map((chunk) => chunk.type)).toEqual(
		expect.arrayContaining([
			"tool-input-available",
			"tool-output-available",
			"text-delta",
		])
	);
	expect(message.parts).toEqual(
		expect.arrayContaining([
			{
				type: "text",
				text: "The case is ready.",
				state: "done",
				providerMetadata: { openai: { itemId: "msg_1" } },
			},
		])
	);
	const requests = bodies();
	expect(requests).toHaveLength(2);
	expect(requests[1].input).toEqual(
		expect.arrayContaining([
			{ type: "function_call_output", call_id: "call_1", output: "Found x" },
			expect.objectContaining({
				type: "reasoning",
				encrypted_content: "encrypted-tool",
			}),
		])
	);
	for (const body of requests) {
		expect(body).toMatchObject({ store: false, max_output_tokens: 8192 });
		expect(body.tools).toEqual(
			expect.arrayContaining([expect.objectContaining({ name: "lookup" })])
		);
		expect(body).not.toHaveProperty("max_tokens");
		expect(body).not.toHaveProperty("max_completion_tokens");
	}
	expect(
		vi
			.mocked(guardedFetch)
			.mock.calls.every(
				([url]) => url === "https://api.openai.com/v1/responses"
			)
	).toBe(true);
});

it("replays reasoning and tool history on the next user turn without references to stored items", async () => {
	const first = await reply([user]);
	expect(first.message.parts).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				type: "reasoning",
				providerMetadata: {
					openai: {
						itemId: "rs_tool",
						reasoningEncryptedContent: "encrypted-tool",
					},
				},
			}),
		])
	);
	await reply([
		user,
		first.message,
		{ id: "u2", role: "user", parts: [{ type: "text", text: "Explain that" }] },
	]);
	const body = bodies()[2];
	expect(body.store).toBe(false);
	expect(body).not.toHaveProperty("previous_response_id");
	expect(
		body.input.some((item: { type: string }) => item.type === "item_reference")
	).toBe(false);
	expect(body.input).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				type: "reasoning",
				encrypted_content: "encrypted-tool",
			}),
			expect.objectContaining({
				type: "reasoning",
				encrypted_content: "encrypted-answer",
			}),
			expect.objectContaining({
				type: "function_call",
				call_id: "call_1",
				arguments: '{"query":"x"}',
			}),
			expect.objectContaining({
				type: "function_call_output",
				call_id: "call_1",
				output: "Found x",
			}),
		])
	);
	expect(lookup).toHaveBeenCalledTimes(1);
});
