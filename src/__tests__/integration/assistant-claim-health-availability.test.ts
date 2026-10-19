import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	caseHasHealthStatus,
	readHealthStatusesForCase,
} from "@/lib/services/health-status-service";
import { setPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	ASSISTANT_PLUGIN_ID,
	bindClaim,
	claimHealthCaller,
	claimIn,
	HEALTH_PLUGIN_ID,
	type HealthWorld,
	healthWorld,
	softDeleteClaim,
	type User,
} from "../utils/assistant-claim-health-kit";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { appendRecord } from "../utils/health-adversarial-kit";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestPluginState,
	createTestUser,
	enableTestPlugin,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/health-status-service", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/health-status-service")
		>();
	return {
		...actual,
		caseHasHealthStatus: vi.fn(actual.caseHasHealthStatus),
	};
});

beforeEach(async () => {
	vi.mocked(caseHasHealthStatus).mockClear();
	await mockNoAuth();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

const world = healthWorld;
type World = HealthWorld;
const ASSISTANT = ASSISTANT_PLUGIN_ID;
const HEALTH = HEALTH_PLUGIN_ID;
const bind = bindClaim;
const softDelete = softDeleteClaim;

async function signedInAs(user: User) {
	await mockAuth(user.id, user.username, user.email);
}

async function listedTools(caseId: string): Promise<string[]> {
	const { GET } = await import("@/app/api/cases/[id]/assistant/route");
	const response = await GET(
		new Request(`http://localhost:3000/api/cases/${caseId}/assistant`),
		{ params: Promise.resolve({ id: caseId }) }
	);
	if (response.status !== 200) {
		throw new Error(`GET answered ${response.status}`);
	}
	return (await response.json()).tools;
}

const healthTool = claimHealthCaller;

const SCENARIOS: {
	build: (w: World) => Promise<void>;
	hasStatus: boolean;
	name: string;
}[] = [
	{
		name: "a case with no property claims",
		hasStatus: false,
		build: async () => undefined,
	},
	{
		name: "a claim with no bound check and no record",
		hasStatus: false,
		build: async (w) => {
			await claimIn(w);
		},
	},
	{
		name: "a claim that is only bound to a check",
		hasStatus: true,
		build: async (w) => {
			await bind(w.owner, (await claimIn(w)).id);
		},
	},
	{
		name: "a claim with a record",
		hasStatus: true,
		build: async (w) => {
			await appendRecord(w.owner.id, (await claimIn(w)).id);
		},
	},
	{
		name: "a claim whose every record was revoked",
		hasStatus: true,
		build: async (w) => {
			const claim = await claimIn(w);
			const record = await appendRecord(w.owner.id, claim.id);
			const { revokeHealthEvidence } = await import(
				"@/lib/services/health-evidence-service"
			);
			expectSuccess(
				await revokeHealthEvidence(w.owner.id, claim.id, record.record_id, {
					cause: "evidence-defect",
					reason: "Bad run",
				})
			);
		},
	},
	{
		name: "a claim deleted after its records arrived, the only claim",
		hasStatus: false,
		build: async (w) => {
			const claim = await claimIn(w);
			await appendRecord(w.owner.id, claim.id);
			await softDelete(claim.id);
		},
	},
	{
		name: "a claim deleted after it was bound, the only claim",
		hasStatus: false,
		build: async (w) => {
			const claim = await claimIn(w);
			await bind(w.owner, claim.id);
			await softDelete(claim.id);
		},
	},
	{
		name: "a deleted claim with records beside a live claim with nothing",
		hasStatus: false,
		build: async (w) => {
			const gone = await claimIn(w, "P1");
			await appendRecord(w.owner.id, gone.id);
			await softDelete(gone.id);
			await claimIn(w, "P2");
		},
	},
	{
		name: "a deleted claim with records beside a live bound claim",
		hasStatus: true,
		build: async (w) => {
			const gone = await claimIn(w, "P1");
			await appendRecord(w.owner.id, gone.id);
			await softDelete(gone.id);
			await bind(w.owner, (await claimIn(w, "P2")).id);
		},
	},
	{
		name: "a bound-check row on an element that is not a property claim",
		hasStatus: false,
		build: async (w) => {
			await prisma.pluginHealthClaimState.create({
				data: { claimId: w.root.id, boundCheckName: "Sensor Range Checker" },
			});
		},
	},
	{
		name: "a status only on a claim in another case",
		hasStatus: false,
		build: async (w) => {
			const other = await createTestCase(w.owner.id);
			const elsewhere = await createTestElement(other.id, w.owner.id, {
				elementType: "PROPERTY_CLAIM",
				name: "P9",
			});
			await appendRecord(w.owner.id, elsewhere.id);
			await claimIn(w);
		},
	},
	{
		name: "a status only on a claim detached from the case tree",
		hasStatus: true,
		build: async (w) => {
			const detached = await createTestElement(w.kase.id, w.owner.id, {
				elementType: "PROPERTY_CLAIM",
				name: "P7",
			});
			await appendRecord(w.owner.id, detached.id);
			await claimIn(w);
		},
	},
];

describe("read_claim_health — the offer agrees with what the tool can read", () => {
	it.each(SCENARIOS)("$name", async (scenario) => {
		const w = await world();
		await scenario.build(w);
		await signedInAs(w.owner);

		const gate = await caseHasHealthStatus(w.kase.id);
		const statuses = expectSuccess(
			await readHealthStatusesForCase(w.owner.id, w.kase.id)
		);
		const listed = await listedTools(w.kase.id);

		expect(gate).toBe(scenario.hasStatus);
		expect(statuses.length > 0).toBe(scenario.hasStatus);
		expect(listed.includes("read_claim_health")).toBe(scenario.hasStatus);
		if (scenario.hasStatus) {
			const result = await healthTool(w.owner.id, w.kase.id)();
			expect(result.found).toBe(true);
			expect(
				result.claims.length +
					((result.claimsNotInTree as number | undefined) ?? 0)
			).toBe(statuses.length);
		}
	});
});

describe("read_claim_health — who is offered it", () => {
	async function caseWithRecord() {
		const w = await world();
		await appendRecord(w.owner.id, (await claimIn(w)).id);
		return w;
	}

	it("is listed for the owner and for every other level of access that can open the assistant", async () => {
		const w = await caseWithRecord();
		for (const level of ["VIEW", "COMMENT", "EDIT", "ADMIN"] as const) {
			const user = await createTestUser();
			await enableTestPlugin(user.id, "tea.health");
			await createTestPluginState(user.id, { pluginId: ASSISTANT });
			await createTestPermission(w.kase.id, user.id, w.owner.id, level);
			await signedInAs(user);

			expect(await listedTools(w.kase.id)).toContain("read_claim_health");
		}
		await signedInAs(w.owner);
		expect(await listedTools(w.kase.id)).toContain("read_claim_health");
	});

	it("is not listed to a user who switched the health plugin off, while others still get it", async () => {
		const w = await caseWithRecord();
		const viewer = await createTestUser();
		await enableTestPlugin(viewer.id, "tea.health");
		await createTestPluginState(viewer.id, { pluginId: ASSISTANT });
		await createTestPermission(w.kase.id, viewer.id, w.owner.id, "VIEW");
		expectSuccess(
			await setPluginEnabledForUser(HEALTH, w.owner.id, { enabled: false })
		);

		await signedInAs(w.owner);
		const ownerTools = await listedTools(w.kase.id);
		await signedInAs(viewer);
		const viewerTools = await listedTools(w.kase.id);

		expect(ownerTools).not.toContain("read_claim_health");
		expect(ownerTools).toContain("read_case");
		expect(viewerTools).toContain("read_claim_health");
	});

	it("is not listed to a user with the assistant on who has no health row at all", async () => {
		const w = await caseWithRecord();
		const viewer = await createTestUser();
		await createTestPluginState(viewer.id, { pluginId: ASSISTANT });
		await createTestPermission(w.kase.id, viewer.id, w.owner.id, "VIEW");
		await signedInAs(viewer);

		const tools = await listedTools(w.kase.id);

		expect(tools).toContain("read_case");
		expect(tools).not.toContain("read_claim_health");
		expect(caseHasHealthStatus).not.toHaveBeenCalled();
	});

	it("asks about the case's claims once per request when the plugin is on", async () => {
		const w = await caseWithRecord();
		await signedInAs(w.owner);

		await listedTools(w.kase.id);

		expect(caseHasHealthStatus).toHaveBeenCalledTimes(1);
		expect(caseHasHealthStatus).toHaveBeenCalledWith(w.kase.id);
	});

	it("does not query the case's claims for a user who has the plugin off", async () => {
		const w = await caseWithRecord();
		await signedInAs(w.owner);
		await setPluginEnabledForUser(HEALTH, w.owner.id, { enabled: false });

		await listedTools(w.kase.id);

		expect(caseHasHealthStatus).not.toHaveBeenCalled();
	});

	it("does not query the case's claims when the deployment withholds the plugin", async () => {
		const w = await caseWithRecord();
		await signedInAs(w.owner);
		vi.stubEnv("TEA_PLUGINS_DISABLED", HEALTH);

		await listedTools(w.kase.id);

		expect(caseHasHealthStatus).not.toHaveBeenCalled();
	});

	it("is listed again when the user switches the health plugin back on", async () => {
		const w = await caseWithRecord();
		await signedInAs(w.owner);
		await setPluginEnabledForUser(HEALTH, w.owner.id, { enabled: false });
		expect(await listedTools(w.kase.id)).not.toContain("read_claim_health");

		await setPluginEnabledForUser(HEALTH, w.owner.id, { enabled: true });

		expect(await listedTools(w.kase.id)).toContain("read_claim_health");
	});

	it("is not listed when the deployment withholds the health plugin", async () => {
		const w = await caseWithRecord();
		await signedInAs(w.owner);
		vi.stubEnv("TEA_PLUGINS_DISABLED", HEALTH);

		const tools = await listedTools(w.kase.id);

		expect(tools).not.toContain("read_claim_health");
		expect(tools).toContain("read_case");
	});

	it("is not listed when the deployment withholds only some other plugin", async () => {
		const w = await caseWithRecord();
		await signedInAs(w.owner);
		vi.stubEnv("TEA_PLUGINS_DISABLED", "some.other-plugin");

		expect(await listedTools(w.kase.id)).toContain("read_claim_health");
	});

	it("lists only tool names, never claim content or results", async () => {
		const w = await caseWithRecord();
		await signedInAs(w.owner);
		const { GET } = await import("@/app/api/cases/[id]/assistant/route");

		const body = await (
			await GET(
				new Request(`http://localhost:3000/api/cases/${w.kase.id}/assistant`),
				{ params: Promise.resolve({ id: w.kase.id }) }
			)
		).json();

		expect(Object.keys(body)).toEqual(["tools"]);
		expect(JSON.stringify(body)).not.toContain("Text of P1");
		expect(JSON.stringify(body)).not.toContain("Sensor Range Checker");
	});

	it("follows the case as its claims gain and lose results", async () => {
		const w = await world();
		const claim = await claimIn(w);
		await signedInAs(w.owner);
		expect(await listedTools(w.kase.id)).not.toContain("read_claim_health");

		await bind(w.owner, claim.id);
		expect(await listedTools(w.kase.id)).toContain("read_claim_health");

		await softDelete(claim.id);
		expect(await listedTools(w.kase.id)).not.toContain("read_claim_health");
	});
});

describe("caseHasHealthStatus and readHealthStatusesForCase — one filter", () => {
	it("agree for a case built from every kind of claim at once", async () => {
		const w = await world();
		const bound = await claimIn(w, "P1");
		await bind(w.owner, bound.id);
		const withRecord = await claimIn(w, "P2");
		await appendRecord(w.owner.id, withRecord.id);
		const deleted = await claimIn(w, "P3");
		await appendRecord(w.owner.id, deleted.id);
		await softDelete(deleted.id);
		await claimIn(w, "P4");

		const statuses = expectSuccess(
			await readHealthStatusesForCase(w.owner.id, w.kase.id)
		);

		expect(await caseHasHealthStatus(w.kase.id)).toBe(true);
		expect(statuses.map((entry) => entry.claim_ref).sort()).toEqual(
			[bound.id, withRecord.id].sort()
		);
	});

	it("both stop reporting a case once its only claim with a status is deleted", async () => {
		const w = await world();
		const claim = await claimIn(w);
		await appendRecord(w.owner.id, claim.id);
		await softDelete(claim.id);

		expect(await caseHasHealthStatus(w.kase.id)).toBe(false);
		expect(
			expectSuccess(await readHealthStatusesForCase(w.owner.id, w.kase.id))
		).toEqual([]);
	});

	it("does not report a case that does not exist", async () => {
		expect(
			await caseHasHealthStatus("00000000-0000-4000-8000-000000000999")
		).toBe(false);
	});
});
