import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	rotateToken,
	TOKEN_ROTATION_OVERLAP_MS,
} from "@/lib/services/integration-registry-service";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	createTestApiToken,
	createTestIntegrationWithSystemUser,
	createTestUser,
} from "../utils/prisma-factories";
import { holdRowLock, waitForLockWait } from "../utils/row-lock-test-utils";

/**
 * Rotating a token records its replacement on the old token, so a second
 * rotation of the same token is refused and the replacement keeps the true
 * end date. Races are made real by holding the old token's row lock in an
 * open transaction, so the rotation's conditional update waits behind it.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

const ALREADY_REPLACED = "Cannot rotate a token that has already been replaced";
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

async function setup(expiresAt?: Date) {
	const owner = await createTestUser();
	const { integration } = await createTestIntegrationWithSystemUser(owner.id);
	const token = await createTestApiToken(integration.id, { expiresAt });
	return { owner, integration, token };
}

function tokenCount(integrationId: string) {
	return prisma.apiToken.count({ where: { integrationId } });
}

describe("rotating a token twice", () => {
	it.each([
		["a 90-day end date", new Date(Date.now() + NINETY_DAYS_MS)],
		["no end date", undefined],
	])("refuses the second rotation and keeps the true end date (%s)", async (_label, expiresAt) => {
		const { owner, integration, token } = await setup(expiresAt);

		const first = await rotateToken(token.id, owner.id);
		if ("error" in first) {
			throw new Error(first.error);
		}
		const second = await rotateToken(token.id, owner.id);

		expect(second).toEqual({ error: ALREADY_REPLACED });
		expect(await tokenCount(integration.id)).toBe(2);
		const replacement = await prisma.apiToken.findUniqueOrThrow({
			where: { id: first.data.newToken.apiToken.id },
		});
		expect(replacement.expiresAt?.getTime() ?? null).toBe(
			expiresAt?.getTime() ?? null
		);
		const old = await prisma.apiToken.findUniqueOrThrow({
			where: { id: token.id },
		});
		expect(old.expiresAt?.getTime()).toBe(first.data.overlapUntil.getTime());
		expect(old.replacedByTokenId).toBe(replacement.id);
	});

	it("lets exactly one of two simultaneous rotations succeed and leaves no extra token", async () => {
		const { owner, integration, token } = await setup();
		const holder = await holdRowLock(async (tx) => {
			await tx.apiToken.update({
				where: { id: token.id },
				data: { lastUsedAt: new Date() },
			});
		});

		const a = rotateToken(token.id, owner.id);
		const b = rotateToken(token.id, owner.id);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const results = await Promise.all([a, b]);

		const successes = results.filter((r) => "data" in r);
		const refusals = results.filter((r) => "error" in r);
		expect(successes).toHaveLength(1);
		expect(refusals).toEqual([{ error: ALREADY_REPLACED }]);
		expect(await tokenCount(integration.id)).toBe(2);
		const winner = successes[0];
		const winnerId =
			winner && "data" in winner ? winner.data.newToken.apiToken.id : null;
		const old = await prisma.apiToken.findUniqueOrThrow({
			where: { id: token.id },
		});
		expect(old.replacedByTokenId).toBe(winnerId);
		const replacement = await prisma.apiToken.findUniqueOrThrow({
			where: { id: winnerId ?? "" },
		});
		expect(replacement.expiresAt).toBeNull();
	});

	it("leaves no live replacement when a revoke commits while the rotation waits", async () => {
		const { owner, integration, token } = await setup();
		const holder = await holdRowLock(async (tx) => {
			await tx.apiToken.update({
				where: { id: token.id },
				data: { revokedAt: new Date() },
			});
		});

		const pending = rotateToken(token.id, owner.id);
		await waitForLockWait();
		await holder.release();
		const result = await pending;

		expect(result).toEqual({ error: "Cannot rotate a revoked token" });
		expect(await tokenCount(integration.id)).toBe(1);
	});
});

describe("rotating the replacement", () => {
	it.each([
		["a 90-day end date", new Date(Date.now() + NINETY_DAYS_MS)],
		["no end date", undefined],
	])("works and keeps the true end date (%s)", async (_label, expiresAt) => {
		const { owner, integration, token } = await setup(expiresAt);
		const first = await rotateToken(token.id, owner.id);
		if ("error" in first) {
			throw new Error(first.error);
		}
		const bId = first.data.newToken.apiToken.id;

		const second = await rotateToken(bId, owner.id);
		if ("error" in second) {
			throw new Error(second.error);
		}

		const c = second.data.newToken.apiToken;
		expect(c.expiresAt?.getTime() ?? null).toBe(expiresAt?.getTime() ?? null);
		const b = await prisma.apiToken.findUniqueOrThrow({ where: { id: bId } });
		expect(b.expiresAt?.getTime()).toBeLessThanOrEqual(
			Date.now() + TOKEN_ROTATION_OVERLAP_MS
		);
		expect(await tokenCount(integration.id)).toBe(3);
	});

	it("links the second replacement to the token it replaced and still refuses the first", async () => {
		const { owner, token } = await setup();
		const first = await rotateToken(token.id, owner.id);
		if ("error" in first) {
			throw new Error(first.error);
		}
		const bId = first.data.newToken.apiToken.id;
		const second = await rotateToken(bId, owner.id);
		if ("error" in second) {
			throw new Error(second.error);
		}

		const b = await prisma.apiToken.findUniqueOrThrow({ where: { id: bId } });
		expect(b.replacedByTokenId).toBe(second.data.newToken.apiToken.id);
		expect(await rotateToken(token.id, owner.id)).toEqual({
			error: ALREADY_REPLACED,
		});
	});
});

describe("rotation refusals", () => {
	it("refuses an expired token as expired, not as replaced", async () => {
		const { owner, integration } = await setup();
		const replacement = await createTestApiToken(integration.id);
		const expired = await createTestApiToken(integration.id, {
			expiresAt: new Date(Date.now() - 60_000),
			replacedByTokenId: replacement.id,
		});

		expect(await rotateToken(expired.id, owner.id)).toEqual({
			error: "Cannot rotate an expired token",
		});
	});
});
