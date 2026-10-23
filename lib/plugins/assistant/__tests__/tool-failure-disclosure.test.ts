// biome-ignore-all lint/suspicious/noMisplacedAssertion: the shared helpers are called from within it() blocks
import { stepCountIs, streamText } from "ai";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportCase } from "@/lib/services/case-export-service";
import { readHealthStatusesForCase } from "@/lib/services/health-status-service";
import { captureLogs } from "@/src/__tests__/helpers/capture-logs";
import { createCaseTools } from "../tools";

/**
 * What the model is handed when a case-reading tool's work throws. The SDK
 * turns a thrown error into text for the model, using the error's own message,
 * so no tool may throw: each gives a fixed result and logs the error's class.
 * The thrown values here are the shapes a failing layer can produce: an
 * error that names a host, a query or a path, an error with no message whose
 * cause names the host, and values that are not errors at all.
 */

vi.mock("@/lib/services/case-export-service", () => ({ exportCase: vi.fn() }));
vi.mock("@/lib/services/health-status-service", () => ({
	readClaimEvidenceNodes: vi.fn().mockResolvedValue([]),
	readHealthStatusesForCase: vi.fn(),
}));

const options = { toolCallId: "t", messages: [] };
const HOST = "db-prod.internal";
/** Pieces of the environment that must never reach the model or a log. */
const REVEALING = [
	HOST,
	"10.0.3.7",
	"5432",
	"ECONNREFUSED",
	"SELECT",
	"password",
	"/srv/app",
	"at Object.",
	"Pr0d-S3cret",
];

const TREE = {
	id: "g1",
	type: "GOAL",
	name: "G1",
	description: "top",
	children: [
		{
			id: "p1",
			type: "PROPERTY_CLAIM",
			name: "P1",
			description: "claim",
			children: [],
		},
	],
} as never;

class DriverFailure extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DriverFailure";
	}
}

function withStack(error: Error): Error {
	error.stack = `${error.name}: ${error.message}\n    at Object.query (/srv/app/node_modules/pg/lib/client.js:12:3)`;
	return error;
}

const THROWN: [string, () => unknown][] = [
	[
		"an error that names the host and port",
		() => withStack(new Error(`connect ECONNREFUSED 10.0.3.7:5432 (${HOST})`)),
	],
	[
		"an error that holds a query and a password",
		() =>
			new DriverFailure(
				`SELECT * FROM users WHERE password = 'Pr0d-S3cret' on ${HOST}`
			),
	],
	[
		"an error with no message whose cause names the host",
		() =>
			new Error(undefined, {
				cause: new Error(`connect ECONNREFUSED 10.0.3.7:5432 (${HOST})`),
			}),
	],
	[
		"an aggregate error with no message",
		() =>
			Object.assign(
				new AggregateError(
					[new Error(`ECONNREFUSED 10.0.3.7:5432 ${HOST}`)],
					"unused"
				),
				{ message: "" }
			),
	],
	["a string", () => `connect ECONNREFUSED 10.0.3.7:5432 (${HOST})`],
	[
		"an object with a message",
		() => ({ message: `connect ECONNREFUSED 10.0.3.7:5432 (${HOST})` }),
	],
	[
		"an object with only a code, an address and a port",
		() => ({ code: "ECONNREFUSED", address: "10.0.3.7", port: 5432 }),
	],
	[
		"an object that turns into text naming the host",
		() => ({ toString: () => `connect ECONNREFUSED 10.0.3.7:5432 ${HOST}` }),
	],
	["null", () => null],
	["undefined", () => undefined],
	["a number", () => 5432],
];

/** The tools by name, each with the input it takes and a way to make the layer under it throw. */
const TOOLS = [
	{
		name: "read_case",
		input: {},
		claimHealth: false,
		breakWith: (thrown: unknown) =>
			vi.mocked(exportCase).mockRejectedValue(thrown),
	},
	{
		name: "read_element",
		input: { elementId: "p1" },
		claimHealth: false,
		breakWith: (thrown: unknown) =>
			vi.mocked(exportCase).mockRejectedValue(thrown),
	},
	{
		name: "lint_case",
		input: {},
		claimHealth: false,
		breakWith: (thrown: unknown) =>
			vi.mocked(exportCase).mockRejectedValue(thrown),
	},
	{
		name: "read_claim_health",
		input: {},
		claimHealth: true,
		breakWith: (thrown: unknown) =>
			vi.mocked(exportCase).mockRejectedValue(thrown),
	},
	{
		name: "read_claim_health (status read)",
		toolName: "read_claim_health",
		input: {},
		claimHealth: true,
		breakWith: (thrown: unknown) =>
			vi.mocked(readHealthStatusesForCase).mockRejectedValue(thrown),
	},
] as const;

function exportSucceeds() {
	vi.mocked(exportCase).mockResolvedValue({
		data: {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			case: { name: "Case", description: "d" },
			tree: TREE,
		},
	});
}

beforeEach(() => {
	vi.mocked(exportCase).mockReset();
	vi.mocked(readHealthStatusesForCase).mockReset();
	exportSucceeds();
	vi.mocked(readHealthStatusesForCase).mockResolvedValue({ data: [] });
});

function toolsFor(claimHealth: boolean) {
	return createCaseTools("u", "c", { claimHealth });
}

function run(
	tools: ReturnType<typeof toolsFor>,
	name: string,
	input: object
): Promise<unknown> {
	const tool = (
		tools as Record<
			string,
			{ execute?: (input: object, options: unknown) => unknown }
		>
	)[name];
	return Promise.resolve(tool?.execute?.(input, options));
}

function expectNoneOf(shown: string) {
	for (const piece of REVEALING) {
		expect(shown, `must not hold "${piece}"`).not.toContain(piece);
	}
}

describe("a tool whose work throws", () => {
	describe.each(TOOLS)("$name", (tool) => {
		const name = "toolName" in tool ? tool.toolName : tool.name;

		it.each(
			THROWN
		)("answers without throwing, and without detail, when it is thrown %s", async (_label, make) => {
			tool.breakWith(make());

			const result = await run(toolsFor(tool.claimHealth), name, tool.input);

			expect(result).toMatchObject({ found: false });
			expect((result as { message: unknown }).message).toEqual(
				expect.any(String)
			);
			expectNoneOf(JSON.stringify(result));
		});

		it("gives the same answer whatever was thrown", async () => {
			const answers: string[] = [];
			for (const [, make] of THROWN) {
				tool.breakWith(make());
				answers.push(
					JSON.stringify(
						await run(toolsFor(tool.claimHealth), name, tool.input)
					)
				);
			}

			expect(new Set(answers).size).toBe(1);
		});

		it("logs the error's class and nothing the error said", async () => {
			const logs = captureLogs();
			try {
				tool.breakWith(
					withStack(new DriverFailure(`ECONNREFUSED 10.0.3.7:5432 ${HOST}`))
				);

				await run(toolsFor(tool.claimHealth), name, tool.input);

				expect(logs.entries.length).toBeGreaterThan(0);
				expectNoneOf(JSON.stringify(logs.entries));
				expect(logs.entries.map((entry) => entry.errorName)).toContain(
					"DriverFailure"
				);
				for (const entry of logs.entries) {
					expect(entry).not.toHaveProperty("error");
					expect(entry).not.toHaveProperty("stack");
					expect(entry).not.toHaveProperty("message");
					expect(entry).not.toHaveProperty("cause");
				}
			} finally {
				logs.restore();
			}
		});

		it("logs no text from a thrown value that is not an error", async () => {
			const logs = captureLogs();
			try {
				for (const [, make] of THROWN) {
					tool.breakWith(make());
					await run(toolsFor(tool.claimHealth), name, tool.input);
				}

				expectNoneOf(JSON.stringify(logs.entries));
			} finally {
				logs.restore();
			}
		});
	});
});

describe("what the SDK gives the model after a tool's work throws", () => {
	const USAGE = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};

	function modelCalling(toolName: string, input: object, seen: unknown[]) {
		let step = 0;
		const toolChunks = [
			{ type: "stream-start" as const, warnings: [] },
			{
				type: "tool-call" as const,
				toolCallId: "call-1",
				toolName,
				input: JSON.stringify(input),
			},
			{
				type: "finish" as const,
				finishReason: { unified: "tool-calls" as const, raw: "tc" },
				usage: USAGE,
			},
		];
		const textChunks = [
			{ type: "stream-start" as const, warnings: [] },
			{ type: "text-start" as const, id: "t" },
			{ type: "text-delta" as const, id: "t", delta: "done" },
			{ type: "text-end" as const, id: "t" },
			{
				type: "finish" as const,
				finishReason: { unified: "stop" as const, raw: "stop" },
				usage: USAGE,
			},
		];
		return new MockLanguageModelV3({
			doStream: (callOptions) => {
				step += 1;
				seen.push(callOptions.prompt);
				return Promise.resolve({
					stream:
						step === 1
							? simulateReadableStream({ chunks: toolChunks })
							: simulateReadableStream({ chunks: textChunks }),
				});
			},
		});
	}

	it.each(
		TOOLS
	)("hands the model a result, not an error, for $name", async (tool) => {
		const name = "toolName" in tool ? tool.toolName : tool.name;
		tool.breakWith(
			withStack(
				new DriverFailure(
					`SELECT 1 on ${HOST}:5432 refused at 10.0.3.7 with Pr0d-S3cret`
				)
			)
		);
		const seen: unknown[] = [];
		const result = streamText({
			model: modelCalling(name, tool.input, seen),
			prompt: "read it",
			tools: toolsFor(tool.claimHealth),
			stopWhen: stepCountIs(3),
			onError: () => undefined,
		});
		const parts: { type: string }[] = [];
		for await (const part of result.fullStream) {
			parts.push(part);
		}

		expect(parts.map((part) => part.type)).not.toContain("tool-error");
		expect(parts.map((part) => part.type)).toContain("tool-result");
		expect(seen).toHaveLength(2);
		const secondPrompt = JSON.stringify(seen[1]);
		expect(secondPrompt).not.toContain("error-text");
		expect(secondPrompt).not.toContain("error-json");
		expectNoneOf(secondPrompt);
		expectNoneOf(JSON.stringify(parts));
	});
});

describe("a read of the case that fails is not kept", () => {
	it("reads again for the next call in the same reply, and keeps the read that works", async () => {
		const tools = toolsFor(false);
		vi.mocked(exportCase).mockRejectedValueOnce(new Error(`down ${HOST}`));

		const first = await run(tools, "read_case", {});
		const second = await run(tools, "read_case", {});
		const third = await run(tools, "lint_case", {});

		expect(first).toMatchObject({ found: false });
		expect(second).toMatchObject({ found: true });
		expect(third).toMatchObject({ found: true });
		expect(exportCase).toHaveBeenCalledTimes(2);
	});

	it("reads again after a non-error was thrown", async () => {
		const tools = toolsFor(false);
		vi.mocked(exportCase).mockRejectedValueOnce(`down ${HOST}`);

		await run(tools, "lint_case", {});
		const second = await run(tools, "read_element", { elementId: "p1" });

		expect(second).toMatchObject({ found: true });
		expect(exportCase).toHaveBeenCalledTimes(2);
	});

	it("gives every call made at once the fixed answer from one failed read, and reads again afterwards", async () => {
		const tools = toolsFor(true);
		vi.mocked(exportCase).mockRejectedValueOnce(new Error(`down ${HOST}`));

		const together = await Promise.all([
			run(tools, "read_case", {}),
			run(tools, "read_element", { elementId: "p1" }),
			run(tools, "lint_case", {}),
			run(tools, "read_claim_health", {}),
		]);
		const later = await run(tools, "read_case", {});

		for (const answer of together) {
			expect(answer).toMatchObject({ found: false });
			expectNoneOf(JSON.stringify(answer));
		}
		expect(later).toMatchObject({ found: true });
		expect(exportCase).toHaveBeenCalledTimes(2);
	});

	it("fails once for each call that asks while the layer is down, and never answers from an old failure", async () => {
		const tools = toolsFor(false);
		vi.mocked(exportCase)
			.mockRejectedValueOnce(new Error(`down ${HOST}`))
			.mockRejectedValueOnce(new Error(`still down ${HOST}`));

		const first = await run(tools, "read_case", {});
		const second = await run(tools, "read_case", {});
		const third = await run(tools, "read_case", {});

		expect(first).toMatchObject({ found: false });
		expect(second).toMatchObject({ found: false });
		expect(third).toMatchObject({ found: true });
		expect(exportCase).toHaveBeenCalledTimes(3);
	});
});

describe("read_claim_health after a failed status read", () => {
	it("reads the statuses again on the next call", async () => {
		const tools = toolsFor(true);
		vi.mocked(readHealthStatusesForCase).mockRejectedValueOnce(
			new Error(`down ${HOST}`)
		);

		const first = await run(tools, "read_claim_health", {});
		const second = await run(tools, "read_claim_health", {});

		expect(first).toMatchObject({ found: false });
		expect(second).toMatchObject({ found: true });
		expect(readHealthStatusesForCase).toHaveBeenCalledTimes(2);
	});

	it("gives calls made at once the fixed answer, and does not keep the failure", async () => {
		const tools = toolsFor(true);
		vi.mocked(readHealthStatusesForCase).mockRejectedValueOnce(
			new Error(`down ${HOST}`)
		);

		const together = await Promise.all([
			run(tools, "read_claim_health", {}),
			run(tools, "read_claim_health", {}),
		]);
		const later = await run(tools, "read_claim_health", {});

		for (const answer of together) {
			expect(answer).toMatchObject({ found: false });
			expectNoneOf(JSON.stringify(answer));
		}
		expect(later).toMatchObject({ found: true });
	});
});
