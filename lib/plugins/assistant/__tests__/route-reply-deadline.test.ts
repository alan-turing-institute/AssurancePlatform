import { convertToModelMessages } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cases/[id]/assistant/route";
import { canAccessCase } from "@/lib/permissions";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import { caseHasHealthStatus } from "@/lib/services/health-status-service";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";

const requireAuth = vi.hoisted(() => vi.fn());
const streamText = vi.hoisted(() => vi.fn());
const CHAT_MODEL = vi.hoisted(() => ({ id: "the-chat-model" }));
const MODEL_ACCESS = vi.hoisted(() => ({ id: "the-user's-models" }));

vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	convertToModelMessages: vi.fn().mockResolvedValue([]),
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
	caseHasHealthStatus: vi.fn(),
}));
vi.mock("@/lib/services/health-claim-access", () => ({
	HEALTH_PLUGIN_ID: "tea.health",
}));
vi.mock("@/lib/plugins/assistant/tools", () => ({
	buildSystemPrompt: vi.fn(() => ""),
	createCaseTools: vi.fn(() => ({})),
}));
vi.mock("@/lib/plugins/assistant/selected-element", () => ({
	resolveSelectedElement: vi.fn().mockResolvedValue(null),
	selectionPrompt: vi.fn(() => ""),
}));
vi.mock("@/lib/permissions", () => ({ canAccessCase: vi.fn() }));
vi.mock("@/lib/plugins/assistant/model-config", () => ({
	modelAccessFor: vi.fn(() => MODEL_ACCESS),
	resolveChatModel: vi.fn(() => Promise.resolve({ model: CHAT_MODEL })),
}));

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const START = new Date("2030-01-01T00:00:00Z");

function call() {
	return POST(
		new Request("http://localhost/api/cases/x/assistant", {
			method: "POST",
			body: JSON.stringify({
				messages: [{ id: "m", role: "user", parts: [] }],
			}),
		}),
		{ params: Promise.resolve({ id: CASE_ID }) }
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(START);
	requireAuth.mockResolvedValue("user-1");
	vi.mocked(assertPluginEnabledForUser).mockResolvedValue({ data: true });
	vi.mocked(canAccessCase).mockResolvedValue(true);
	vi.mocked(caseHasHealthStatus).mockResolvedValue(false);
	streamText.mockReturnValue({
		toUIMessageStreamResponse: () => new Response("ok"),
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

describe("assistant route reply deadline", () => {
	it("gives the tools a deadline of its start time plus the timeout it gives streamText", async () => {
		await call();

		const { timeout } = streamText.mock.calls[0]?.[0] ?? {};
		expect(timeout).toBe(60_000);
		expect(vi.mocked(createCaseTools).mock.calls[0]?.[2]?.replyDeadline).toBe(
			START.getTime() + timeout
		);
	});

	it("uses the configured timeout for both", async () => {
		vi.stubEnv("ASSISTANT_MODEL_TIMEOUT_MS", "90000");

		await call();

		expect(streamText.mock.calls[0]?.[0].timeout).toBe(90_000);
		expect(vi.mocked(createCaseTools).mock.calls[0]?.[2]?.replyDeadline).toBe(
			START.getTime() + 90_000
		);
	});

	it("streams from the user's chat model and gives the tools the user's models", async () => {
		await call();

		expect(streamText.mock.calls[0]?.[0].model).toBe(CHAT_MODEL);
		expect(vi.mocked(createCaseTools).mock.calls[0]?.[2]?.models).toBe(
			MODEL_ACCESS
		);
	});
});

describe("assistant route claim health", () => {
	const TECHNIQUES_URL = "https://techniques.example/mcp";

	function systemPrompt() {
		return streamText.mock.calls[0]?.[0].system as string;
	}

	it("gives the tools the claim-health flag and appends its paragraph after the techniques paragraph", async () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", TECHNIQUES_URL);
		vi.mocked(caseHasHealthStatus).mockResolvedValue(true);

		await call();

		expect(vi.mocked(createCaseTools).mock.calls[0]?.[2]?.claimHealth).toBe(
			true
		);
		const techniques = systemPrompt().indexOf("call `suggest_techniques`");
		const claimHealth = systemPrompt().indexOf("read_claim_health returns");
		expect(techniques).toBeGreaterThanOrEqual(0);
		expect(claimHealth).toBeGreaterThan(techniques);
	});

	it("says the case has no results when the plugin is on and no claim has a status", async () => {
		await call();

		expect(vi.mocked(createCaseTools).mock.calls[0]?.[2]?.claimHealth).toBe(
			false
		);
		expect(systemPrompt()).toContain(
			"This case has no claims with automated check results."
		);
		expect(systemPrompt()).not.toContain("read_claim_health returns");
	});

	it("says the plugin is off, and looks at no claims, when the user has switched it off", async () => {
		vi.mocked(caseHasHealthStatus).mockResolvedValue(true);
		vi.mocked(assertPluginEnabledForUser).mockImplementation((pluginId) =>
			Promise.resolve(
				pluginId === "tea.health"
					? { error: "Plugin 'tea.health' is not enabled" }
					: { data: true }
			)
		);

		await call();

		expect(vi.mocked(createCaseTools).mock.calls[0]?.[2]?.claimHealth).toBe(
			false
		);
		expect(systemPrompt()).toContain(
			"because the Claim/Evidence Health plugin is off."
		);
		expect(caseHasHealthStatus).not.toHaveBeenCalled();
	});
});

describe("assistant route suggestion tools", () => {
	const suggestions = () =>
		vi.mocked(createCaseTools).mock.calls[0]?.[2]?.suggestions;

	it("offers them to a user who can edit the case", async () => {
		await call();

		expect(canAccessCase).toHaveBeenCalledWith(
			{ userId: "user-1", caseId: CASE_ID },
			"EDIT"
		);
		expect(suggestions()).toBe(true);
	});

	it("withholds them from a user who can view or comment but not edit", async () => {
		vi.mocked(canAccessCase).mockImplementation((_who, level) =>
			Promise.resolve(level !== "EDIT")
		);

		await call();

		expect(suggestions()).toBe(false);
	});

	it("withholds them from everyone while the switch-off setting is on, without asking about edit rights", async () => {
		vi.stubEnv("ASSISTANT_SUGGESTIONS_DISABLED", "true");

		await call();

		expect(suggestions()).toBe(false);
		expect(canAccessCase).not.toHaveBeenCalledWith(expect.anything(), "EDIT");
	});

	it("tells the model what the user did with each earlier suggestion", async () => {
		await POST(
			new Request("http://localhost/api/cases/x/assistant", {
				method: "POST",
				body: JSON.stringify({
					messages: [
						{
							id: "m",
							role: "assistant",
							parts: [
								{
									type: "tool-suggest_edit",
									toolCallId: "call-1",
									state: "output-available",
									input: {},
									output: { suggested: true },
								},
							],
						},
					],
					suggestionOutcomes: { "call-1": "dismissed" },
				}),
			}),
			{ params: Promise.resolve({ id: CASE_ID }) }
		);

		const [sent] = vi.mocked(convertToModelMessages).mock.calls[0] ?? [];
		expect(JSON.stringify(sent)).toContain("dismissed this suggestion");
	});

	it("refuses an outcome that is not one the panel records", async () => {
		const response = await POST(
			new Request("http://localhost/api/cases/x/assistant", {
				method: "POST",
				body: JSON.stringify({
					messages: [{ id: "m", role: "user", parts: [] }],
					suggestionOutcomes: { "call-1": "approved" },
				}),
			}),
			{ params: Promise.resolve({ id: CASE_ID }) }
		);

		expect(response.status).toBe(400);
		expect(streamText).not.toHaveBeenCalled();
	});
});
