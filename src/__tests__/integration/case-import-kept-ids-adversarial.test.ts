import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canAccessCase } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { importCase } from "@/lib/services/case-import-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createNestedCaseWithChainJSON,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Importing a case file never lets the file choose ids. Without the
 * trusted-caller option every element and the case get new ids, whatever the
 * file says, through the service and through all three import routes. With
 * the option, the file's element ids are kept and the case gets the id given.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

const { mockSetCredentials, mockRefreshAccessToken, mockFilesGet, mockDrive } =
	vi.hoisted(() => ({
		mockSetCredentials: vi.fn(),
		mockRefreshAccessToken: vi.fn(),
		mockFilesGet: vi.fn(),
		mockDrive: vi.fn(),
	}));

vi.mock("googleapis", () => {
	class OAuth2 {
		setCredentials = mockSetCredentials;
		refreshAccessToken = mockRefreshAccessToken;
	}
	return { google: { auth: { OAuth2 }, drive: mockDrive } };
});

const { mockHasGitHubToken, mockFetchFileFromGitHub } = vi.hoisted(() => ({
	mockHasGitHubToken: vi.fn(),
	mockFetchFileFromGitHub: vi.fn(),
}));

vi.mock("@/lib/services/github-api-service", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/services/github-api-service")>();
	return {
		...actual,
		hasGitHubToken: mockHasGitHubToken,
		fetchFileFromGitHub: mockFetchFileFromGitHub,
	};
});

beforeEach(async () => {
	await mockNoAuth();
	vi.clearAllMocks();
	mockDrive.mockReturnValue({
		files: { list: vi.fn(), create: vi.fn(), get: mockFilesGet },
	});
});

const HOSTILE_CASE_ID = "99999999-9999-4999-8999-999999999999";
const GIVEN_CASE_ID = "77777777-7777-4777-8777-777777777777";

/** Top-level and nested fields a hostile file might carry to ask for kept ids. */
const HOSTILE_FIELDS: [string, Record<string, unknown>][] = [
	["a top-level fixedIds object", { fixedIds: { caseId: HOSTILE_CASE_ID } }],
	["a top-level fixedIds flag", { fixedIds: true }],
	["a top-level caseId", { caseId: HOSTILE_CASE_ID }],
	["a top-level id", { id: HOSTILE_CASE_ID }],
	[
		"an options object holding fixedIds",
		{ options: { fixedIds: { caseId: HOSTILE_CASE_ID } } },
	],
	["a keepIds flag", { keepIds: true, preserveIds: true }],
	[
		"case metadata that names an id",
		{
			case: {
				name: "Hostile",
				description: "d",
				id: HOSTILE_CASE_ID,
				caseId: HOSTILE_CASE_ID,
				fixedIds: { caseId: HOSTILE_CASE_ID },
			},
		},
	],
];

const FLAT_IDS = {
	goal: "20000000-0000-4000-8000-000000000001",
	strategy: "20000000-0000-4000-8000-000000000002",
	claim: "20000000-0000-4000-8000-000000000003",
	evidence: "20000000-0000-4000-8000-000000000004",
};

function flatFile(extra: Record<string, unknown> = {}) {
	return {
		version: "2.0",
		exportedAt: new Date().toISOString(),
		case: { name: "Flat file case", description: "A flat-format case" },
		elements: [
			{
				id: FLAT_IDS.goal,
				elementType: "GOAL",
				role: "TOP_LEVEL",
				parentId: null,
				name: "G1",
				description: "The goal",
				inSandbox: false,
			},
			{
				id: FLAT_IDS.strategy,
				elementType: "STRATEGY",
				parentId: FLAT_IDS.goal,
				name: "S1",
				description: "The strategy",
				inSandbox: false,
			},
			{
				id: FLAT_IDS.claim,
				elementType: "PROPERTY_CLAIM",
				parentId: FLAT_IDS.strategy,
				name: "P1",
				description: "The claim",
				inSandbox: false,
				level: 1,
			},
			{
				id: FLAT_IDS.evidence,
				elementType: "EVIDENCE",
				parentId: null,
				name: "E1",
				description: "The evidence",
				url: "https://example.com/evidence",
				inSandbox: false,
			},
		],
		evidenceLinks: [{ evidenceId: FLAT_IDS.evidence, claimId: FLAT_IDS.claim }],
		...extra,
	};
}

function nestedIds(): string[] {
	return [
		"10000000-0000-4000-8000-000000000001",
		"10000000-0000-4000-8000-000000000002",
		"10000000-0000-4000-8000-000000000003",
		"10000000-0000-4000-8000-000000000004",
	];
}

async function elementIdsOf(caseId: string): Promise<string[]> {
	const rows = await prisma.assuranceElement.findMany({
		where: { caseId },
		select: { id: true },
	});
	return rows.map((row) => row.id).sort();
}

interface IdReport {
	caseIdIsAskedFor: boolean;
	elementCount: number;
	fileIdsInDatabase: number;
	hostileCaseExists: boolean;
	storedIdsSharedWithFile: number;
}

/** What the database holds for an imported case, set against the ids the file named. */
async function idReport(caseId: string, fileIds: string[]): Promise<IdReport> {
	const stored = await elementIdsOf(caseId);
	return {
		caseIdIsAskedFor: caseId === HOSTILE_CASE_ID || caseId === GIVEN_CASE_ID,
		hostileCaseExists:
			(await prisma.assuranceCase.findUnique({
				where: { id: HOSTILE_CASE_ID },
			})) !== null,
		elementCount: stored.length,
		storedIdsSharedWithFile: stored.filter((id) => fileIds.includes(id)).length,
		fileIdsInDatabase: await prisma.assuranceElement.count({
			where: { id: { in: fileIds } },
		}),
	};
}

/** The report of an import that kept none of the file's ids. */
function freshIds(elementCount: number): IdReport {
	return {
		caseIdIsAskedFor: false,
		hostileCaseExists: false,
		elementCount,
		storedIdsSharedWithFile: 0,
		fileIdsInDatabase: 0,
	};
}

describe("importCase without the option", () => {
	it("gives the case and every element new ids, and a second import of the same file succeeds with different ones", async () => {
		const user = await createTestUser();
		const file = createNestedCaseWithChainJSON();

		const first = await importCase(user.id, file);
		const second = await importCase(user.id, file);

		expect("data" in first && "data" in second).toBe(true);
		if (!("data" in first && "data" in second)) {
			return;
		}
		expect(await idReport(first.data.caseId, nestedIds())).toEqual(freshIds(4));
		expect(second.data.caseId).not.toBe(first.data.caseId);
		const firstIds = await elementIdsOf(first.data.caseId);
		const secondIds = await elementIdsOf(second.data.caseId);
		expect(secondIds).toHaveLength(4);
		for (const id of secondIds) {
			expect(firstIds).not.toContain(id);
		}
	});

	it("gives a flat-format file new ids and keeps the evidence link between the new ones", async () => {
		const user = await createTestUser();

		const result = await importCase(user.id, flatFile());

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}
		expect(await idReport(result.data.caseId, Object.values(FLAT_IDS))).toEqual(
			freshIds(4)
		);
		const links = await prisma.evidenceLink.findMany({
			where: { claim: { caseId: result.data.caseId } },
		});
		expect(links).toHaveLength(1);
		expect(Object.values(FLAT_IDS)).not.toContain(links[0]?.claimId);
		expect(Object.values(FLAT_IDS)).not.toContain(links[0]?.evidenceId);
	});

	it.each(
		HOSTILE_FIELDS
	)("ignores %s in a nested file", async (_label, extra) => {
		const user = await createTestUser();

		const result = await importCase(user.id, {
			...createNestedCaseWithChainJSON(),
			...extra,
		});

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}
		expect(await idReport(result.data.caseId, nestedIds())).toEqual(
			freshIds(4)
		);
	});

	it.each(
		HOSTILE_FIELDS
	)("ignores %s in a flat file", async (_label, extra) => {
		const user = await createTestUser();

		const result = await importCase(user.id, flatFile(extra));

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}
		expect(await idReport(result.data.caseId, Object.values(FLAT_IDS))).toEqual(
			freshIds(4)
		);
	});

	it("ignores a __proto__ key that carries the option", async () => {
		const user = await createTestUser();
		const text = JSON.stringify(createNestedCaseWithChainJSON());
		const file = JSON.parse(
			`{"__proto__":{"fixedIds":{"caseId":"${HOSTILE_CASE_ID}"}},${text.slice(1)}`
		);

		const result = await importCase(user.id, file);

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}
		expect(await idReport(result.data.caseId, nestedIds())).toEqual(
			freshIds(4)
		);
	});

	it.each([
		["an empty options object", {}],
		["an options object with no fixedIds", { fixedIds: undefined }],
	])("gives new ids when called with %s", async (_label, options) => {
		const user = await createTestUser();

		const result = await importCase(
			user.id,
			createNestedCaseWithChainJSON(),
			options
		);

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}
		expect(await idReport(result.data.caseId, nestedIds())).toEqual(
			freshIds(4)
		);
	});
});

describe("importCase with the trusted-caller option", () => {
	it("keeps every element id and the parent links between them, and gives the case the id given", async () => {
		const user = await createTestUser();

		const result = await importCase(user.id, createNestedCaseWithChainJSON(), {
			fixedIds: { caseId: GIVEN_CASE_ID },
		});

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}
		expect(result.data.caseId).toBe(GIVEN_CASE_ID);
		expect(await elementIdsOf(GIVEN_CASE_ID)).toEqual(nestedIds());
		const rows = await prisma.assuranceElement.findMany({
			where: { caseId: GIVEN_CASE_ID },
			select: { id: true, parentId: true },
		});
		const parentOf = Object.fromEntries(rows.map((r) => [r.id, r.parentId]));
		const ids = nestedIds();
		expect(parentOf[ids[0] as string]).toBeNull();
		expect(parentOf[ids[1] as string]).toBe(ids[0]);
		expect(parentOf[ids[2] as string]).toBe(ids[1]);
		expect(parentOf[ids[3] as string]).toBeNull();
		const links = await prisma.evidenceLink.findMany({
			where: { claim: { caseId: GIVEN_CASE_ID } },
		});
		expect(links.map((link) => [link.claimId, link.evidenceId])).toEqual([
			[ids[2], ids[3]],
		]);
	});

	it("keeps the ids a flat file's evidence link points at", async () => {
		const user = await createTestUser();

		const result = await importCase(user.id, flatFile(), {
			fixedIds: { caseId: GIVEN_CASE_ID },
		});

		expect("data" in result).toBe(true);
		const links = await prisma.evidenceLink.findMany({
			where: { claim: { caseId: GIVEN_CASE_ID } },
		});
		expect(links).toHaveLength(1);
		expect(links[0]?.claimId).toBe(FLAT_IDS.claim);
		expect(links[0]?.evidenceId).toBe(FLAT_IDS.evidence);
	});

	it("makes the importing user the case's creator with ADMIN access to it", async () => {
		const user = await createTestUser();

		await importCase(user.id, createNestedCaseWithChainJSON(), {
			fixedIds: { caseId: GIVEN_CASE_ID },
		});

		const created = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: GIVEN_CASE_ID },
		});
		expect(created.createdById).toBe(user.id);
		expect(
			await canAccessCase({ userId: user.id, caseId: GIVEN_CASE_ID }, "ADMIN")
		).toBe(true);
	});

	it("refuses a second import of the same ids cleanly and leaves the first case whole", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const file = createNestedCaseWithChainJSON();
		await importCase(owner.id, file, { fixedIds: { caseId: GIVEN_CASE_ID } });

		const again = await importCase(other.id, file, {
			fixedIds: { caseId: GIVEN_CASE_ID },
		});

		expect("error" in again).toBe(true);
		expect(await prisma.assuranceCase.count()).toBe(1);
		expect(await elementIdsOf(GIVEN_CASE_ID)).toEqual(nestedIds());
		const stillOwned = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: GIVEN_CASE_ID },
		});
		expect(stillOwned.createdById).toBe(owner.id);
	});

	it("refuses kept element ids that already belong to another case and creates nothing", async () => {
		const owner = await createTestUser();
		const file = createNestedCaseWithChainJSON();
		await importCase(owner.id, file, { fixedIds: { caseId: GIVEN_CASE_ID } });

		const clash = await importCase(owner.id, file, {
			fixedIds: { caseId: HOSTILE_CASE_ID },
		});

		expect("error" in clash).toBe(true);
		expect(
			await prisma.assuranceCase.findUnique({ where: { id: HOSTILE_CASE_ID } })
		).toBeNull();
		expect(await prisma.assuranceCase.count()).toBe(1);
	});
});

describe("the import routes never keep ids from a file", () => {
	const hostileEverything = {
		fixedIds: { caseId: HOSTILE_CASE_ID },
		caseId: HOSTILE_CASE_ID,
		id: HOSTILE_CASE_ID,
		options: { fixedIds: { caseId: HOSTILE_CASE_ID } },
		keepIds: true,
	};

	it("POST /api/cases/import gives new ids whatever the body asks", async () => {
		const { POST } = await import("@/app/api/cases/import/route");
		for (const [, extra] of HOSTILE_FIELDS) {
			const user = await createTestUser();
			await mockAuth(user.id, user.username, user.email);

			const response = await POST(
				new NextRequest("http://localhost:3000/api/cases/import", {
					method: "POST",
					body: JSON.stringify({
						...createNestedCaseWithChainJSON(),
						...extra,
					}),
				})
			);

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(await idReport(body.id, nestedIds())).toEqual(freshIds(4));
			await prisma.assuranceCase.delete({ where: { id: body.id } });
		}
	});

	it("POST /api/cases/import gives a flat file new ids", async () => {
		const { POST } = await import("@/app/api/cases/import/route");
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const response = await POST(
			new NextRequest("http://localhost:3000/api/cases/import", {
				method: "POST",
				body: JSON.stringify(flatFile(hostileEverything)),
			})
		);

		expect(response.status).toBe(200);
		expect(
			await idReport((await response.json()).id, Object.values(FLAT_IDS))
		).toEqual(freshIds(4));
	});

	it("POST /api/cases/import/gdrive gives new ids whatever the downloaded file asks", async () => {
		const user = await createTestUser();
		await prisma.user.update({
			where: { id: user.id },
			data: {
				googleAccessToken: "test-access-token",
				googleRefreshToken: "test-refresh-token",
				googleTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
				googleId: "google-test-id",
				googleEmail: "googleuser@example.com",
			},
		});
		await mockAuth(user.id, user.username, user.email);
		mockFilesGet
			.mockImplementationOnce(() =>
				Promise.resolve({
					data: { name: "backup.json", mimeType: "application/json" },
				})
			)
			.mockImplementationOnce(() =>
				Promise.resolve({
					data: JSON.stringify({
						...createNestedCaseWithChainJSON(),
						...hostileEverything,
					}),
				})
			);

		const { POST } = await import("@/app/api/cases/import/gdrive/route");
		const response = await POST(
			new NextRequest("http://localhost:3000/api/cases/import/gdrive", {
				method: "POST",
				body: JSON.stringify({ fileId: "file-id" }),
				headers: { "Content-Type": "application/json" },
			})
		);

		expect(response.status).toBe(200);
		expect(await idReport((await response.json()).id, nestedIds())).toEqual(
			freshIds(4)
		);
	});

	it("POST /api/cases/import/github gives new ids whatever the fetched file asks", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);
		mockHasGitHubToken.mockResolvedValue(true);
		mockFetchFileFromGitHub.mockResolvedValue({
			data: {
				content: JSON.stringify({
					...createNestedCaseWithChainJSON(),
					...hostileEverything,
				}),
				path: "case.json",
				sha: "abc",
				size: 1,
			},
		});

		const { POST } = await import("@/app/api/cases/import/github/route");
		const response = await POST(
			new NextRequest("http://localhost:3000/api/cases/import/github", {
				method: "POST",
				body: JSON.stringify({ url: "owner/repo/case.json" }),
				headers: { "Content-Type": "application/json" },
			})
		);

		expect(response.status).toBe(200);
		expect(await idReport((await response.json()).id, nestedIds())).toEqual(
			freshIds(4)
		);
	});

	it("POST /api/cases/import/gdrive and /github either refuse or ignore ids asked for in the request body", async () => {
		const user = await createTestUser();
		await prisma.user.update({
			where: { id: user.id },
			data: {
				googleAccessToken: "test-access-token",
				googleRefreshToken: "test-refresh-token",
				googleTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
				googleId: "google-test-id",
				googleEmail: "googleuser@example.com",
			},
		});
		await mockAuth(user.id, user.username, user.email);
		mockHasGitHubToken.mockResolvedValue(true);
		mockFetchFileFromGitHub.mockResolvedValue({
			data: {
				content: JSON.stringify(createNestedCaseWithChainJSON()),
				path: "case.json",
				sha: "abc",
				size: 1,
			},
		});
		mockFilesGet.mockImplementation((request: { alt?: string }) =>
			Promise.resolve({
				data: request.alt
					? JSON.stringify(createNestedCaseWithChainJSON())
					: { name: "backup.json", mimeType: "application/json" },
			})
		);

		const { POST: fromDrive } = await import(
			"@/app/api/cases/import/gdrive/route"
		);
		const { POST: fromGitHub } = await import(
			"@/app/api/cases/import/github/route"
		);
		const responses = [
			await fromDrive(
				new NextRequest("http://localhost:3000/api/cases/import/gdrive", {
					method: "POST",
					body: JSON.stringify({ fileId: "file-id", ...hostileEverything }),
					headers: { "Content-Type": "application/json" },
				})
			),
			await fromGitHub(
				new NextRequest("http://localhost:3000/api/cases/import/github", {
					method: "POST",
					body: JSON.stringify({
						url: "owner/repo/case.json",
						...hostileEverything,
					}),
					headers: { "Content-Type": "application/json" },
				})
			),
		];

		for (const response of responses) {
			const body = await response.json();
			if (response.status === 200) {
				expect(body.id).not.toBe(HOSTILE_CASE_ID);
			}
		}
		expect(
			await prisma.assuranceCase.findUnique({ where: { id: HOSTILE_CASE_ID } })
		).toBeNull();
		expect(
			await prisma.assuranceElement.count({
				where: { id: { in: nestedIds() } },
			})
		).toBe(0);
	});
});
