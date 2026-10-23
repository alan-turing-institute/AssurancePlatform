import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/cases/[id]/assistant/route";
import { canAccessCase } from "@/lib/permissions";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";

const requireAuth = vi.hoisted(() => vi.fn());
const streamText = vi.hoisted(() => vi.fn());

vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	streamText,
}));
vi.mock("@/lib/api-response", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/api-response")>()),
	requireAuth,
}));
vi.mock("@/lib/services/plugin-enablement-service", () => ({
	assertPluginEnabledForUser: vi.fn(),
}));
vi.mock("@/lib/services/health-status-service", () => ({
	caseHasHealthStatus: vi.fn().mockResolvedValue(false),
	readHealthStatusesForCase: vi.fn(),
}));
vi.mock("@/lib/services/health-claim-access", () => ({
	HEALTH_PLUGIN_ID: "tea.health",
}));
vi.mock("@/lib/services/case-export-service", () => ({
	exportCase: vi.fn(),
}));
vi.mock("@/lib/plugins/assistant/selected-element", () => ({
	resolveSelectedElement: vi.fn().mockResolvedValue(null),
	selectionPrompt: vi.fn(() => ""),
}));
vi.mock("@/lib/permissions", () => ({ canAccessCase: vi.fn() }));
vi.mock("@/lib/plugins/assistant/model-config", () => ({
	modelAccessFor: vi.fn(),
	resolveChatModel: vi.fn(() => Promise.resolve({ model: { id: "m" } })),
}));

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const SUGGESTION_TOOLS = ["suggest_edit", "suggest_new_element"];
const READ_TOOLS = ["lint_case", "read_case", "read_element"];
const LEVELS = ["VIEW", "COMMENT", "EDIT", "ADMIN"];

/** Gives the signed-in user one permission level, which also grants each level below it. */
function userCan(level: string) {
	const granted = LEVELS.slice(0, LEVELS.indexOf(level) + 1);
	vi.mocked(canAccessCase).mockImplementation((_who, required) =>
		Promise.resolve(granted.includes(required ?? "VIEW"))
	);
}

function getTools() {
	return GET(new Request(`http://localhost/api/cases/${CASE_ID}/assistant`), {
		params: Promise.resolve({ id: CASE_ID }),
	});
}

const assistantAsked = {
	id: "a1",
	role: "assistant",
	parts: [
		{ type: "step-start" },
		{
			type: "tool-suggest_edit",
			toolCallId: "call-1",
			state: "output-available",
			input: { elementId: "p1" },
			output: {
				suggested: true,
				kind: "edit",
				elementId: "p1",
				elementType: "property_claim",
				label: "P1",
				changes: { description: { before: "Old", after: "New" } },
			},
		},
	],
};

function post(extra: Record<string, unknown> = {}) {
	return POST(
		new Request(`http://localhost/api/cases/${CASE_ID}/assistant`, {
			method: "POST",
			body: JSON.stringify({
				messages: [
					{ id: "u1", role: "user", parts: [{ type: "text", text: "Reword" }] },
					assistantAsked,
					{ id: "u2", role: "user", parts: [{ type: "text", text: "Again" }] },
				],
				...extra,
			}),
		}),
		{ params: Promise.resolve({ id: CASE_ID }) }
	);
}

function toolsOfTheReply(): string[] {
	return Object.keys(streamText.mock.calls[0]?.[0].tools ?? {}).sort();
}

beforeEach(() => {
	vi.clearAllMocks();
	requireAuth.mockResolvedValue("user-1");
	vi.mocked(assertPluginEnabledForUser).mockResolvedValue({ data: true });
	streamText.mockReturnValue({
		toUIMessageStream: () =>
			new ReadableStream({
				start(controller) {
					controller.close();
				},
			}),
	});
	userCan("EDIT");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("the suggestion tools by permission level", () => {
	it.each([
		["VIEW", READ_TOOLS],
		["COMMENT", READ_TOOLS],
		["EDIT", [...READ_TOOLS, ...SUGGESTION_TOOLS].sort()],
		["ADMIN", [...READ_TOOLS, ...SUGGESTION_TOOLS].sort()],
	])("lists the tools a user with %s rights has", async (level, expected) => {
		userCan(level);

		const body = await (await getTools()).json();

		expect([...body.tools].sort()).toEqual(expected);
	});

	it.each([
		["VIEW", READ_TOOLS],
		["COMMENT", READ_TOOLS],
		["EDIT", [...READ_TOOLS, ...SUGGESTION_TOOLS].sort()],
	])("gives a reply the same tools as the list for %s rights", async (level, expected) => {
		userCan(level);

		const response = await post();

		expect(response.status).toBe(200);
		expect(toolsOfTheReply()).toEqual(expected);
	});

	it("tells the model it cannot change the case when the user has only comment rights", async () => {
		userCan("COMMENT");

		await post();

		expect(streamText.mock.calls[0]?.[0].system).toContain(
			"You cannot change the case."
		);
		expect(streamText.mock.calls[0]?.[0].system).not.toContain("suggest_edit");
	});

	it("asks for edit rights on the case in the URL", async () => {
		await getTools();

		expect(canAccessCase).toHaveBeenCalledWith(
			{ userId: "user-1", caseId: CASE_ID },
			"EDIT"
		);
	});
});

describe("the switch that turns the suggestion tools off", () => {
	it.each([
		["true", true],
		["TRUE", true],
		["1", true],
		["yes", true],
		["on", true],
		[" true ", true],
		["garbage", true],
		["2", true],
		["false", false],
		["FALSE", false],
		["0", false],
		["", false],
		["no", false],
		["off", false],
		[" off ", false],
		["OFF", false],
	])("with the setting %j the suggestion tools are %s off", async (value, switchedOff) => {
		vi.stubEnv("ASSISTANT_SUGGESTIONS_DISABLED", value);

		const body = await (await getTools()).json();
		await post();

		const expected = switchedOff
			? READ_TOOLS
			: [...READ_TOOLS, ...SUGGESTION_TOOLS].sort();
		expect([...body.tools].sort()).toEqual(expected);
		expect(toolsOfTheReply()).toEqual(expected);
	});

	it("leaves the suggestion tools on when the setting is not set", async () => {
		vi.stubEnv("ASSISTANT_SUGGESTIONS_DISABLED", undefined);

		const body = await (await getTools()).json();

		expect(body.tools).toEqual(expect.arrayContaining(SUGGESTION_TOOLS));
	});

	it("reads the setting on every request, not once at start", async () => {
		const before = await (await getTools()).json();
		vi.stubEnv("ASSISTANT_SUGGESTIONS_DISABLED", "true");
		const during = await (await getTools()).json();
		vi.stubEnv("ASSISTANT_SUGGESTIONS_DISABLED", "false");
		const after = await (await getTools()).json();

		expect(before.tools).toContain("suggest_edit");
		expect(during.tools).not.toContain("suggest_edit");
		expect(after.tools).toContain("suggest_edit");
	});

	it("keeps the read-only wording in the prompt when it is switched off", async () => {
		vi.stubEnv("ASSISTANT_SUGGESTIONS_DISABLED", "true");

		await post();

		const { system } = streamText.mock.calls[0]?.[0] ?? {};
		expect(system).toContain("You cannot change the case.");
		expect(system).not.toContain("suggest_edit");
	});
});

describe("the suggestion outcomes in the request body", () => {
	function sentToTheModel() {
		return JSON.stringify(streamText.mock.calls[0]?.[0].messages);
	}

	it("accepts each of the three outcomes and tells the model what the user did", async () => {
		const response = await post({
			suggestionOutcomes: { "call-1": "applied" },
		});

		expect(response.status).toBe(200);
		expect(sentToTheModel()).toContain("userDecision");
	});

	it.each([
		"applied",
		"dismissed",
		"changed",
	])("accepts the outcome %s", async (outcome) => {
		const response = await post({ suggestionOutcomes: { "call-1": outcome } });

		expect(response.status).toBe(200);
	});

	it("treats an empty set of outcomes as none, and marks each suggestion as not yet decided", async () => {
		await post();
		const without = sentToTheModel();
		streamText.mockClear();

		await post({ suggestionOutcomes: {} });

		expect(sentToTheModel()).toBe(without);
		expect(without).toContain("userDecision");
	});

	it.each([
		["an unknown status", { "call-1": "approved" }],
		["a status in capitals", { "call-1": "APPLIED" }],
		["a number", { "call-1": 1 }],
		["null", { "call-1": null }],
		["an object", { "call-1": { status: "applied" } }],
		["a list", ["applied"]],
		["a string", "applied"],
		["a key over 200 characters", { [`c${"x".repeat(200)}`]: "applied" }],
	])("refuses outcomes that are %s, before calling the model", async (_what, outcomes) => {
		const response = await post({ suggestionOutcomes: outcomes });

		expect(response.status).toBe(400);
		expect(streamText).not.toHaveBeenCalled();
	});

	it("refuses an outcome with an empty tool call id, before calling the model", async () => {
		const response = await post({ suggestionOutcomes: { "": "applied" } });

		expect(response.status).toBe(400);
		expect(streamText).not.toHaveBeenCalled();
	});

	it("refuses null for the whole field", async () => {
		const response = await post({ suggestionOutcomes: null });

		expect(response.status).toBe(400);
		expect(streamText).not.toHaveBeenCalled();
	});

	it("accepts 500 outcomes and refuses 501", async () => {
		const outcomes = (count: number) =>
			Object.fromEntries(
				Array.from({ length: count }, (_, n) => [`call-${n}`, "dismissed"])
			);

		const accepted = await post({ suggestionOutcomes: outcomes(500) });
		streamText.mockClear();
		const refused = await post({ suggestionOutcomes: outcomes(501) });

		expect(accepted.status).toBe(200);
		expect(refused.status).toBe(400);
		expect(streamText).not.toHaveBeenCalled();
	});

	it("ignores outcomes for ids that are not in the chat, and keys that look like object internals", async () => {
		const response = await post({
			suggestionOutcomes: { nope: "applied", constructor: "dismissed" },
		});

		expect(response.status).toBe(200);
		expect(sentToTheModel()).not.toContain("applied this");
	});

	it("does not crash on a prototype key in the outcomes", async () => {
		const response = await POST(
			new Request(`http://localhost/api/cases/${CASE_ID}/assistant`, {
				method: "POST",
				body: `{"messages":[{"id":"u","role":"user","parts":[]}],"suggestionOutcomes":{"__proto__":"applied","call-1":"dismissed"}}`,
			}),
			{ params: Promise.resolve({ id: CASE_ID }) }
		);

		expect(response.status).toBeLessThan(500);
	});

	it("checks the user's rights before it reads the outcomes", async () => {
		vi.mocked(canAccessCase).mockResolvedValue(false);

		const response = await post({ suggestionOutcomes: { "call-1": "bogus" } });

		expect(response.status).toBe(404);
	});
});
