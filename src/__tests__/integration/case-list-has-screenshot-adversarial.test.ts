import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	listSharedCases,
	listUserCases,
} from "@/lib/services/case-fetch-service";
import { listUserPatterns } from "@/lib/services/case-kind-service";
import { mockNoAuth } from "../utils/auth-helpers";
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
 * hasScreenshot is true exactly when the case has a stored screenshot row, in
 * the own-cases list, the patterns list and the shared-cases list, however the
 * reader came to see the case.
 */

beforeEach(async () => {
	await mockNoAuth();
});

function addScreenshot(caseId: string, userId: string) {
	return prisma.caseImage.create({
		data: {
			caseId,
			imageUrl: `/media/${caseId}.png`,
			uploadedAt: new Date(),
			uploadedById: userId,
		},
	});
}

function flagsByName(
	list:
		| { data: { name: string; hasScreenshot: boolean }[] }
		| { error: string },
	...names: string[]
) {
	const rows = "data" in list ? list.data : [];
	return Object.fromEntries(
		names.map((name) => [
			name,
			rows.find((r) => r.name === name)?.hasScreenshot,
		])
	);
}

describe("hasScreenshot in the case lists", () => {
	it("is right for own cases, directly shared cases and own patterns", async () => {
		const reader = await createTestUser();
		const other = await createTestUser();
		const withShot = await createStoredCase(reader.id, "own with");
		await createStoredCase(reader.id, "own without");
		const sharedWith = await createStoredCase(other.id, "direct with");
		const patternWith = await createStoredPattern(reader.id, "pattern with");
		await createStoredPattern(reader.id, "pattern without");
		const sharedWithout = await createStoredCase(other.id, "direct without");
		await createTestPermission(sharedWith.id, reader.id, other.id);
		await createTestPermission(sharedWithout.id, reader.id, other.id);
		await addScreenshot(withShot.id, reader.id);
		await addScreenshot(sharedWith.id, other.id);
		await addScreenshot(patternWith.id, reader.id);

		const cases = await listUserCases(reader.id);
		expect(
			flagsByName(
				cases,
				"own with",
				"own without",
				"direct with",
				"direct without"
			)
		).toEqual({
			"own with": true,
			"own without": false,
			"direct with": true,
			"direct without": false,
		});
		const patterns = await listUserPatterns(reader.id);
		expect(flagsByName(patterns, "pattern with", "pattern without")).toEqual({
			"pattern with": true,
			"pattern without": false,
		});
	});

	it("is right in the shared list, for direct and team grants", async () => {
		const reader = await createTestUser();
		const other = await createTestUser();
		const team = await createTestTeam(other.id);
		await addTeamMember(team.id, reader.id, "MEMBER", other.id);
		const names = ["d with", "d without", "t with", "t without"];
		const [dWith, dWithout, tWith, tWithout] = await Promise.all(
			names.map((name) => createStoredCase(other.id, name))
		);
		const granted = [dWith, dWithout, tWith, tWithout].map((c) => c?.id ?? "");
		await createTestPermission(granted[0] ?? "", reader.id, other.id);
		await createTestPermission(granted[1] ?? "", reader.id, other.id);
		await createTestTeamPermission(granted[2] ?? "", team.id, other.id);
		await createTestTeamPermission(granted[3] ?? "", team.id, other.id);
		await addScreenshot(granted[0] ?? "", other.id);
		await addScreenshot(granted[2] ?? "", other.id);

		const shared = await listSharedCases(reader.id);
		expect(flagsByName(shared, ...names)).toEqual({
			"d with": true,
			"d without": false,
			"t with": true,
			"t without": false,
		});
	});

	it("follows a screenshot being added and then removed", async () => {
		const reader = await createTestUser();
		const c = await createStoredCase(reader.id, "changing");
		expect(flagsByName(await listUserCases(reader.id), "changing")).toEqual({
			changing: false,
		});

		const image = await addScreenshot(c.id, reader.id);
		expect(flagsByName(await listUserCases(reader.id), "changing")).toEqual({
			changing: true,
		});

		await prisma.caseImage.delete({ where: { id: image.id } });
		expect(flagsByName(await listUserCases(reader.id), "changing")).toEqual({
			changing: false,
		});
	});

	it("does not mark a case with another case's screenshot", async () => {
		const reader = await createTestUser();
		const a = await createStoredCase(reader.id, "has image");
		await createStoredCase(reader.id, "neighbour");
		await addScreenshot(a.id, reader.id);

		expect(
			flagsByName(await listUserCases(reader.id), "has image", "neighbour")
		).toEqual({ "has image": true, neighbour: false });
	});
});
