import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { publishAssuranceCase } from "@/lib/services/publish-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	appendRecord,
	callBoundCheck,
	callReinstate,
	callRevoke,
	importMachineRoute,
	machinePost,
	setupClaim,
	setupMachineWriter,
	wireRecord,
} from "../utils/health-adversarial-kit";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return { ...actual, emitSSEEvent: vi.fn() };
});

beforeEach(async () => {
	await mockNoAuth();
});

async function revokedSetup() {
	const ctx = await setupClaim();
	const record = await appendRecord(ctx.owner.id, ctx.claim.id);
	await mockAuth(ctx.owner.id);
	return { ...ctx, record };
}

const openRows = (recordId: string) =>
	prisma.pluginHealthRevocation.count({
		where: { evidence: { recordId }, reinstatedAt: null },
	});

describe("revocation and reinstatement requests", () => {
	it.each([
		["a missing reason", { cause: "other" }],
		["a blank reason", { cause: "other", reason: "   " }],
		["a missing cause", { reason: "x" }],
		[
			"a cause in the wrong spelling",
			{ cause: "EVIDENCE_DEFECT", reason: "x" },
		],
		["an unknown cause", { cause: "whim", reason: "x" }],
		["an extra field", { cause: "other", reason: "x", revoked_by_id: "me" }],
		[
			"a reason of 2,001 characters",
			{ cause: "other", reason: "x".repeat(2001) },
		],
	])("revocation with %s is refused with 400 and stores nothing", async (_n, body) => {
		const { claim, record } = await revokedSetup();

		const response = await callRevoke(claim.id, record.record_id, body);

		expect(response.status).toBe(400);
		expect(await openRows(record.record_id)).toBe(0);
	});

	it("refuses a record id that is not a UUID with 400", async () => {
		const { claim } = await revokedSetup();

		expect((await callRevoke(claim.id, "not-a-uuid")).status).toBe(400);
	});

	it("revoking an already revoked record gives 409 and keeps exactly one open revocation", async () => {
		const { claim, record } = await revokedSetup();
		expect((await callRevoke(claim.id, record.record_id)).status).toBe(201);

		const again = await callRevoke(claim.id, record.record_id);

		expect(again.status).toBe(409);
		expect(await openRows(record.record_id)).toBe(1);
	});

	it("two simultaneous revocations of one record give one success and one 409", async () => {
		const { claim, record } = await revokedSetup();

		const [a, b] = await Promise.all([
			callRevoke(claim.id, record.record_id),
			callRevoke(claim.id, record.record_id),
		]);

		expect([a.status, b.status].sort()).toEqual([201, 409]);
		expect(await openRows(record.record_id)).toBe(1);
	});

	it("finds a record and a claim addressed in capitals", async () => {
		const { claim, record } = await revokedSetup();

		const revoked = await callRevoke(
			claim.id.toUpperCase(),
			record.record_id.toUpperCase()
		);

		expect(revoked.status).toBe(201);
		expect(await openRows(record.record_id)).toBe(1);
	});

	it("reinstating a record that is not revoked is refused and writes nothing", async () => {
		const { claim, record } = await revokedSetup();

		const response = await callReinstate(claim.id, record.record_id);

		expect(response.status).toBe(409);
		expect(await prisma.pluginHealthRevocation.count()).toBe(0);
	});

	it("keeps the revocation row after reinstatement and adds a new row on a second revocation", async () => {
		const { claim, record } = await revokedSetup();
		await callRevoke(claim.id, record.record_id);
		expect(
			[200, 201].includes(
				(await callReinstate(claim.id, record.record_id)).status
			)
		).toBe(true);
		expect((await callRevoke(claim.id, record.record_id)).status).toBe(201);

		const rows = await prisma.pluginHealthRevocation.findMany({
			where: { evidence: { recordId: record.record_id } },
			orderBy: { revokedAt: "asc" },
		});

		expect(rows).toHaveLength(2);
		expect(rows[0]?.reinstatedAt).not.toBeNull();
		expect(rows[0]?.reinstatementReason).toBe("Run was fine");
		expect(rows[1]?.reinstatedAt).toBeNull();
	});

	it("writes no tea.health plugin data after an append, a revocation or a bound-check change", async () => {
		const { owner, claim, testCase } = await setupClaim();
		const { secret } = await setupMachineWriter(owner.id, testCase.id);
		const { POST } = await importMachineRoute();
		const pluginRows = () =>
			prisma.pluginData.count({ where: { pluginId: "tea.health" } });
		const record = wireRecord(claim.id);
		const appended = await POST(machinePost(claim.id, record, secret), {
			params: Promise.resolve({ id: claim.id }),
		});
		expect(appended.status).toBe(201);
		expect(await pluginRows()).toBe(0);

		await mockAuth(owner.id);
		expect((await callRevoke(claim.id, String(record.record_id))).status).toBe(
			201
		);
		expect(await pluginRows()).toBe(0);

		const changed = await callBoundCheck(claim.id, {
			name: "Another Checker",
			reason: "Renamed",
		});
		expect(changed.status).toBe(200);
		expect(await pluginRows()).toBe(0);
	});

	it("publishes a case with evidence without a tea.health entry in the snapshot", async () => {
		const { owner, claim, testCase } = await setupClaim();
		await appendRecord(owner.id, claim.id);
		await mockAuth(owner.id);
		await callRevoke(
			claim.id,
			(await prisma.pluginHealthEvidence.findFirstOrThrow()).recordId
		);

		const published = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);

		const row = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: published.publishedId },
		});
		const content = row.content as { pluginData?: Record<string, unknown> };
		expect(content.pluginData?.["tea.health"]).toBeUndefined();
	});
});

describe("changing the bound check", () => {
	it("refuses a missing or blank reason or name, and an unchanged name", async () => {
		const { owner, claim } = await setupClaim();
		await appendRecord(owner.id, claim.id);
		await mockAuth(owner.id);

		expect((await callBoundCheck(claim.id, { name: "X" })).status).toBe(400);
		expect(
			(await callBoundCheck(claim.id, { name: "X", reason: "  " })).status
		).toBe(400);
		expect(
			(await callBoundCheck(claim.id, { name: " ", reason: "r" })).status
		).toBe(400);
		const same = await callBoundCheck(claim.id, {
			name: "Sensor Range Checker",
			reason: "r",
		});
		expect(same.status).toBe(409);
		expect(
			await prisma.pluginHealthBindingChange.count({
				where: { claimId: claim.id, source: "PERSON" },
			})
		).toBe(0);
	});

	it("writes a history row, then accepts records for the new check and refuses the old", async () => {
		const { owner, testCase, claim } = await setupClaim();
		await appendRecord(owner.id, claim.id);
		const { secret } = await setupMachineWriter(owner.id, testCase.id);
		const { POST } = await importMachineRoute();
		const post = (body: unknown) =>
			POST(machinePost(claim.id, body, secret), {
				params: Promise.resolve({ id: claim.id }),
			});
		await mockAuth(owner.id);

		const changed = await callBoundCheck(claim.id, {
			name: "Forecast Availability Checker",
			reason: "Renamed upstream",
		});

		expect([200, 201]).toContain(changed.status);
		const history = await prisma.pluginHealthBindingChange.findMany({
			where: { claimId: claim.id, source: "PERSON" },
		});
		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({
			fromCheckName: "Sensor Range Checker",
			toCheckName: "Forecast Availability Checker",
			reason: "Renamed upstream",
			changedById: owner.id,
		});
		expect((await post(wireRecord(claim.id, "wholeSystem"))).status).toBe(201);
		expect((await post(wireRecord(claim.id, "populationPass"))).status).toBe(
			422
		);
	});
});
