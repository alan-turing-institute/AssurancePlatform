// biome-ignore-all lint/suspicious/noMisplacedAssertion: the shared helpers are called from within it() blocks
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import { captureLogs } from "../helpers/capture-logs";
import {
	claimIn,
	healthWorld,
	TOOL_OPTIONS,
} from "../utils/assistant-claim-health-kit";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	duringOutage,
	errorDuringOutage,
	type Outage,
	type OutageKind,
	startDatabaseOutage,
} from "../utils/database-outage-kit";
import { appendRecord } from "../utils/health-adversarial-kit";
import { giveChatJob } from "../utils/model-jobs";
import { createTestUser } from "../utils/prisma-factories";

/**
 * The assistant's case-reading tools while the database cannot be reached.
 * The failure is real: the app's own pool is pointed at a closed port, a
 * database that does not exist or a role the server does not know, and the
 * error that Prisma throws names the thing that was wrong. Nothing of that
 * error may reach the model, the user or a log; the tools give fixed results,
 * and the next call after the database is back reads the case again.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/models/adapters", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/models/adapters")>()),
	chatModelFor: vi.fn(),
}));

vi.mock("@/lib/services/case-export-service", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/services/case-export-service")>();
	return { ...actual, exportCase: vi.fn(actual.exportCase) };
});

const { exportCase } = await import("@/lib/services/case-export-service");

const OUTAGES: OutageKind[] = ["refused", "unknown-database", "unknown-role"];

/** A user with both plugins on, and a case with a goal and a claim that has a result. */
async function world() {
	const w = await healthWorld();
	const p1 = await claimIn(w, "P1");
	await appendRecord(w.owner.id, p1.id);
	return { ...w, p1 };
}

type World = Awaited<ReturnType<typeof world>>;

function tools(w: World) {
	return createCaseTools(w.owner.id, w.kase.id, { claimHealth: true });
}

function callAll(toolSet: ReturnType<typeof tools>) {
	return Promise.all([
		toolSet.read_case.execute?.({}, TOOL_OPTIONS),
		toolSet.read_element.execute?.({ elementId: "P1" }, TOOL_OPTIONS),
		toolSet.lint_case.execute?.({}, TOOL_OPTIONS),
		toolSet.read_claim_health?.execute?.({}, TOOL_OPTIONS),
	]);
}

/** Text from the failure that a caller could see: the error's message, its code frame lines, and the pieces of the connection. */
function revealingPieces(outage: Outage, reference: Error): string[] {
	const lines = reference.message
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length >= 12);
	return [
		reference.message,
		...lines,
		...outage.revealing,
		outage.password,
		"127.0.0.1",
		"Invalid `prisma",
		"invocation",
		".ts:",
	];
}

function expectNoneOf(shown: string, pieces: string[]) {
	for (const piece of pieces) {
		expect(shown, `must not hold "${piece}"`).not.toContain(piece);
	}
}

beforeEach(() => {
	vi.mocked(exportCase).mockClear();
});

describe("the tools while the database cannot be reached", () => {
	it.each(
		OUTAGES
	)("answer all four calls with a fixed result after a %s failure, and log only the error's class", async (kind) => {
		const w = await world();
		const toolSet = tools(w);
		const logs = captureLogs();
		try {
			await duringOutage(kind, async (outage) => {
				const reference = await errorDuringOutage();
				expect(reference.message).toContain(outage.revealing[0]);

				const answers = await callAll(toolSet);

				for (const answer of answers) {
					expect(answer).toMatchObject({ found: false });
					expect((answer as { message: unknown }).message).toEqual(
						expect.any(String)
					);
					expectNoneOf(
						JSON.stringify(answer),
						revealingPieces(outage, reference)
					);
				}
				expectNoneOf(
					JSON.stringify(logs.entries),
					revealingPieces(outage, reference)
				);
				expect(logs.entries.map((entry) => entry.errorName)).toContain(
					reference.name
				);
				for (const entry of logs.entries) {
					expect(entry).not.toHaveProperty("error");
					expect(entry).not.toHaveProperty("stack");
					expect(entry).not.toHaveProperty("message");
				}
			});
		} finally {
			logs.restore();
		}
	});

	it("reads the case again for the next call once the database is back, in the same reply", async () => {
		const w = await world();
		const toolSet = tools(w);

		const during = await duringOutage(
			"refused",
			async () => await toolSet.read_case.execute?.({}, TOOL_OPTIONS)
		);
		const after = await toolSet.read_case.execute?.({}, TOOL_OPTIONS);
		const lint = await toolSet.lint_case.execute?.({}, TOOL_OPTIONS);

		expect(during).toMatchObject({ found: false });
		expect(after).toMatchObject({
			found: true,
			case: { name: w.kase.name },
		});
		expect(lint).toMatchObject({ found: true });
		// One read that failed, one that worked; the lint used the second.
		expect(exportCase).toHaveBeenCalledTimes(2);
	});

	it("reads the case again for every call made while the outage lasts", async () => {
		const w = await world();
		const toolSet = tools(w);

		await duringOutage("refused", async () => {
			await toolSet.read_case.execute?.({}, TOOL_OPTIONS);
			await toolSet.read_case.execute?.({}, TOOL_OPTIONS);
		});

		expect(exportCase).toHaveBeenCalledTimes(2);
	});

	it("answers every tool called at the same moment from one failed read", async () => {
		const w = await world();
		const toolSet = tools(w);

		const answers = await duringOutage("refused", () => callAll(toolSet));

		for (const answer of answers) {
			expect(answer).toMatchObject({ found: false });
		}
		expect(exportCase).toHaveBeenCalledTimes(1);
	});

	it("answers read_claim_health with a fixed result when only the status read fails, and reads the statuses again afterwards", async () => {
		const w = await world();
		const toolSet = tools(w);
		// The shared export is read while the database works, so only the
		// health plugin's own read meets the outage.
		await toolSet.read_case.execute?.({}, TOOL_OPTIONS);

		const during = await duringOutage("refused", async (outage) => {
			const reference = await errorDuringOutage();
			const answer = await toolSet.read_claim_health?.execute?.(
				{},
				TOOL_OPTIONS
			);
			expectNoneOf(JSON.stringify(answer), revealingPieces(outage, reference));
			return answer;
		});
		const after = await toolSet.read_claim_health?.execute?.({}, TOOL_OPTIONS);

		expect(during).toMatchObject({ found: false });
		expect(after).toMatchObject({
			found: true,
			claims: [{ label: "P1", result: "pass" }],
		});
		expect(exportCase).toHaveBeenCalledTimes(1);
	});
});

describe("the tools while the database works", () => {
	it("still answer a user with no access as not found, which is not the unreadable answer", async () => {
		const w = await world();
		const stranger = await createTestUser();
		const toolSet = createCaseTools(stranger.id, w.kase.id);

		const answers = await Promise.all([
			toolSet.read_case.execute?.({}, TOOL_OPTIONS),
			toolSet.read_element.execute?.({ elementId: "P1" }, TOOL_OPTIONS),
			toolSet.lint_case.execute?.({}, TOOL_OPTIONS),
		]);

		for (const answer of answers) {
			expect(answer).toEqual({
				found: false,
				message: "Not found in this case.",
			});
		}
	});

	it("still give the owner the case", async () => {
		const w = await world();

		const [read, element, lint, health] = await callAll(tools(w));

		expect(read).toMatchObject({ found: true, case: { name: w.kase.name } });
		expect(element).toMatchObject({ found: true, element: { name: "P1" } });
		expect(lint).toMatchObject({ found: true });
		expect(health).toMatchObject({ found: true });
	});
});

describe("a reply while the database cannot be reached", () => {
	const USAGE = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	let outage: Outage | null = null;

	beforeEach(async () => {
		await mockNoAuth();
		const adapters = await import("@/lib/models/adapters");
		vi.mocked(adapters.chatModelFor).mockReset();
	});

	afterEach(() => {
		outage?.end();
		outage = null;
	});

	/**
	 * A model whose first step asks for every tool, with the database going
	 * away just before that step, and whose second step answers in words, with
	 * the database back. `seen` collects the prompt of each step.
	 */
	function modelDuringOutage(kind: OutageKind, seen: unknown[]) {
		let step = 0;
		return new MockLanguageModelV3({
			doStream: async (callOptions) => {
				step += 1;
				seen.push(callOptions.prompt);
				if (step === 1) {
					outage = await startDatabaseOutage(kind);
					const call = (id: string, toolName: string, input: object) => ({
						type: "tool-call" as const,
						toolCallId: id,
						toolName,
						input: JSON.stringify(input),
					});
					return {
						stream: simulateReadableStream({
							chunks: [
								{ type: "stream-start" as const, warnings: [] },
								call("c1", "read_case", {}),
								call("c2", "read_element", { elementId: "P1" }),
								call("c3", "lint_case", {}),
								call("c4", "read_claim_health", {}),
								{
									type: "finish" as const,
									finishReason: {
										unified: "tool-calls" as const,
										raw: "tc",
									},
									usage: USAGE,
								},
							],
						}),
					};
				}
				outage?.end();
				outage = null;
				return {
					stream: simulateReadableStream({
						chunks: [
							{ type: "stream-start" as const, warnings: [] },
							{ type: "text-start" as const, id: "t" },
							{ type: "text-delta" as const, id: "t", delta: "done" },
							{ type: "text-end" as const, id: "t" },
							{
								type: "finish" as const,
								finishReason: { unified: "stop" as const, raw: "stop" },
								usage: USAGE,
							},
						],
					}),
				};
			},
		});
	}

	it.each(
		OUTAGES
	)("tells the model and the user nothing of a %s failure", async (kind) => {
		const w = await world();
		await giveChatJob(w.owner.id, { model: "m" });
		await mockAuth(w.owner.id, w.owner.username, w.owner.email);
		const seen: unknown[] = [];
		const adapters = await import("@/lib/models/adapters");
		vi.mocked(adapters.chatModelFor).mockImplementation(() =>
			modelDuringOutage(kind, seen)
		);
		const logs = captureLogs();
		try {
			const { POST } = await import("@/app/api/cases/[id]/assistant/route");
			const response = await POST(
				new Request(`http://localhost:3000/api/cases/${w.kase.id}/assistant`, {
					method: "POST",
					body: JSON.stringify({
						messages: [
							{
								id: "m1",
								role: "user",
								parts: [{ type: "text", text: "read it" }],
							},
						],
					}),
				}),
				{ params: Promise.resolve({ id: w.kase.id }) }
			);
			const streamed = await response.text();

			expect(response.status).toBe(200);
			expect(seen).toHaveLength(2);
			const toModel = JSON.stringify(seen[1]);
			// Four calls were made, and each was answered with a result.
			expect(toModel.match(/"type":"tool-result"/g)).toHaveLength(4);
			expect(toModel).not.toContain("error-text");
			expect(toModel).not.toContain("error-json");
			expect(streamed).not.toContain("tool-output-error");
			expect(streamed).not.toContain("errorText");
			expect(streamed).toContain("done");

			// The pieces that would have been named: the connection's port,
			// database or role, and the words Prisma puts around them.
			const generic = [
				"127.0.0.1",
				"Invalid `prisma",
				"invocation",
				"leak_db_",
				"leak_role_",
				"Leak-Pw-",
				"Can't reach database server",
				"does not exist on the database server",
				"Authentication failed against the database server",
				".ts:",
			];
			for (const text of [toModel, streamed, JSON.stringify(logs.entries)]) {
				expectNoneOf(text, generic);
			}
		} finally {
			logs.restore();
		}
	});
});
