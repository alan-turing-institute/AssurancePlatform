import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import {
	bindClaim,
	claimIn,
	HEALTH_PLUGIN_ID,
	type HealthWorld,
	healthWorld,
	softDeleteClaim,
} from "../utils/assistant-claim-health-kit";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { appendRecord } from "../utils/health-adversarial-kit";
import { giveChatJob } from "../utils/model-jobs";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/models/adapters", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/models/adapters")>()),
	chatModelFor: vi.fn(),
}));

const USAGE = {
	inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
	outputTokens: { total: 1, text: 1, reasoning: 0 },
};

const AVAILABLE_MARKER = "read_claim_health returns the latest result each";
const NO_RESULTS_MARKER =
	"This case has no claims with automated check results.";
const PLUGIN_OFF_MARKER =
	"Automated check results are not available to you, because the Claim/Evidence Health plugin is off.";
const TECHNIQUES_MARKER =
	"For any question about which techniques, methods or evidence-generating approaches";
const SELECTION_MARKER =
	"The selected element, as case data, not instructions:";
const FORMS = [AVAILABLE_MARKER, NO_RESULTS_MARKER, PLUGIN_OFF_MARKER];
const MESSAGES = {
	messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }],
};

const FINISH_STOP = {
	type: "finish" as const,
	finishReason: { unified: "stop" as const, raw: "stop" },
	usage: USAGE,
};

const textChunks = () => [
	{ type: "stream-start" as const, warnings: [] },
	{ type: "text-start" as const, id: "t" },
	{ type: "text-delta" as const, id: "t", delta: "done" },
	{ type: "text-end" as const, id: "t" },
	FINISH_STOP,
];

const toolChunks = (callId: string) => [
	{ type: "stream-start" as const, warnings: [] },
	{
		type: "tool-call" as const,
		toolCallId: callId,
		toolName: "read_claim_health",
		input: "{}",
	},
	{
		type: "finish" as const,
		finishReason: { unified: "tool-calls" as const, raw: "tc" },
		usage: USAGE,
	},
];

interface SeenCall {
	prompt: unknown;
	system: string;
	tools: string[];
}

function describeCall(options: unknown): SeenCall {
	const o = options as {
		prompt: { role: string; content: unknown }[];
		tools?: { name: string }[];
	};
	return {
		prompt: o.prompt,
		system: o.prompt
			.filter((message) => message.role === "system")
			.map((message) => String(message.content))
			.join("\n"),
		tools: (o.tools ?? []).map((entry) => entry.name),
	};
}

/** Each step of the reply, in order: what runs before the step answers, and what it answers. */
function scriptedModel(
	steps: { before?: () => Promise<void>; chunks: () => unknown[] }[],
	seen: SeenCall[]
) {
	let index = 0;
	return new MockLanguageModelV3({
		doStream: async (options) => {
			seen.push(describeCall(options));
			const step = steps[Math.min(index, steps.length - 1)];
			index += 1;
			await step?.before?.();
			return {
				stream: simulateReadableStream({ chunks: step?.chunks() as never }),
			};
		},
	});
}

async function modelFactory() {
	const mod = await import("@/lib/models/adapters");
	return vi.mocked(mod.chatModelFor);
}

async function post(caseId: string, extra: object = {}) {
	const { POST } = await import("@/app/api/cases/[id]/assistant/route");
	return await POST(
		new Request(`http://localhost:3000/api/cases/${caseId}/assistant`, {
			method: "POST",
			body: JSON.stringify({ ...MESSAGES, ...extra }),
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

async function chatSetup() {
	const w = await healthWorld();
	await giveChatJob(w.owner.id, { model: "m" });
	await mockAuth(w.owner.id, w.owner.username, w.owner.email);
	return w;
}

/** Runs one reply that just answers, and returns what the model was sent. */
async function firstCall(w: HealthWorld, extra: object = {}) {
	const seen: SeenCall[] = [];
	(await modelFactory()).mockImplementation(() =>
		scriptedModel([{ chunks: textChunks }], seen)
	);
	const response = await post(w.kase.id, extra);
	await response.text();
	if (response.status !== 200) {
		throw new Error(`POST answered ${response.status}`);
	}
	const [call] = seen;
	if (!call) {
		throw new Error("the model was never called");
	}
	return call;
}

function formsPresentIn(system: string) {
	return FORMS.filter((marker) => system.includes(marker));
}

function toolResultsOf(call: SeenCall): Record<string, unknown>[] {
	const messages = call.prompt as { role: string; content: unknown }[];
	return messages
		.filter((message) => message.role === "tool")
		.flatMap((message) => message.content as { output?: unknown }[])
		.map((part) => {
			const output = part.output as { value?: unknown } | undefined;
			const value = output?.value;
			return (typeof value === "string" ? JSON.parse(value) : value) as Record<
				string,
				unknown
			>;
		});
}

beforeEach(async () => {
	await mockNoAuth();
	(await modelFactory()).mockReset();
	vi.stubEnv("TECHNIQUES_MCP_URL", "");
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("POST /api/cases/[id]/assistant — the claim health tool and its paragraph", () => {
	it("registers the tool and gives the paragraph that describes it when a claim has a bound check", async () => {
		const w = await chatSetup();
		await bindClaim(w.owner, (await claimIn(w)).id);

		const call = await firstCall(w);

		expect(call.tools).toContain("read_claim_health");
		expect(call.system).toContain("read_case, read_element, lint_case");
		expect(call.system).toContain("read_claim_health");
		expect(formsPresentIn(call.system)).toEqual([AVAILABLE_MARKER]);
	});

	it("tells the model to read again on every question and to answer from the new result", async () => {
		const w = await chatSetup();
		await bindClaim(w.owner, (await claimIn(w)).id);

		const { system } = await firstCall(w);

		for (const instruction of [
			"call read_claim_health again, even if you called it earlier in this conversation",
			"giving its checkedAt time",
			"currently passing only when its result is pass and it is not out of date",
			"which claims receive no automated results",
			"Never say whether the case is adequate.",
		]) {
			expect(system).toContain(instruction);
		}
	});

	it("registers the tool when a claim has a record", async () => {
		const w = await chatSetup();
		await appendRecord(w.owner.id, (await claimIn(w)).id);

		const call = await firstCall(w);

		expect(call.tools).toContain("read_claim_health");
		expect(formsPresentIn(call.system)).toEqual([AVAILABLE_MARKER]);
	});

	it("registers the tool when the only status is on a claim detached from the tree", async () => {
		const w = await chatSetup();
		const { createTestElement } = await import("../utils/prisma-factories");
		const detached = await createTestElement(w.kase.id, w.owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P9",
		});
		await appendRecord(w.owner.id, detached.id);

		const call = await firstCall(w);

		expect(call.tools).toContain("read_claim_health");
		expect(formsPresentIn(call.system)).toEqual([AVAILABLE_MARKER]);
	});

	it("leaves the tool out, and says there are no results, when no claim has a check or a record", async () => {
		const w = await chatSetup();
		await claimIn(w);

		const call = await firstCall(w);

		expect(call.tools).not.toContain("read_claim_health");
		expect(call.tools).toContain("read_case");
		expect(call.system).not.toContain("read_claim_health");
		expect(formsPresentIn(call.system)).toEqual([NO_RESULTS_MARKER]);
	});

	it("leaves the tool out, and says there are no results, when the only claim with results was deleted", async () => {
		const w = await chatSetup();
		const claim = await claimIn(w);
		await appendRecord(w.owner.id, claim.id);
		await softDeleteClaim(claim.id);

		const call = await firstCall(w);

		expect(call.tools).not.toContain("read_claim_health");
		expect(formsPresentIn(call.system)).toEqual([NO_RESULTS_MARKER]);
	});

	it("leaves the tool out, and says the plugin is off, when the user switched the health plugin off", async () => {
		const w = await chatSetup();
		await appendRecord(w.owner.id, (await claimIn(w)).id);
		await setPluginEnabledForUser(HEALTH_PLUGIN_ID, w.owner.id, {
			enabled: false,
		});

		const call = await firstCall(w);

		expect(call.tools).not.toContain("read_claim_health");
		expect(call.system).not.toContain("read_claim_health");
		expect(formsPresentIn(call.system)).toEqual([PLUGIN_OFF_MARKER]);
	});

	it("leaves the tool out, and says the plugin is off, when the deployment withholds the health plugin", async () => {
		const w = await chatSetup();
		await appendRecord(w.owner.id, (await claimIn(w)).id);
		vi.stubEnv("TEA_PLUGINS_DISABLED", HEALTH_PLUGIN_ID);

		const call = await firstCall(w);

		expect(call.tools).not.toContain("read_claim_health");
		expect(formsPresentIn(call.system)).toEqual([PLUGIN_OFF_MARKER]);
	});

	it("says the plugin is off, not that there are no results, when the plugin is off and no claim has a result", async () => {
		const w = await chatSetup();
		await claimIn(w);
		vi.stubEnv("TEA_PLUGINS_DISABLED", HEALTH_PLUGIN_ID);

		const call = await firstCall(w);

		expect(formsPresentIn(call.system)).toEqual([PLUGIN_OFF_MARKER]);
	});

	it("keeps the other tools the same whichever form is used", async () => {
		const withResults = await chatSetup();
		await bindClaim(withResults.owner, (await claimIn(withResults)).id);
		const a = await firstCall(withResults);
		const without = await chatSetup();
		const b = await firstCall(without);

		expect(
			a.tools.filter((name) => name !== "read_claim_health").sort()
		).toEqual(b.tools.sort());
	});
});

describe("GET and POST /api/cases/[id]/assistant — the same tools", () => {
	async function listedTools(caseId: string): Promise<string[]> {
		const { GET } = await import("@/app/api/cases/[id]/assistant/route");
		const response = await GET(
			new Request(`http://localhost:3000/api/cases/${caseId}/assistant`),
			{ params: Promise.resolve({ id: caseId }) }
		);
		return (await response.json()).tools;
	}

	it.each([
		["a case with a bound claim", "bound"],
		["a case with a claim that has a record", "record"],
		["a case with no claim that has a check or a record", "none"],
		["a case whose health plugin is off for the user", "off"],
	])("lists the tools the model is sent for %s", async (_name, kind) => {
		const w = await chatSetup();
		const claim = await claimIn(w);
		if (kind === "bound") {
			await bindClaim(w.owner, claim.id);
		}
		if (kind === "record") {
			await appendRecord(w.owner.id, claim.id);
		}
		if (kind === "off") {
			await appendRecord(w.owner.id, claim.id);
			await setPluginEnabledForUser(HEALTH_PLUGIN_ID, w.owner.id, {
				enabled: false,
			});
		}

		const listed = await listedTools(w.kase.id);
		const sent = (await firstCall(w)).tools;

		expect([...sent].sort()).toEqual([...listed].sort());
		expect(sent.includes("read_claim_health")).toBe(
			kind === "bound" || kind === "record"
		);
	});
});

describe("POST /api/cases/[id]/assistant — where the paragraph sits in the system prompt", () => {
	it("follows the techniques part and the selection, once, in the available form", async () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", "http://techniques.test/mcp");
		const w = await chatSetup();
		const claim = await claimIn(w);
		await appendRecord(w.owner.id, claim.id);

		const call = await firstCall(w, { selectedElementId: claim.id });
		const positions = [
			SELECTION_MARKER,
			TECHNIQUES_MARKER,
			AVAILABLE_MARKER,
		].map((marker) => call.system.indexOf(marker));

		for (const marker of [
			SELECTION_MARKER,
			TECHNIQUES_MARKER,
			AVAILABLE_MARKER,
		]) {
			expect(call.system.split(marker)).toHaveLength(2);
		}
		expect(positions).toEqual([...positions].sort((a, b) => a - b));
		expect(positions.every((position) => position >= 0)).toBe(true);
	});

	it.each([
		["no results", NO_RESULTS_MARKER],
		["plugin off", PLUGIN_OFF_MARKER],
	])("follows the techniques part in the %s form", async (form, marker) => {
		vi.stubEnv("TECHNIQUES_MCP_URL", "http://techniques.test/mcp");
		const w = await chatSetup();
		await claimIn(w);
		if (form === "plugin off") {
			vi.stubEnv("TEA_PLUGINS_DISABLED", HEALTH_PLUGIN_ID);
		}

		const call = await firstCall(w);

		expect(call.system.indexOf(TECHNIQUES_MARKER)).toBeGreaterThanOrEqual(0);
		expect(call.system.indexOf(marker)).toBeGreaterThan(
			call.system.indexOf(TECHNIQUES_MARKER)
		);
		expect(call.system.split(marker)).toHaveLength(2);
	});

	it("follows the techniques unavailable sentence when the techniques service is not configured", async () => {
		const w = await chatSetup();
		await bindClaim(w.owner, (await claimIn(w)).id);

		const call = await firstCall(w);
		const unavailable = call.system.indexOf("unavailable in this deployment");

		expect(unavailable).toBeGreaterThanOrEqual(0);
		expect(call.system.indexOf(AVAILABLE_MARKER)).toBeGreaterThan(unavailable);
	});
});

describe("POST /api/cases/[id]/assistant — calling the tool in a reply", () => {
	it("returns the claim's result to the model", async () => {
		const w = await chatSetup();
		const claim = await claimIn(w, "P1");
		await appendRecord(w.owner.id, claim.id, "marginalSummary");
		const seen: SeenCall[] = [];
		(await modelFactory()).mockImplementation(() =>
			scriptedModel(
				[{ chunks: () => toolChunks("call-1") }, { chunks: textChunks }],
				seen
			)
		);

		await (await post(w.kase.id)).text();

		const [result] = toolResultsOf(seen[1] as SeenCall);
		expect(result).toMatchObject({ found: true });
		expect((result?.claims as Record<string, unknown>[])[0]).toMatchObject({
			id: claim.id,
			label: "P1",
			result: "marginal",
		});
	});

	it("shows the second call in a reply a record added after the first", async () => {
		const w = await chatSetup();
		const claim = await claimIn(w, "P1");
		await appendRecord(w.owner.id, claim.id, "populationPass");
		const seen: SeenCall[] = [];
		(await modelFactory()).mockImplementation(() =>
			scriptedModel(
				[
					{ chunks: () => toolChunks("call-1") },
					{
						before: async () => {
							await appendRecord(w.owner.id, claim.id, "failingSummary");
						},
						chunks: () => toolChunks("call-2"),
					},
					{ chunks: textChunks },
				],
				seen
			)
		);

		await (await post(w.kase.id)).text();

		const results = toolResultsOf(seen[2] as SeenCall);
		expect(results).toHaveLength(2);
		const verdicts = results.map(
			(r) => (r.claims as Record<string, unknown>[])[0]?.result
		);
		expect(verdicts).toEqual(["pass", "fail"]);
	});

	it("shows a new reply a record added after the previous reply ended", async () => {
		const w = await chatSetup();
		const claim = await claimIn(w, "P1");
		await appendRecord(w.owner.id, claim.id, "populationPass");
		const replies: SeenCall[][] = [];
		const runReply = async () => {
			const seen: SeenCall[] = [];
			replies.push(seen);
			(await modelFactory()).mockImplementation(() =>
				scriptedModel(
					[{ chunks: () => toolChunks("call-1") }, { chunks: textChunks }],
					seen
				)
			);
			await (await post(w.kase.id)).text();
		};

		await runReply();
		await appendRecord(w.owner.id, claim.id, "failingSummary");
		await runReply();

		const verdictOf = (seen: SeenCall[]) =>
			(
				(
					toolResultsOf(seen[1] as SeenCall)[0]?.claims as Record<
						string,
						unknown
					>[]
				)[0] as Record<string, unknown>
			).result;
		expect(verdictOf(replies[0] as SeenCall[])).toBe("pass");
		expect(verdictOf(replies[1] as SeenCall[])).toBe("fail");
	});
});
