import { describe, expect, it, vi } from "vitest";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import {
	changeBoundCheck,
	revokeHealthEvidence,
} from "@/lib/services/health-evidence-service";
import { setPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { appendRecord, isoAgo, MINUTE } from "../utils/health-adversarial-kit";
import {
	addTeamMember,
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return { ...actual, emitSSEEvent: vi.fn() };
});

const options = { toolCallId: "t", messages: [] };
const UNAVAILABLE = {
	found: false,
	message: "Claim health is not available for this case.",
};

interface ClaimHealthResult {
	checkedAt: string;
	claims: {
		check: string | null;
		id: string;
		label: string | null;
		outOfDate: boolean;
		outOfDateReason: string | null;
		result: string | null;
		resultAt: string | null;
		settings: string | null;
		validUntil: string | null;
	}[];
	claimsNotInTree?: number;
	claimsTruncated: number;
	claimsWithoutResults: string[];
	claimsWithoutResultsTruncated: number;
	found: true;
}

/** An owner, a case with a top goal, and two property claims under it, P1 and P2. */
async function setup() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const root = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
	const claim = (name: string) =>
		createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name,
			parentId: root.id,
			description: `The ${name} property holds`,
		});
	const p1 = await claim("P1");
	const p2 = await claim("P2");
	return { owner, testCase, root, p1, p2 };
}

function tools(userId: string, caseId: string) {
	return createCaseTools(userId, caseId, null, undefined, undefined, true);
}

async function readAs(userId: string, caseId: string) {
	return await tools(userId, caseId).read_claim_health?.execute?.({}, options);
}

describe("read_claim_health: who can read a case's claim health", () => {
	it("answers the owner with the claim's current result", async () => {
		const { owner, testCase, p1 } = await setup();
		await appendRecord(owner.id, p1.id);

		const result = (await readAs(owner.id, testCase.id)) as ClaimHealthResult;

		expect(result.found).toBe(true);
		expect(result.claims).toMatchObject([
			{ id: p1.id, label: "P1", result: "pass", outOfDate: false },
		]);
	});

	it.each([
		"VIEW",
		"COMMENT",
		"EDIT",
		"ADMIN",
	] as const)("answers a user with direct %s permission", async (level) => {
		const { owner, testCase, p1 } = await setup();
		await appendRecord(owner.id, p1.id);
		const user = await createTestUser();
		await createTestPermission(testCase.id, user.id, owner.id, level);

		const result = (await readAs(user.id, testCase.id)) as ClaimHealthResult;

		expect(result.found).toBe(true);
		expect(result.claims).toMatchObject([{ id: p1.id, result: "pass" }]);
	});

	it("answers a member of a team that can view the case", async () => {
		const { owner, testCase, p1 } = await setup();
		await appendRecord(owner.id, p1.id);
		const member = await createTestUser();
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, member.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");

		const result = (await readAs(member.id, testCase.id)) as ClaimHealthResult;

		expect(result.found).toBe(true);
		expect(result.claims).toMatchObject([{ id: p1.id, result: "pass" }]);
	});

	it("answers a user who lost access between the route check and the tool call with nothing from the case", async () => {
		const { owner, testCase, p1 } = await setup();
		await appendRecord(owner.id, p1.id);
		const stranger = await createTestUser();

		const result = await readAs(stranger.id, testCase.id);

		expect(result).toEqual(UNAVAILABLE);
		expect(JSON.stringify(result)).not.toContain("P1");
	});

	it("answers found false when the user switches the health plugin off after the tools were made", async () => {
		const { owner, testCase, p1 } = await setup();
		await appendRecord(owner.id, p1.id);
		const made = tools(owner.id, testCase.id);
		expectSuccess(
			await setPluginEnabledForUser("tea.health", owner.id, { enabled: false })
		);

		const result = await made.read_claim_health?.execute?.({}, options);

		expect(result).toEqual(UNAVAILABLE);
	});
});

describe("read_claim_health: reads the current state", () => {
	it("reads the database on every call, so a record posted between two calls shows in the second", async () => {
		const { owner, testCase, p1 } = await setup();
		await appendRecord(owner.id, p1.id, "populationPass", {
			timestamp: isoAgo(5 * MINUTE),
		});
		const made = tools(owner.id, testCase.id);

		const first = (await made.read_claim_health?.execute?.(
			{},
			options
		)) as ClaimHealthResult;
		const failing = await appendRecord(owner.id, p1.id, "failingSummary", {
			timestamp: isoAgo(1 * MINUTE),
		});
		const second = (await made.read_claim_health?.execute?.(
			{},
			options
		)) as ClaimHealthResult;

		expect(first.claims[0]?.result).toBe("pass");
		expect(second.claims[0]?.result).toBe("fail");
		expect(second.claims[0]?.resultAt).toBe(failing.timestamp);
		expect(second.checkedAt >= first.checkedAt).toBe(true);
	});

	it("says every result was withdrawn when the only record is revoked", async () => {
		const { owner, testCase, p1 } = await setup();
		const record = await appendRecord(owner.id, p1.id);
		expectSuccess(
			await revokeHealthEvidence(owner.id, p1.id, record.record_id, {
				cause: "other",
				reason: "test",
			})
		);

		const result = (await readAs(owner.id, testCase.id)) as ClaimHealthResult;

		expect(result.claims[0]).toMatchObject({
			result: null,
			resultAt: null,
			outOfDate: true,
			outOfDateReason: "all-revoked",
			settings: null,
		});
	});

	it("says a result is out of date once it has expired, and when it stopped being valid", async () => {
		const { owner, testCase, p1 } = await setup();
		const record = await appendRecord(owner.id, p1.id, "populationPass", {
			timestamp: isoAgo(10 * MINUTE),
			valid_for: "PT1M",
		});

		const result = (await readAs(owner.id, testCase.id)) as ClaimHealthResult;

		expect(result.claims[0]).toMatchObject({
			result: "pass",
			resultAt: record.timestamp,
			outOfDate: true,
			outOfDateReason: "expired",
			validUntil: new Date(
				new Date(record.timestamp).getTime() + MINUTE
			).toISOString(),
		});
	});

	it("gives a claim that is bound to a check but has no result a null result that is not out of date", async () => {
		const { owner, testCase, p1 } = await setup();
		expectSuccess(
			await changeBoundCheck(owner.id, p1.id, {
				name: "Sensor Range Checker",
				reason: "Bind ahead of the first record",
			})
		);

		const result = (await readAs(owner.id, testCase.id)) as ClaimHealthResult;

		expect(result.claims[0]).toMatchObject({
			check: "Sensor Range Checker",
			result: null,
			outOfDate: false,
			settings: null,
		});
	});

	it("says none accepted for a result recorded while the claim has no accepted settings", async () => {
		const { owner, testCase, p1 } = await setup();
		await appendRecord(owner.id, p1.id);

		const result = (await readAs(owner.id, testCase.id)) as ClaimHealthResult;

		expect(result.claims[0]?.settings).toBe("none accepted");
	});
});

describe("read_claim_health: which claims it reports", () => {
	it("lists claims with a status in the order the case shows them, and names the others", async () => {
		const { owner, testCase, p1, p2 } = await setup();
		const p3 = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P3",
			parentId: p2.id,
		});
		await appendRecord(owner.id, p3.id);
		await appendRecord(owner.id, p1.id);

		const result = (await readAs(owner.id, testCase.id)) as ClaimHealthResult;

		expect(result.claims.map((claim) => claim.label)).toEqual(["P1", "P3"]);
		expect(result.claimsWithoutResults).toEqual(["P2"]);
		expect(result).not.toHaveProperty("claimsNotInTree");
	});

	it("counts a claim with a result that hangs from no goal, and does not list it", async () => {
		const { owner, testCase, p1 } = await setup();
		const loose = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "LOOSE",
		});
		await appendRecord(owner.id, p1.id);
		await appendRecord(owner.id, loose.id);

		const result = (await readAs(owner.id, testCase.id)) as ClaimHealthResult;

		expect(result.claims.map((claim) => claim.label)).toEqual(["P1"]);
		expect(result.claimsNotInTree).toBe(1);
		expect(JSON.stringify(result)).not.toContain("LOOSE");
	});
});

describe("read_claim_health: what it sends to the model", () => {
	it("carries no record payload, provenance, comment or person's name", async () => {
		const { owner, testCase, p1 } = await setup();
		await appendRecord(owner.id, p1.id, "populationPass", {
			comment: "LEAK-COMMENT",
			payload: { note: "LEAK-PAYLOAD" },
			provenance: {
				session: "LEAK-SESSION",
				pipeline_version: "LEAK-PIPELINE",
				run: "LEAK-RUN",
				members: [crypto.randomUUID()],
			},
		});

		const result = await readAs(owner.id, testCase.id);
		const text = JSON.stringify(result);

		expect(text).not.toContain("LEAK-");
		expect(text).not.toContain(owner.username);
		expect(text).not.toContain(owner.email);
		expect(Object.keys((result as ClaimHealthResult).claims[0] ?? {})).toEqual([
			"id",
			"label",
			"text",
			"check",
			"result",
			"resultAt",
			"validUntil",
			"outOfDate",
			"outOfDateReason",
			"outOfDateSince",
			"settings",
		]);
	});
});
