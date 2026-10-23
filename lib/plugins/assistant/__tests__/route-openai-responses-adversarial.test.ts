import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cases/[id]/assistant/route";
import {
	eventStream,
	type ReplyParts,
	reply,
	wire,
} from "@/src/__tests__/utils/openai-responses-wire";

/**
 * The assistant route on an OpenAI connection, with only the network edge
 * replaced: the real route, model resolution, adapter, AI SDK provider and
 * network guard all run, and what reaches OpenAI's host is recorded. The
 * Responses event streams are built in the wire helper from the SDK's parser.
 */

const requireAuth = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
	connection: null as Record<string, unknown> | null,
	model: "gpt-6.1-sol",
}));

vi.mock("undici", async (importOriginal) => {
	const actual = await importOriginal<typeof import("undici")>();
	const { routeFetch: route } = await import(
		"@/src/__tests__/utils/openai-responses-wire"
	);
	return { ...actual, fetch: route(actual.fetch as never) };
});
vi.mock("@/lib/api-response", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/api-response")>()),
	requireAuth,
}));
vi.mock("@/lib/services/plugin-enablement-service", () => ({
	assertPluginEnabledForUser: vi.fn().mockResolvedValue({ data: true }),
}));
vi.mock("@/lib/services/health-status-service", () => ({
	caseHasHealthStatus: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/services/health-claim-access", () => ({
	HEALTH_PLUGIN_ID: "tea.health",
}));
vi.mock("@/lib/permissions", () => ({
	canAccessCase: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/plugins/assistant/selected-element", () => ({
	resolveSelectedElement: vi.fn().mockResolvedValue(null),
	selectionPrompt: vi.fn(() => ""),
}));
vi.mock("@/lib/plugins/assistant/tools", async () => {
	const { tool } = await import("ai");
	const { z } = await import("zod");
	return {
		buildSystemPrompt: vi.fn(() => "You are the case assistant."),
		createCaseTools: vi.fn(() => ({
			read_case: tool({
				description: "Reads the case",
				inputSchema: z.object({}),
				execute: () => Promise.resolve({ name: "The case" }),
			}),
			read_element: tool({
				description: "Reads one element",
				inputSchema: z.object({ elementId: z.string() }),
				execute: ({ elementId }) => Promise.resolve({ id: elementId }),
			}),
		})),
	};
});
vi.mock("@/lib/services/model-connection-service", () => ({
	getRoles: vi.fn(() =>
		Promise.resolve({
			data: {
				chat: { connectionId: "conn-1", model: state.model },
				ranking: null,
				search: null,
				searchCheck: null,
			},
		})
	),
	getConnectionForUse: vi.fn(() => Promise.resolve({ data: state.connection })),
}));

const KEY = "sk-test-OPENAI-key-1234";
const ENV_KEY = "sk-ENV-key-that-must-not-be-used";
const RESPONSES_URL = "https://api.openai.com/v1/responses";
const CASE_ID = "11111111-1111-4111-8111-111111111111";
const ENCRYPTED = "ENC-rs_1-opaque";
const ANSWER = "P1 fits an explainability technique.";
const REASONING = { id: "rs_1", encrypted: ENCRYPTED } as const;
const TOOL_CALL = { id: "fc_1", callId: "call_1", name: "read_case" } as const;
const NOT_SENT_TO_OPENAI = [
	"max_tokens",
	"max_completion_tokens",
	"previous_response_id",
	"conversation",
	"reasoning",
	"reasoning_effort",
	"temperature",
	"top_p",
];

type Item = Record<string, unknown>;

function connection(overrides: Record<string, unknown> = {}) {
	return {
		id: "conn-1",
		label: "OpenAI",
		type: "OPENAI",
		baseUrl: "https://api.openai.com/v1",
		apiKey: KEY,
		...overrides,
	};
}

const userMessage = (id: string, text: string): UIMessage => ({
	id,
	role: "user",
	parts: [{ type: "text", text }],
});

function ask(messages: UIMessage[]): Promise<Response> {
	return POST(
		new Request("http://localhost/api/cases/x/assistant", {
			method: "POST",
			body: JSON.stringify({ messages }),
		}),
		{ params: Promise.resolve({ id: CASE_ID }) }
	);
}

async function chunksOf(response: Response): Promise<UIMessageChunk[]> {
	const text = await response.text();
	return text.split("\n\n").flatMap((block) => {
		const data = block.startsWith("data: ") ? block.slice(6) : "";
		return data && data !== "[DONE]"
			? [JSON.parse(data) as UIMessageChunk]
			: [];
	});
}

/** The assistant message the browser builds from a reply's stream. */
async function messageFrom(chunks: UIMessageChunk[]): Promise<UIMessage> {
	const stream = new ReadableStream<UIMessageChunk>({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(chunk);
			}
			controller.close();
		},
	});
	let last: UIMessage | undefined;
	for await (const message of readUIMessageStream({ stream })) {
		last = message;
	}
	if (!last) {
		throw new Error("The stream held no message");
	}
	return last;
}

function queue(...replies: ReplyParts[]): void {
	for (const parts of replies) {
		wire.replies.push(() => reply(parts));
	}
}

const toolStep: ReplyParts = { reasoning: REASONING, toolCalls: [TOOL_CALL] };
const answerStep: ReplyParts = { text: { id: "msg_1", text: ANSWER } };

function inputOf(index: number): Item[] {
	return wire.requests[index]?.body.input as Item[];
}

beforeEach(() => {
	wire.reset();
	state.connection = connection();
	state.model = "gpt-6.1-sol";
	requireAuth.mockResolvedValue("user-1");
	vi.stubEnv("OPENAI_API_KEY", ENV_KEY);
	vi.stubEnv("OPENAI_BASE_URL", "https://env.example.test/v1");
	vi.stubEnv("OPENAI_ORGANIZATION", "org-from-the-server");
	vi.stubEnv("OPENAI_PROJECT", "proj-from-the-server");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("a reply on an OpenAI connection, as OpenAI receives it", () => {
	it("posts every step to /v1/responses with the key in the header only, store off, the tools and the output limit, and finishes the reply", async () => {
		queue(toolStep, answerStep);

		const chunks = await chunksOf(
			await ask([userMessage("u1", "Techniques?")])
		);

		expect(wire.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
			`POST ${RESPONSES_URL}`,
			`POST ${RESPONSES_URL}`,
		]);
		for (const request of wire.requests) {
			expect(request.headers.get("authorization")).toBe(`Bearer ${KEY}`);
			expect(request.body).toMatchObject({
				model: "gpt-6.1-sol",
				store: false,
				stream: true,
				max_output_tokens: 8192,
				include: ["reasoning.encrypted_content"],
			});
			for (const field of NOT_SENT_TO_OPENAI) {
				expect(request.body).not.toHaveProperty(field);
			}
			expect(request.body.tools).toEqual([
				expect.objectContaining({ type: "function", name: "read_case" }),
				expect.objectContaining({ type: "function", name: "read_element" }),
			]);
			expect(request.rawBody).not.toContain(KEY);
			expect(request.url).not.toContain(KEY);
			for (const [name, value] of request.headers) {
				if (name !== "authorization") {
					expect(value).not.toContain(KEY);
				}
			}
		}
		expect(JSON.stringify(wire.requests)).not.toContain(ENV_KEY);
		for (const request of wire.requests) {
			expect(request.headers.get("openai-organization")).toBeNull();
			expect(request.headers.get("openai-project")).toBeNull();
		}
		expect(chunks.map((c) => c.type)).toContain("tool-output-available");
		const text = chunks.flatMap((c) =>
			c.type === "text-delta" ? [c.delta] : []
		);
		expect(text.join("")).toBe(ANSWER);
	});

	it("carries the reasoning and the tool exchange to the next step as content, with no reference to a stored item", async () => {
		queue(toolStep, answerStep);

		await chunksOf(await ask([userMessage("u1", "Techniques?")]));

		const second = inputOf(1);
		expect(second).toContainEqual(
			expect.objectContaining({
				type: "reasoning",
				id: "rs_1",
				encrypted_content: ENCRYPTED,
			})
		);
		expect(second).toContainEqual(
			expect.objectContaining({ type: "function_call", call_id: "call_1" })
		);
		expect(second).toContainEqual(
			expect.objectContaining({
				type: "function_call_output",
				call_id: "call_1",
			})
		);
		expect(JSON.stringify(wire.requests[1]?.body)).not.toContain(
			"item_reference"
		);
	});

	it("carries every earlier step's reasoning and tool exchange, once each, through a reply of several steps", async () => {
		queue(
			toolStep,
			{
				reasoning: { id: "rs_2", encrypted: "ENC-rs_2-opaque" },
				toolCalls: [
					{ id: "fc_2", callId: "call_2", name: "read_element" },
					{ id: "fc_3", callId: "call_3", name: "read_element" },
				],
			},
			answerStep
		);

		const chunks = await chunksOf(
			await ask([userMessage("u1", "Techniques?")])
		);

		expect(wire.requests).toHaveLength(3);
		expect(inputOf(2).map((item) => item.type ?? item.role)).toEqual([
			"developer",
			"user",
			"reasoning",
			"function_call",
			"function_call_output",
			"reasoning",
			"function_call",
			"function_call",
			"function_call_output",
			"function_call_output",
		]);
		expect(
			inputOf(2)
				.filter((item) => item.type === "reasoning")
				.map((item) => item.encrypted_content)
		).toEqual([ENCRYPTED, "ENC-rs_2-opaque"]);
		expect(JSON.stringify(inputOf(2))).not.toContain("item_reference");
		const text = chunks.flatMap((c) =>
			c.type === "text-delta" ? [c.delta] : []
		);
		expect(text.join("")).toBe(ANSWER);
	});

	it("sends a valid request for a model that does not reason", async () => {
		state.model = "gpt-4.1";
		queue(answerStep);

		await chunksOf(await ask([userMessage("u1", "Techniques?")]));

		const [request] = wire.requests;
		expect(request?.url).toBe(RESPONSES_URL);
		expect(request?.body).toMatchObject({
			model: "gpt-4.1",
			store: false,
			max_output_tokens: 8192,
		});
		for (const field of [...NOT_SENT_TO_OPENAI, "include"]) {
			expect(request?.body).not.toHaveProperty(field);
		}
		expect(inputOf(0)[0]).toMatchObject({ role: "system" });
		expect(inputOf(0).at(-1)).toMatchObject({ role: "user" });
	});

	it.each([
		["gpt-6.1-sol", true],
		["gpt-5", true],
		["o4-mini", true],
		["gpt-4.1", false],
		["gpt-4o", false],
		["gpt-5-chat-latest", false],
	])("asks for encrypted reasoning from %s only if it reasons (%s)", async (model, reasons) => {
		state.model = model;
		queue(answerStep);

		await chunksOf(await ask([userMessage("u1", "Techniques?")]));

		expect(wire.requests[0]?.body.store).toBe(false);
		if (reasons) {
			expect(wire.requests[0]?.body.include).toEqual([
				"reasoning.encrypted_content",
			]);
		} else {
			expect(wire.requests[0]?.body).not.toHaveProperty("include");
		}
	});
});

describe("a second user turn after a reply that reasoned and called a tool", () => {
	it.each([
		["no summary", undefined],
		["two summary parts", ["Looking at P1.", "Choosing a technique."]],
	])("sends the reasoning's encrypted content and no stored-item reference, with %s", async (_name, summaries) => {
		queue({ ...toolStep, reasoning: { ...REASONING, summaries } }, answerStep, {
			text: { id: "msg_2", text: "For P2, consider a robustness test." },
		});
		const first = await chunksOf(await ask([userMessage("u1", "Techniques?")]));
		const history = [
			userMessage("u1", "Techniques?"),
			await messageFrom(first),
			userMessage("u2", "And for P2?"),
		];

		await chunksOf(await ask(history));

		expect(wire.requests).toHaveLength(3);
		const body = wire.requests[2]?.body;
		const input = inputOf(2);
		expect(wire.requests[2]?.url).toBe(RESPONSES_URL);
		expect(JSON.stringify(body)).not.toContain("item_reference");
		expect(body).not.toHaveProperty("previous_response_id");
		expect(body).not.toHaveProperty("conversation");
		expect(body?.store).toBe(false);
		const reasoning = input.filter((item) => item.type === "reasoning");
		expect(reasoning).toEqual([
			expect.objectContaining({ id: "rs_1", encrypted_content: ENCRYPTED }),
		]);
		expect(input.map((item) => item.type ?? item.role)).toEqual([
			"developer",
			"user",
			"reasoning",
			"function_call",
			"function_call_output",
			"assistant",
			"user",
		]);
		expect(input.at(-1)).toMatchObject({ role: "user" });
	});

	it("sends no reasoning item for thinking that came from another provider", async () => {
		const earlier: UIMessage = {
			id: "a1",
			role: "assistant",
			parts: [
				{
					type: "reasoning",
					text: "Thinking it over.",
					state: "done",
					providerMetadata: { openrouter: { reasoning_details: [{ x: 1 }] } },
				},
				{ type: "text", text: "An earlier answer.", state: "done" },
			],
		};
		queue(answerStep);

		await chunksOf(
			await ask([
				userMessage("u1", "Techniques?"),
				earlier,
				userMessage("u2", "And for P2?"),
			])
		);

		const input = inputOf(0);
		expect(input.some((item) => item.type === "reasoning")).toBe(false);
		expect(JSON.stringify(input)).not.toContain("item_reference");
		expect(input.map((item) => item.role ?? item.type)).toEqual([
			"developer",
			"user",
			"assistant",
			"user",
		]);
	});
});

describe("OpenAI's address and key", () => {
	it("refuses to build the model without a key, and sends nothing, whatever the server's environment holds", async () => {
		for (const apiKey of [null, ""]) {
			state.connection = connection({ apiKey });

			const response = await ask([userMessage("u1", "Techniques?")]);

			expect(response.status).toBe(409);
			expect(await response.text()).not.toContain(ENV_KEY);
		}
		expect(wire.requests).toEqual([]);
	});

	it("goes to OpenAI's fixed address when the stored connection holds another one", async () => {
		state.connection = connection({ baseUrl: "http://169.254.169.254/latest" });
		queue(answerStep);

		await chunksOf(await ask([userMessage("u1", "Techniques?")]));

		expect(wire.requests.map((r) => r.url)).toEqual([RESPONSES_URL]);
	});

	it("cuts off a reply larger than the chat cap, as it does on the other types", async () => {
		wire.replies.push(() =>
			eventStream([
				{
					type: "response.created",
					response: { id: "resp_1", created_at: 1, model: "m" },
				},
				{
					type: "response.output_item.added",
					output_index: 0,
					item: { type: "message", id: "msg_1" },
				},
				{
					type: "response.output_text.delta",
					item_id: "msg_1",
					delta: "x".repeat(5 * 1024 * 1024),
				},
			])
		);

		const chunks = await chunksOf(
			await ask([userMessage("u1", "Techniques?")])
		);

		expect(chunks.map((c) => c.type)).toContain("error");
		expect(chunks.map((c) => c.type)).not.toContain("text-end");
	});
});

describe("a refusal from OpenAI's Responses endpoint", () => {
	it("shows OpenAI's reason without the key, and does not retry a request it refused", async () => {
		wire.replies.push(() =>
			Response.json(
				{
					error: {
						message: `Unsupported value for the model. Key ${KEY} was used.`,
						type: "invalid_request_error",
						param: "model",
						code: "unsupported_value",
					},
				},
				{ status: 400 }
			)
		);

		const chunks = await chunksOf(
			await ask([userMessage("u1", "Techniques?")])
		);

		const failure = chunks.find((chunk) => chunk.type === "error");
		expect(failure).toMatchObject({
			errorText: expect.stringContaining("Unsupported value"),
		});
		expect(JSON.stringify(chunks)).not.toContain(KEY);
		expect(wire.requests).toHaveLength(1);
	});
});

describe("a failure OpenAI reports inside a stream that began with status 200", () => {
	it.each([
		[
			"a failed response",
			{
				type: "response.failed",
				sequence_number: 1,
				response: {
					error: { code: "invalid_prompt", message: "Unusable prompt text." },
				},
			},
		],
		[
			"an error event with the error nested",
			{
				type: "error",
				sequence_number: 1,
				error: {
					type: "invalid_request_error",
					code: "invalid_prompt",
					message: "Unusable prompt text.",
					param: null,
				},
			},
		],
		[
			"an error event with the fields at the top level",
			{
				type: "error",
				sequence_number: 1,
				code: "invalid_prompt",
				message: "Unusable prompt text.",
				param: null,
			},
		],
	])("tells the user OpenAI's reason for %s, without the key", async (_name, failure) => {
		wire.replies.push(() =>
			eventStream([
				{
					type: "response.created",
					response: { id: "resp_1", created_at: 1, model: "m" },
				},
				failure,
			])
		);

		const chunks = await chunksOf(
			await ask([userMessage("u1", "Techniques?")])
		);

		expect(JSON.stringify(chunks.filter((c) => c.type === "error"))).toContain(
			"Unusable prompt text."
		);
		expect(JSON.stringify(chunks)).not.toContain(KEY);
	});
});

describe("a reply that runs out of output room", () => {
	it("gives the user the length notice when OpenAI ends it as incomplete", async () => {
		queue({
			reasoning: { id: "rs_1", encrypted: ENCRYPTED },
			incompleteReason: "max_output_tokens",
		});

		const chunks = await chunksOf(
			await ask([userMessage("u1", "Techniques?")])
		);

		expect(chunks).toContainEqual({ type: "data-notice", data: "length" });
	});
});
