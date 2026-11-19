import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	fetchAssuranceCases,
	fetchSharedAssuranceCases,
} from "@/actions/assurance-cases";
import {
	listSharedCases,
	listUserCases,
} from "@/lib/services/case-fetch-service";
import { listUserPatterns } from "@/lib/services/case-kind-service";
import type { PermissionLevel } from "@/src/generated/prisma";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createStoredCase, createStoredPattern } from "../utils/case-kind-kit";
import {
	addTeamMember,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

/**
 * The lists behind the dashboard cards report the level the caller holds on
 * each case: the highest of their own direct and team grants, and nobody
 * else's.
 */

beforeEach(async () => {
	await mockNoAuth();
});

function levelOf(
	cases: { id: string | number; permissions?: string }[],
	caseId: string
): string | undefined {
	return cases.find((c) => c.id === caseId)?.permissions;
}

describe("listUserCases — the level on each card", () => {
	it.each([
		["VIEW", "view"],
		["COMMENT", "comment"],
		["EDIT", "edit"],
		["ADMIN", "manage"],
	] satisfies [
		PermissionLevel,
		string,
	][])("a direct %s share reports %s", async (permission, expected) => {
		const owner = await createTestUser();
		const reader = await createTestUser();
		const shared = await createStoredCase(owner.id);
		await createTestPermission(shared.id, reader.id, owner.id, permission);

		const cases = expectSuccess(await listUserCases(reader.id));

		expect(levelOf(cases, shared.id)).toBe(expected);
	});

	it("reports owner for the person who created the case", async () => {
		const owner = await createTestUser();
		const own = await createStoredCase(owner.id);

		const cases = expectSuccess(await listUserCases(owner.id));

		expect(levelOf(cases, own.id)).toBe("owner");
	});

	it("reports the higher of a direct share and a team grant", async () => {
		const owner = await createTestUser();
		const reader = await createTestUser();
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, reader.id, "MEMBER", owner.id);
		const shared = await createStoredCase(owner.id);
		await createTestPermission(shared.id, reader.id, owner.id, "VIEW");
		await createTestTeamPermission(shared.id, team.id, owner.id, "ADMIN");

		const cases = expectSuccess(await listUserCases(reader.id));

		expect(levelOf(cases, shared.id)).toBe("manage");
	});

	it("does not take another person's higher share as the caller's level", async () => {
		const owner = await createTestUser();
		const reader = await createTestUser();
		const admin = await createTestUser();
		const shared = await createStoredCase(owner.id);
		await createTestPermission(shared.id, reader.id, owner.id, "VIEW");
		await createTestPermission(shared.id, admin.id, owner.id, "ADMIN");
		const otherTeam = await createTestTeam(admin.id);
		await createTestTeamPermission(shared.id, otherTeam.id, owner.id, "ADMIN");

		const cases = expectSuccess(await listUserCases(reader.id));

		expect(levelOf(cases, shared.id)).toBe("view");
	});
});

describe("listSharedCases — the level on each card", () => {
	it("reports manage for a direct Admin share", async () => {
		const owner = await createTestUser();
		const reader = await createTestUser();
		const shared = await createStoredCase(owner.id);
		await createTestPermission(shared.id, reader.id, owner.id, "ADMIN");

		const cases = expectSuccess(await listSharedCases(reader.id));

		expect(levelOf(cases, shared.id)).toBe("manage");
	});

	it("reports manage for a team Admin grant and view for a team View grant", async () => {
		const owner = await createTestUser();
		const reader = await createTestUser();
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, reader.id, "MEMBER", owner.id);
		const adminCase = await createStoredCase(owner.id);
		const viewCase = await createStoredCase(owner.id);
		await createTestTeamPermission(adminCase.id, team.id, owner.id, "ADMIN");
		await createTestTeamPermission(viewCase.id, team.id, owner.id, "VIEW");

		const cases = expectSuccess(await listSharedCases(reader.id));

		expect(levelOf(cases, adminCase.id)).toBe("manage");
		expect(levelOf(cases, viewCase.id)).toBe("view");
	});

	it("leaves the caller at their own level when another person holds Admin on the same case", async () => {
		const owner = await createTestUser();
		const reader = await createTestUser();
		const admin = await createTestUser();
		const shared = await createStoredCase(owner.id);
		await createTestPermission(shared.id, reader.id, owner.id, "VIEW");
		await createTestPermission(shared.id, admin.id, owner.id, "ADMIN");

		const cases = expectSuccess(await listSharedCases(reader.id));

		expect(levelOf(cases, shared.id)).toBe("view");
	});
});

describe("listUserPatterns — the level on each card", () => {
	it("reports manage for a pattern shared directly at Admin", async () => {
		const owner = await createTestUser();
		const reader = await createTestUser();
		const pattern = await createStoredPattern(owner.id);
		await createTestPermission(pattern.id, reader.id, owner.id, "ADMIN");

		const patterns = expectSuccess(await listUserPatterns(reader.id));

		expect(levelOf(patterns, pattern.id)).toBe("manage");
	});
});

describe("the dashboard actions carry the level to the page", () => {
	it("returns manage to an Admin collaborator from both lists", async () => {
		const owner = await createTestUser();
		const reader = await createTestUser();
		const shared = await createStoredCase(owner.id);
		await createTestPermission(shared.id, reader.id, owner.id, "ADMIN");
		await mockAuth(reader.id);

		const own = await fetchAssuranceCases();
		const sharedList = await fetchSharedAssuranceCases();

		expect(levelOf(own ?? [], shared.id)).toBe("manage");
		expect(levelOf(sharedList ?? [], shared.id)).toBe("manage");
	});
});
