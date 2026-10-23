import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import prisma from "@/lib/prisma";
import { changeBoundCheck } from "@/lib/services/health-evidence-service";
import {
	getConnectionForUse,
	getRoles,
} from "@/lib/services/model-connection-service";
import { setPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { appendRecord } from "../utils/health-adversarial-kit";
import {
	addTeamMember,
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestPluginState,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
	enableTestPlugin,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/model-connection-service", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/model-connection-service")
		>();
	return {
		...actual,
		getConnectionForUse: vi.fn(actual.getConnectionForUse),
		getRoles: vi.fn(actual.getRoles),
	};
});
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
	vi.mocked(getRoles).mockClear();
	vi.mocked(getConnectionForUse).mockClear();
	await mockNoAuth();
	vi.stubEnv("TECHNIQUES_MCP_URL", "");
	// The suggestion tools have their own describe at the end of this file;
	// elsewhere the lists are of the read tools alone.
	vi.stubEnv("ASSISTANT_SUGGESTIONS_DISABLED", "true");
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

async function setup() {
	const owner = await createTestUser();
	await enableTestPlugin(owner.id, "tea.health");
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

	it("does not read the user's model jobs or connections", async () => {
		const { owner, testCase } = await setup();
		vi.stubEnv("TECHNIQUES_MCP_URL", TECHNIQUES_URL);
		await as(owner);

		await get(testCase.id);

		expect(getRoles).not.toHaveBeenCalled();
		expect(getConnectionForUse).not.toHaveBeenCalled();
	});

	it.each([
		"VIEW",
		"COMMENT",
		"EDIT",
		"ADMIN",
	] as const)("answers a user with direct %s permission", async (level) => {
		const { owner, testCase } = await setup();
		const user = await createTestUser();
		await enableTestPlugin(user.id, "tea.health");
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
		await enableTestPlugin(member.id, "tea.health");
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
		await enableTestPlugin(outsider.id, "tea.health");
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
		await enableTestPlugin(newcomer.id, "tea.health");
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
		await enableTestPlugin(outsider.id, "tea.health");
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

describe("GET /api/cases/[id]/assistant — claim health", () => {
	const HEALTH_PLUGIN_ID = "tea.health";

	async function addClaim(
		owner: { id: string },
		testCase: { id: string },
		has: "a bound check" | "a record" | "neither"
	) {
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
		});
		if (has === "a bound check") {
			expectSuccess(
				await changeBoundCheck(owner.id, claim.id, {
					name: "Sensor Range Checker",
					reason: "Bind ahead of the first record",
				})
			);
		}
		if (has === "a record") {
			await appendRecord(owner.id, claim.id);
		}
		return claim;
	}

	async function tools(
		user: { id: string; username: string; email: string },
		caseId: string
	) {
		await as(user);
		return (await (await get(caseId)).json()).tools as string[];
	}

	it.each([
		"a bound check",
		"a record",
	] as const)("lists read_claim_health when a claim has %s", async (has) => {
		const { owner, testCase } = await setup();
		await addClaim(owner, testCase, has);

		expect(await tools(owner, testCase.id)).toEqual([
			"read_case",
			"read_element",
			"lint_case",
			"read_claim_health",
		]);
		expect(vi.mocked(createCaseTools).mock.calls[0]?.[2]?.claimHealth).toBe(
			true
		);
	});

	it("lists it for a user who can only view the case", async () => {
		const { owner, testCase } = await setup();
		await addClaim(owner, testCase, "a record");
		const viewer = await createTestUser();
		await enableTestPlugin(viewer.id, "tea.health");
		await createTestPluginState(viewer.id, { pluginId: PLUGIN_ID });
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		expect(await tools(viewer, testCase.id)).toContain("read_claim_health");
	});

	it("leaves it out when no claim has a bound check or a record", async () => {
		const { owner, testCase } = await setup();
		await addClaim(owner, testCase, "neither");

		expect(await tools(owner, testCase.id)).not.toContain("read_claim_health");
	});

	it("leaves it out when the only claim with a record has been deleted", async () => {
		const { owner, testCase } = await setup();
		const claim = await addClaim(owner, testCase, "a record");
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { deletedAt: new Date() },
		});

		expect(await tools(owner, testCase.id)).not.toContain("read_claim_health");
	});

	it("leaves it out for a user who switched the health plugin off, and for a deployment that withholds it", async () => {
		const { owner, testCase } = await setup();
		await addClaim(owner, testCase, "a record");
		await setPluginEnabledForUser(HEALTH_PLUGIN_ID, owner.id, {
			enabled: false,
		});
		const switchedOff = await tools(owner, testCase.id);
		await setPluginEnabledForUser(HEALTH_PLUGIN_ID, owner.id, {
			enabled: true,
		});
		vi.stubEnv("TEA_PLUGINS_DISABLED", HEALTH_PLUGIN_ID);
		const withheld = await tools(owner, testCase.id);

		expect(switchedOff).toEqual(["read_case", "read_element", "lint_case"]);
		expect(withheld).toEqual(["read_case", "read_element", "lint_case"]);
	});
});

describe("GET /api/cases/[id]/assistant — the suggestion tools", () => {
	const SUGGESTION_TOOLS = ["suggest_edit", "suggest_new_element"];

	async function toolsFor(level: "VIEW" | "COMMENT" | "EDIT" | "ADMIN") {
		const { owner, testCase } = await setup();
		const user = await createTestUser();
		await enableTestPlugin(user.id, "tea.health");
		await createTestPluginState(user.id, { pluginId: PLUGIN_ID });
		await createTestPermission(testCase.id, user.id, owner.id, level);
		await as(user);
		return (await (await get(testCase.id)).json()).tools as string[];
	}

	it.each([
		"EDIT",
		"ADMIN",
	] as const)("lists them for a user with direct %s permission", async (level) => {
		vi.stubEnv("ASSISTANT_SUGGESTIONS_DISABLED", "");

		expect(await toolsFor(level)).toEqual([
			"read_case",
			"read_element",
			"lint_case",
			...SUGGESTION_TOOLS,
		]);
	});

	it.each([
		"VIEW",
		"COMMENT",
	] as const)("leaves them out for a user with only %s permission", async (level) => {
		vi.stubEnv("ASSISTANT_SUGGESTIONS_DISABLED", "");

		expect(await toolsFor(level)).toEqual([
			"read_case",
			"read_element",
			"lint_case",
		]);
	});

	it("lists them for the owner, and leaves them out for everyone while the switch-off setting is on", async () => {
		const { owner, testCase } = await setup();
		await as(owner);
		vi.stubEnv("ASSISTANT_SUGGESTIONS_DISABLED", "");
		const on = (await (await get(testCase.id)).json()).tools;
		vi.stubEnv("ASSISTANT_SUGGESTIONS_DISABLED", "true");
		const off = (await (await get(testCase.id)).json()).tools;

		expect(on).toEqual(expect.arrayContaining(SUGGESTION_TOOLS));
		expect(off).toEqual(["read_case", "read_element", "lint_case"]);
	});
});
