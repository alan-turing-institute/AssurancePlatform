import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	computeRecordHash,
	revokeHealthEvidence,
} from "@/lib/services/health-evidence-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addClaim,
	appendRecord,
	importMachineRoute,
	isoAgo,
	machineGet,
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

interface ListItem {
	chain_sequence: number;
	created_at: string;
	created_by_id: string;
	id: string;
	previous_record_hash: string | null;
	record: Record<string, unknown>;
	record_hash: string;
	revocation: unknown;
}

async function list(
	userId: string,
	claimId: string,
	query = ""
): Promise<{ status: number; items: ListItem[]; next: number | null }> {
	await mockAuth(userId);
	const { GET } = await importMachineRoute();
	const response = await GET(machineGet(claimId, undefined, query), {
		params: Promise.resolve({ id: claimId }),
	});
	const body = await response.json();
	return {
		status: response.status,
		items: body.evidence ?? [],
		next: body.next_before ?? null,
	};
}

const recompute = (item: ListItem) =>
	computeRecordHash(
		{
			record: item.record,
			createdById: item.created_by_id,
			createdAt: item.created_at,
		},
		item.previous_record_hash
	);

/** Replaces `"@@raw:<text>@@"` string placeholders with the bare text, so a number can be sent in a form `JSON.stringify` would not produce. */
const rawBody = (value: unknown) =>
	JSON.stringify(value).replace(/"@@raw:(.*?)@@"/g, "$1");

describe("hash chain", () => {
	it("recomputes from what the list route returns, for awkward numbers, non-ASCII text and reordered nested keys", async () => {
		const ctx = await setupClaim();
		const { secret } = await setupMachineWriter(ctx.owner.id, ctx.testCase.id);
		const { POST } = await importMachineRoute();
		const claimId = ctx.claim.id;

		const awkward = {
			payload: {
				big: "@@raw:1e21@@",
				negativeZero: "@@raw:-0@@",
				sum: 0.1 + 0.2,
				largeInteger: "@@raw:12345678901234567890@@",
				tiny: "@@raw:5e-324@@",
				huge: "@@raw:1.7976931348623157e308@@",
				text: 'héllo 日本語 😀   tab\t quote" back\\slash',
				zebra: { z: 1, a: { y: [3, { b: 1, a: 2 }], b: 2 }, m: null },
				apple: [],
				ключ: "значение",
			},
			check: {
				name: "Unit Drift Checker",
				version: "1",
				scope: "unit",
				params: { b: 1, a: { d: 4, c: 3 }, é: 1e-7 },
			},
		};
		const first = {
			...wireRecord(claimId, "singleSubject"),
			...awkward,
			value: { number: "@@raw:1e21@@", unit: "mm" },
		};
		const second = {
			...wireRecord(claimId, "singleSubject"),
			check: awkward.check,
			value: { number: "@@raw:-0@@" },
			payload: { sum: 0.1 + 0.2 },
		};
		for (const body of [first, second]) {
			const response = await POST(machinePost(claimId, rawBody(body), secret), {
				params: Promise.resolve({ id: claimId }),
			});
			expect(response.status).toBe(201);
		}

		const { items } = await list(ctx.owner.id, claimId);

		expect(items).toHaveLength(2);
		for (const item of items) {
			expect(recompute(item)).toBe(item.record_hash);
		}
		const [newest, oldest] = items;
		expect(newest?.previous_record_hash).toBe(oldest?.record_hash);
		expect(oldest?.previous_record_hash).toBeNull();
		const row = await prisma.pluginHealthEvidence.findUniqueOrThrow({
			where: { id: oldest?.id },
		});
		expect(row.recordHash).toBe(oldest?.record_hash);
	});

	it("is unchanged by revocation and reinstatement of any record", async () => {
		const { owner, claim } = await setupClaim();
		const a = await appendRecord(owner.id, claim.id, "populationPass");
		const b = await appendRecord(owner.id, claim.id, "failingSummary");
		const before = await prisma.pluginHealthEvidence.findMany({
			where: { claimId: claim.id },
			orderBy: { chainSequence: "asc" },
		});

		expectSuccess(
			await revokeHealthEvidence(owner.id, claim.id, a.record_id, {
				cause: "duplicate",
				reason: "dup",
			})
		);
		expectSuccess(
			await revokeHealthEvidence(owner.id, claim.id, b.record_id, {
				cause: "other",
				reason: "x",
			})
		);
		const after = await prisma.pluginHealthEvidence.findMany({
			where: { claimId: claim.id },
			orderBy: { chainSequence: "asc" },
		});

		expect(after).toEqual(before);
		const { items } = await list(owner.id, claim.id);
		expect(items.every((item) => item.revocation !== null)).toBe(true);
		for (const item of items) {
			expect(recompute(item)).toBe(item.record_hash);
		}
	});

	it("chains each claim separately even when records for two claims interleave", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const other = await addClaim(testCase.id, owner.id);
		for (let i = 0; i < 3; i++) {
			await appendRecord(owner.id, claim.id);
			await appendRecord(owner.id, other.id);
		}

		for (const id of [claim.id, other.id]) {
			const { items } = await list(owner.id, id);
			expect(items).toHaveLength(3);
			expect(items[2]?.previous_record_hash).toBeNull();
			expect(items[0]?.previous_record_hash).toBe(items[1]?.record_hash);
			expect(items[1]?.previous_record_hash).toBe(items[2]?.record_hash);
		}
	});
});

describe("evidence list paging", () => {
	async function fill(userId: string, claimId: string, count: number) {
		for (let i = 0; i < count; i++) {
			await appendRecord(userId, claimId, "populationPass", {
				timestamp: isoAgo((count - i) * 1000),
			});
		}
	}

	it.each([
		[0, 0, false],
		[50, 50, false],
		[51, 50, true],
	])("a claim with %i records: first page holds %i, more pages: %s", async (count, firstPage, more) => {
		const { owner, claim } = await setupClaim();
		await fill(owner.id, claim.id, count);

		const { status, items, next } = await list(owner.id, claim.id);

		expect(status).toBe(200);
		expect(items).toHaveLength(firstPage);
		expect(next !== null).toBe(more);
	});

	it("pages through 120 records newest first without gaps or repeats, and never shows another claim's records", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const other = await addClaim(testCase.id, owner.id);
		await appendRecord(owner.id, other.id);
		await fill(owner.id, claim.id, 120);
		await appendRecord(owner.id, other.id);

		const seen: number[] = [];
		const sizes: number[] = [];
		let before: number | null = null;
		for (let guard = 0; guard < 10; guard++) {
			const page = await list(
				owner.id,
				claim.id,
				before === null ? "" : `?before=${before}`
			);
			sizes.push(page.items.length);
			seen.push(...page.items.map((item) => item.chain_sequence));
			before = page.next;
			if (before === null) {
				break;
			}
		}

		expect(sizes).toEqual([50, 50, 20]);
		expect(new Set(seen).size).toBe(120);
		expect([...seen].sort((x, y) => y - x)).toEqual(seen);
		const own = await prisma.pluginHealthEvidence.findMany({
			where: { claimId: claim.id },
			select: { chainSequence: true },
		});
		expect(new Set(seen)).toEqual(new Set(own.map((r) => r.chainSequence)));
	});

	it("treats before at the first sequence as an empty last page and at the last sequence as everything older", async () => {
		const { owner, claim } = await setupClaim();
		await fill(owner.id, claim.id, 5);
		const rows = await prisma.pluginHealthEvidence.findMany({
			where: { claimId: claim.id },
			orderBy: { chainSequence: "asc" },
		});
		const first = rows[0]?.chainSequence ?? 0;
		const last = rows[4]?.chainSequence ?? 0;

		const atFirst = await list(owner.id, claim.id, `?before=${first}`);
		const atLast = await list(owner.id, claim.id, `?before=${last}`);
		const pastLast = await list(owner.id, claim.id, `?before=${last + 1}`);

		expect(atFirst.status).toBe(200);
		expect(atFirst.items).toHaveLength(0);
		expect(atFirst.next).toBeNull();
		expect(atLast.items).toHaveLength(4);
		expect(atLast.items.map((i) => i.chain_sequence)).not.toContain(last);
		expect(pastLast.items).toHaveLength(5);
	});

	it("honours limit up to 200 and refuses 0, 201 and non-numeric values", async () => {
		const { owner, claim } = await setupClaim();
		await fill(owner.id, claim.id, 3);

		expect((await list(owner.id, claim.id, "?limit=2")).items).toHaveLength(2);
		expect((await list(owner.id, claim.id, "?limit=200")).status).toBe(200);
		for (const bad of ["0", "201", "abc", "-1", "1.5", "", "1e2x"]) {
			expect(
				(await list(owner.id, claim.id, `?limit=${bad}`)).status,
				`limit=${bad}`
			).toBe(400);
		}
		for (const bad of ["abc", "-5", "1.5"]) {
			expect(
				(await list(owner.id, claim.id, `?before=${bad}`)).status,
				`before=${bad}`
			).toBe(400);
		}
	});
});
