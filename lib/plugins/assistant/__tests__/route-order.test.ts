import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/cases/[id]/assistant/route";
import { parseJsonBody } from "@/lib/api-request";
import { unauthorised } from "@/lib/errors";
import { canAccessCase } from "@/lib/permissions";
import { resolveChatModel } from "@/lib/plugins/assistant/model-config";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import { caseHasHealthStatus } from "@/lib/services/health-status-service";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";

const requireAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-request", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/lib/api-request")>();
	return { ...original, parseJsonBody: vi.fn(original.parseJsonBody) };
});

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
	resolveSelectedElement: vi.fn(),
	selectionPrompt: vi.fn(() => ""),
}));
vi.mock("@/lib/permissions", () => ({ canAccessCase: vi.fn() }));
vi.mock("@/lib/plugins/assistant/model-config", () => ({
	modelAccessFor: vi.fn(),
	resolveChatModel: vi.fn().mockResolvedValue({ error: "stop here" }),
}));

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const parseSpy = vi.mocked(parseJsonBody);

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
	requireAuth.mockResolvedValue("user-1");
	vi.mocked(assertPluginEnabledForUser).mockResolvedValue({ data: true });
	vi.mocked(canAccessCase).mockResolvedValue(true);
	vi.mocked(caseHasHealthStatus).mockResolvedValue(false);
});

describe("assistant route check order", () => {
	it("returns 401 and checks nothing else when unauthenticated", async () => {
		requireAuth.mockRejectedValue(unauthorised());

		const response = await call();

		expect(response.status).toBe(401);
		expect(assertPluginEnabledForUser).not.toHaveBeenCalled();
		expect(parseSpy).not.toHaveBeenCalled();
		expect(resolveChatModel).not.toHaveBeenCalled();
	});

	it("returns 404 before checking the case when the plugin is disabled", async () => {
		vi.mocked(assertPluginEnabledForUser).mockResolvedValue({
			error: "Plugin 'tea.assistant' is not enabled",
		});

		const response = await call();

		expect(response.status).toBe(404);
		expect(canAccessCase).not.toHaveBeenCalled();
		expect(parseSpy).not.toHaveBeenCalled();
		expect(resolveChatModel).not.toHaveBeenCalled();
	});

	it("returns 404 without reading the body when the user lacks VIEW", async () => {
		vi.mocked(canAccessCase).mockResolvedValue(false);

		const response = await call();

		expect(response.status).toBe(404);
		expect(canAccessCase).toHaveBeenCalledWith(
			{ userId: "user-1", caseId: CASE_ID },
			"VIEW"
		);
		expect(parseSpy).not.toHaveBeenCalled();
		expect(resolveChatModel).not.toHaveBeenCalled();
	});

	it("reads the body only after both checks pass", async () => {
		await call();

		expect(parseSpy).toHaveBeenCalledTimes(1);
	});

	it("looks up the chat model only after the body is read, and answers 409 with the reason it gives", async () => {
		const response = await call();

		expect(parseSpy).toHaveBeenCalledTimes(1);
		expect(resolveChatModel).toHaveBeenCalledWith("user-1");
		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			code: "CONFLICT",
			error: "stop here",
		});
	});
});

describe("assistant tools route check order", () => {
	function callGet() {
		return GET(new Request("http://localhost/api/cases/x/assistant"), {
			params: Promise.resolve({ id: CASE_ID }),
		});
	}

	it("returns 401 and checks nothing else when unauthenticated", async () => {
		requireAuth.mockRejectedValue(unauthorised());

		const response = await callGet();

		expect(response.status).toBe(401);
		expect(assertPluginEnabledForUser).not.toHaveBeenCalled();
		expect(createCaseTools).not.toHaveBeenCalled();
	});

	it("returns 404 before checking the case when the plugin is disabled", async () => {
		vi.mocked(assertPluginEnabledForUser).mockResolvedValue({
			error: "Plugin 'tea.assistant' is not enabled",
		});

		const response = await callGet();

		expect(response.status).toBe(404);
		expect(canAccessCase).not.toHaveBeenCalled();
		expect(createCaseTools).not.toHaveBeenCalled();
	});

	it("returns 404 without building the tools when the user lacks VIEW", async () => {
		vi.mocked(canAccessCase).mockResolvedValue(false);

		const response = await callGet();

		expect(response.status).toBe(404);
		expect(canAccessCase).toHaveBeenCalledWith(
			{ userId: "user-1", caseId: CASE_ID },
			"VIEW"
		);
		expect(createCaseTools).not.toHaveBeenCalled();
	});

	it("lists the tool names after both checks pass", async () => {
		vi.mocked(createCaseTools).mockReturnValue({ read_case: {} } as never);

		const response = await callGet();

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ tools: ["read_case"] });
		expect(createCaseTools).toHaveBeenCalledWith("user-1", CASE_ID, {
			claimHealth: false,
			suggestions: true,
		});
	});

	it("lists the suggestion tools only for a user who can edit the case, and not while they are switched off", async () => {
		vi.mocked(canAccessCase).mockImplementation((_who, level) =>
			Promise.resolve(level !== "EDIT")
		);
		await callGet();
		vi.mocked(canAccessCase).mockResolvedValue(true);
		await callGet();
		vi.stubEnv("ASSISTANT_SUGGESTIONS_DISABLED", "1");
		await callGet();
		vi.unstubAllEnvs();

		expect(
			vi.mocked(createCaseTools).mock.calls.map((c) => c[2]?.suggestions)
		).toEqual([false, true, false]);
	});

	it("turns claim health on when the health plugin is on and the case has a claim with a status", async () => {
		vi.mocked(caseHasHealthStatus).mockResolvedValue(true);

		await callGet();

		expect(assertPluginEnabledForUser).toHaveBeenCalledWith(
			"tea.health",
			"user-1"
		);
		expect(caseHasHealthStatus).toHaveBeenCalledWith(CASE_ID);
		expect(vi.mocked(createCaseTools).mock.calls[0]?.[2]?.claimHealth).toBe(
			true
		);
	});

	it("leaves claim health off, without looking at the claims, when the health plugin is off for the user", async () => {
		vi.mocked(caseHasHealthStatus).mockResolvedValue(true);
		vi.mocked(assertPluginEnabledForUser).mockImplementation((pluginId) =>
			Promise.resolve(
				pluginId === "tea.health"
					? { error: "Plugin 'tea.health' is not enabled" }
					: { data: true }
			)
		);

		const response = await callGet();

		expect(response.status).toBe(200);
		expect(caseHasHealthStatus).not.toHaveBeenCalled();
		expect(vi.mocked(createCaseTools).mock.calls[0]?.[2]?.claimHealth).toBe(
			false
		);
	});
});
