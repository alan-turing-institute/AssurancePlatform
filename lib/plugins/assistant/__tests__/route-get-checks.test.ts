import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cases/[id]/assistant/route";
import { unauthorised } from "@/lib/errors";
import { canAccessCase } from "@/lib/permissions";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";

const requireAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-response", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/api-response")>()),
	requireAuth,
}));
vi.mock("@/lib/services/plugin-enablement-service", () => ({
	assertPluginEnabledForUser: vi.fn(),
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
vi.mock("@/lib/plugins/assistant/provider-config", () => ({
	ASSISTANT_PLUGIN_ID: "tea.assistant",
	resolveProviderConfig: vi.fn(),
}));

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const REASON_WORDS = /plugin|enabled|permission/i;

function call(id = CASE_ID) {
	return GET(new Request(`http://localhost/api/cases/${id}/assistant`), {
		params: Promise.resolve({ id }),
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	requireAuth.mockResolvedValue("user-1");
	vi.mocked(assertPluginEnabledForUser).mockResolvedValue({ data: true });
	vi.mocked(canAccessCase).mockResolvedValue(true);
	vi.mocked(createCaseTools).mockReturnValue({
		read_case: { description: "Reads the whole case", inputSchema: {} },
		lint_case: { description: "Checks the case", inputSchema: {} },
	} as never);
});

describe("GET /api/cases/[id]/assistant", () => {
	it("returns 401 and checks nothing else when unauthenticated", async () => {
		requireAuth.mockRejectedValue(unauthorised());

		const response = await call();

		expect(response.status).toBe(401);
		expect(assertPluginEnabledForUser).not.toHaveBeenCalled();
		expect(canAccessCase).not.toHaveBeenCalled();
		expect(createCaseTools).not.toHaveBeenCalled();
	});

	it("returns 404 without looking at the case when the plugin is off", async () => {
		vi.mocked(assertPluginEnabledForUser).mockResolvedValue({
			error: "Plugin 'tea.assistant' is not enabled",
		});

		const response = await call();

		expect(response.status).toBe(404);
		expect(canAccessCase).not.toHaveBeenCalled();
		expect(createCaseTools).not.toHaveBeenCalled();
	});

	it("returns 404 without looking up access when the id is not a UUID", async () => {
		const response = await call("not-a-uuid");

		expect(response.status).toBe(404);
		expect(canAccessCase).not.toHaveBeenCalled();
		expect(createCaseTools).not.toHaveBeenCalled();
	});

	it("returns 404 when the user cannot view the case", async () => {
		vi.mocked(canAccessCase).mockResolvedValue(false);

		const response = await call();

		expect(response.status).toBe(404);
		expect(canAccessCase).toHaveBeenCalledWith(
			{ userId: "user-1", caseId: CASE_ID },
			"VIEW"
		);
		expect(createCaseTools).not.toHaveBeenCalled();
	});

	it("gives the same body for every 404, so none says why", async () => {
		vi.mocked(assertPluginEnabledForUser).mockResolvedValueOnce({
			error: "Plugin 'tea.assistant' is not enabled",
		});
		const pluginOff = await (await call()).json();
		const notUuid = await (await call("not-a-uuid")).json();
		vi.mocked(canAccessCase).mockResolvedValue(false);
		const noAccess = await (await call()).json();

		expect(notUuid).toEqual(pluginOff);
		expect(noAccess).toEqual(pluginOff);
		expect(JSON.stringify(pluginOff)).not.toMatch(REASON_WORDS);
	});

	it("returns the tool names and nothing else about the tools", async () => {
		const response = await call();

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			tools: ["read_case", "lint_case"],
		});
	});

	it("builds the tools for the signed-in user and the case in the URL", async () => {
		await call();

		expect(createCaseTools).toHaveBeenCalledTimes(1);
		expect(vi.mocked(createCaseTools).mock.calls[0]?.slice(0, 2)).toEqual([
			"user-1",
			CASE_ID,
		]);
	});
});
