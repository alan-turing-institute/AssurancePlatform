import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readUserApiKey } from "@/lib/plugins/assistant/key-store";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import { setPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addTeamMember,
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestPluginState,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/plugins/assistant/key-store", () => ({
	readUserApiKey: vi.fn().mockResolvedValue("ollama"),
}));
vi.mock("@/lib/plugins/assistant/tools", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/plugins/assistant/tools")>();
	return { ...actual, createCaseTools: vi.fn(actual.createCaseTools) };
});

const PLUGIN_ID = "tea.assistant";
const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";
const TECHNIQUES_URL = "http://techniques.invalid:3190/mcp";
const CASE_TEXT = "The system is acceptably safe";

beforeEach(async () => {
	vi.mocked(createCaseTools).mockClear();
	vi.mocked(readUserApiKey).mockClear();
	await mockNoAuth();
	vi.stubEnv("TECHNIQUES_MCP_URL", "");
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

async function setup() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		description: CASE_TEXT,
		role: "TOP_LEVEL",
	});
	await createTestPluginState(owner.id, { pluginId: PLUGIN_ID });
	return { owner, testCase };
}

async function as(user: { id: string; username: string; email: string }) {
	await mockAuth(user.id, user.username, user.email);
}

async function get(caseId: string) {
	const { GET } = await import("@/app/api/cases/[id]/assistant/route");
	return GET(
		new Request(`http://localhost:3000/api/cases/${caseId}/assistant`),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

describe("GET /api/cases/[id]/assistant — the tool list", () => {
	it("lists the three case tools for the owner, by name only", async () => {
		const { owner, testCase } = await setup();
		await as(owner);

		const response = await get(testCase.id);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(Object.keys(body)).toEqual(["tools"]);
		expect([...body.tools].sort()).toEqual([
			"lint_case",
			"read_case",
			"read_element",
		]);
		expect(JSON.stringify(body)).not.toContain(CASE_TEXT);
	});

	it("adds suggest_techniques when the techniques service is configured, without calling it", async () => {
		const { owner, testCase } = await setup();
		vi.stubEnv("TECHNIQUES_MCP_URL", TECHNIQUES_URL);
		const network = vi.spyOn(globalThis, "fetch");
		await as(owner);

		const body = await (await get(testCase.id)).json();

		expect([...body.tools].sort()).toEqual([
			"lint_case",
			"read_case",
			"read_element",
			"suggest_techniques",
		]);
		expect(network).not.toHaveBeenCalled();
	});

	it("does not read the user's API key", async () => {
		const { owner, testCase } = await setup();
		await as(owner);

		await get(testCase.id);

		expect(readUserApiKey).not.toHaveBeenCalled();
	});

	it.each([
		"VIEW",
		"COMMENT",
		"EDIT",
		"ADMIN",
	] as const)("answers a user with direct %s permission", async (level) => {
		const { owner, testCase } = await setup();
		const user = await createTestUser();
		await createTestPluginState(user.id, { pluginId: PLUGIN_ID });
		await createTestPermission(testCase.id, user.id, owner.id, level);
		await as(user);

		const response = await get(testCase.id);

		expect(response.status).toBe(200);
		expect((await response.json()).tools).toContain("read_case");
	});

	it("answers a member of a team that can view the case", async () => {
		const { owner, testCase } = await setup();
		const member = await createTestUser();
		await createTestPluginState(member.id, { pluginId: PLUGIN_ID });
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, member.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");
		await as(member);

		expect((await get(testCase.id)).status).toBe(200);
	});

	it("answers 401 with no session, whether or not the case exists", async () => {
		const { testCase } = await setup();

		expect((await get(testCase.id)).status).toBe(401);
		expect((await get(NONEXISTENT_ID)).status).toBe(401);
		expect(createCaseTools).not.toHaveBeenCalled();
	});

	it("answers one and the same 404 for no permission, a missing case, a malformed id and the plugin being off", async () => {
		const { owner, testCase } = await setup();
		const outsider = await createTestUser();
		await createTestPluginState(outsider.id, { pluginId: PLUGIN_ID });
		await as(outsider);
		const noAccess = await get(testCase.id);
		const missing = await get(NONEXISTENT_ID);
		const malformed = await get("not-a-uuid");
		await setPluginEnabledForUser(PLUGIN_ID, owner.id, { enabled: false });
		await as(owner);
		const pluginOff = await get(testCase.id);

		expect(noAccess.status).toBe(404);
		const expected = await noAccess.json();
		for (const response of [missing, malformed, pluginOff]) {
			expect(response.status).toBe(404);
			expect(await response.json()).toEqual(expected);
		}
	});

	it("answers 404 when the deployment withholds the plugin, and when the user never turned it on", async () => {
		const { owner, testCase } = await setup();
		const newcomer = await createTestUser();
		await as(newcomer);
		const neverOn = await get(testCase.id);
		await as(owner);
		vi.stubEnv("TEA_PLUGINS_DISABLED", PLUGIN_ID);
		const withheld = await get(testCase.id);

		expect(neverOn.status).toBe(404);
		expect(withheld.status).toBe(404);
	});

	it("builds no tools for any request that fails", async () => {
		const { owner, testCase } = await setup();
		const outsider = await createTestUser();
		await createTestPluginState(outsider.id, { pluginId: PLUGIN_ID });
		await as(outsider);
		await get(testCase.id);
		await get(NONEXISTENT_ID);
		await get("not-a-uuid");
		await setPluginEnabledForUser(PLUGIN_ID, owner.id, { enabled: false });
		await as(owner);
		await get(testCase.id);

		expect(createCaseTools).not.toHaveBeenCalled();
	});
});
