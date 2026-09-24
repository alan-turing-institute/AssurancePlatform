import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addTeamMember,
	createTestCase,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const GENERIC_METADATA = { title: "Assurance Case | TEA Platform" };
const NON_EXISTENT_CASE_ID = "00000000-0000-0000-0000-000000000000";
const PRISMA_IMPORT_PATTERN = /@\/lib\/prisma/;

async function trashCase(caseId: string): Promise<void> {
	await prisma.assuranceCase.update({
		where: { id: caseId },
		data: { deletedAt: new Date() },
	});
}

describe("generateMetadata — case page (AP-QA-012)", () => {
	it("returns the case name for the owner", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, { name: "Owner's Case" });
		await mockAuth(owner.id, owner.username, owner.email);

		const { generateMetadata } = await import(
			"@/app/(cases)/case/[caseId]/page"
		);
		const metadata = await generateMetadata({
			params: Promise.resolve({ caseId: testCase.id }),
		});

		expect(metadata).toEqual({ title: "Owner's Case | TEA Platform" });
	});

	it("returns the case name for a direct VIEW grantee", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id, { name: "Shared Case" });
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { generateMetadata } = await import(
			"@/app/(cases)/case/[caseId]/page"
		);
		const metadata = await generateMetadata({
			params: Promise.resolve({ caseId: testCase.id }),
		});

		expect(metadata).toEqual({ title: "Shared Case | TEA Platform" });
	});

	it("returns the case name for a team-member viewer", async () => {
		const owner = await createTestUser();
		const teamAdmin = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCase(owner.id, { name: "Team Case" });
		const team = await createTestTeam(teamAdmin.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");
		await mockAuth(teamMember.id, teamMember.username, teamMember.email);

		const { generateMetadata } = await import(
			"@/app/(cases)/case/[caseId]/page"
		);
		const metadata = await generateMetadata({
			params: Promise.resolve({ caseId: testCase.id }),
		});

		expect(metadata).toEqual({ title: "Team Case | TEA Platform" });
	});

	it("returns byte-equivalent generic metadata for no grant, a missing ID and a trashed case", async () => {
		const owner = await createTestUser();
		const outsider = await createTestUser();
		const accessibleCase = await createTestCase(owner.id, {
			name: "Not Yours",
		});
		const trashed = await createTestCase(owner.id, { name: "Trashed Case" });
		await trashCase(trashed.id);
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { generateMetadata } = await import(
			"@/app/(cases)/case/[caseId]/page"
		);

		const noGrant = await generateMetadata({
			params: Promise.resolve({ caseId: accessibleCase.id }),
		});
		const missing = await generateMetadata({
			params: Promise.resolve({ caseId: NON_EXISTENT_CASE_ID }),
		});
		const trashedResult = await generateMetadata({
			params: Promise.resolve({ caseId: trashed.id }),
		});

		expect(noGrant).toEqual(GENERIC_METADATA);
		expect(missing).toEqual(GENERIC_METADATA);
		expect(trashedResult).toEqual(GENERIC_METADATA);
		expect(noGrant).toEqual(missing);
		expect(missing).toEqual(trashedResult);
	});

	it("returns generic metadata with no session, even for an owned case", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, { name: "Owner's Case" });
		await mockNoAuth();

		const { generateMetadata } = await import(
			"@/app/(cases)/case/[caseId]/page"
		);
		const metadata = await generateMetadata({
			params: Promise.resolve({ caseId: testCase.id }),
		});

		expect(metadata).toEqual(GENERIC_METADATA);
	});

	it("no longer imports @/lib/prisma", () => {
		const pageSource = readFileSync(
			join(process.cwd(), "app/(cases)/case/[caseId]/page.tsx"),
			"utf-8"
		);
		expect(pageSource).not.toMatch(PRISMA_IMPORT_PATTERN);
	});
});
