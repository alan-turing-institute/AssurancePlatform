import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { listUserCases } from "@/lib/services/case-fetch-service";
import {
	DEMO_FIXTURES,
	type DemoAccountValues,
	seedDemoAccount,
} from "../../../prisma/seed/demo-account-seed";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createStoredCase,
	createStoredPattern,
	FILE_FORMATS,
	patternFlags,
	RICH_ELEMENT_COUNT,
	richNestedFile,
	storedCase,
} from "../utils/case-kind-kit";
import {
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * The callers that import or export a case without any options: the file,
 * Google Drive and GitHub import routes, the export route, the case routes,
 * and the demo account seed. A file or a request body can name a kind, but
 * never a source pattern, never "mark every element", and never a new name.
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

type User = Awaited<ReturnType<typeof createTestUser>>;

/** Sends `file` through the file import route as `user`. */
async function throughFileRoute(user: User, file: unknown) {
	await mockAuth(user.id, user.username, user.email);
	const { POST } = await import("@/app/api/cases/import/route");
	return POST(
		new NextRequest("http://localhost:3000/api/cases/import", {
			method: "POST",
			body: JSON.stringify(file),
		})
	);
}

/** Sends `file` through the Google Drive import route as `user`. */
async function throughDriveRoute(user: User, file: unknown) {
	await prisma.user.update({
		where: { id: user.id },
		data: {
			googleAccessToken: "test-access-token",
			googleRefreshToken: "test-refresh-token",
			googleTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
			googleId: `google-${user.id}`,
			googleEmail: `${user.id}@example.com`,
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
			Promise.resolve({ data: JSON.stringify(file) })
		);
	const { POST } = await import("@/app/api/cases/import/gdrive/route");
	return POST(
		new NextRequest("http://localhost:3000/api/cases/import/gdrive", {
			method: "POST",
			body: JSON.stringify({ fileId: "file-id" }),
			headers: { "Content-Type": "application/json" },
		})
	);
}

/** Sends `file` through the GitHub import route as `user`. */
async function throughGitHubRoute(user: User, file: unknown) {
	await mockAuth(user.id, user.username, user.email);
	mockHasGitHubToken.mockResolvedValue(true);
	mockFetchFileFromGitHub.mockResolvedValue({
		data: {
			content: JSON.stringify(file),
			path: "case.json",
			sha: "abc",
			size: 1,
		},
	});
	const { POST } = await import("@/app/api/cases/import/github/route");
	return POST(
		new NextRequest("http://localhost:3000/api/cases/import/github", {
			method: "POST",
			body: JSON.stringify({ url: "owner/repo/case.json" }),
			headers: { "Content-Type": "application/json" },
		})
	);
}

const IMPORT_ROUTES: [string, typeof throughFileRoute][] = [
	["POST /api/cases/import", throughFileRoute],
	["POST /api/cases/import/gdrive", throughDriveRoute],
	["POST /api/cases/import/github", throughGitHubRoute],
];

describe.each(IMPORT_ROUTES)("%s", (_label, send) => {
	it("makes an ordinary, unlinked case with the file's name and the file's own pattern flags from a file that says nothing about kind", async () => {
		const user = await createTestUser();

		const response = await send(
			user,
			richNestedFile({ fromPattern: { goal: true, claim: true } })
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.name).toBe("File case name");
		expect(await storedCase(body.id)).toMatchObject({
			kind: "CASE",
			sourcePatternId: null,
			createdById: user.id,
		});
		const marked = (await patternFlags(body.id)).filter(
			(row) => row.fromPattern
		);
		expect(marked.map((row) => row.name).sort()).toEqual(["G1", "P1"]);
	});

	it.each(
		FILE_FORMATS
	)("ignores every attempt in a %s file to set the source, mark the elements, or rename the case", async (_format, build) => {
		const user = await createTestUser();
		const pattern = await createStoredPattern(user.id);
		const planted = { sourcePatternId: pattern.id };

		const response = await send(
			user,
			build({
				caseFields: planted,
				everyElement: planted,
				topLevel: {
					...planted,
					kind: "PATTERN",
					markFromPattern: true,
					name: "Hijacked name",
					description: "Hijacked description",
					options: {
						...planted,
						kind: "PATTERN",
						markFromPattern: true,
						name: "Hijacked name",
					},
				},
			})
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.name).toBe("File case name");
		expect(await storedCase(body.id)).toMatchObject({
			kind: "CASE",
			sourcePatternId: null,
			name: "File case name",
			description: "File case description",
		});
		expect((await patternFlags(body.id)).some((row) => row.fromPattern)).toBe(
			false
		);
	});

	it("makes a pattern the user owns from a file whose case says PATTERN, and keeps it out of My Assurance Cases", async () => {
		const user = await createTestUser();

		const response = await send(
			user,
			richNestedFile({ version: "1.1", caseFields: { kind: "PATTERN" } })
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.elementCount).toBe(RICH_ELEMENT_COUNT);
		expect(await storedCase(body.id)).toMatchObject({
			kind: "PATTERN",
			sourcePatternId: null,
			createdById: user.id,
		});
		const listed = expectSuccess(await listUserCases(user.id));
		expect(listed.map((row) => row.id)).not.toContain(body.id);
	});

	it("refuses a version 1.0 file that says PATTERN with a 400 and creates nothing", async () => {
		const user = await createTestUser();

		const response = await send(
			user,
			richNestedFile({ version: "1.0", caseFields: { kind: "PATTERN" } })
		);

		expect(response.status).toBe(400);
		expect(await prisma.assuranceCase.count()).toBe(0);
		expect(await prisma.assuranceElement.count()).toBe(0);
	});

	it("refuses a file with an invalid kind with a 400 and creates nothing", async () => {
		const user = await createTestUser();

		for (const kind of ["TEMPLATE", "pattern", null, 1]) {
			const response = await send(
				user,
				richNestedFile({ caseFields: { kind } })
			);

			expect(response.status).toBe(400);
		}

		expect(await prisma.assuranceCase.count()).toBe(0);
		expect(await prisma.assuranceElement.count()).toBe(0);
	});

	it("clears the references to a case the user cannot view and names them in the warnings, and keeps the references to a case they can view", async () => {
		const user = await createTestUser();
		const author = await createTestUser();
		const hidden = await createStoredCase(author.id);
		const shared = await createStoredCase(author.id);
		await createTestPermission(shared.id, user.id, author.id);
		const referencesOf = (caseId: string) =>
			prisma.assuranceElement.findMany({
				where: { caseId, elementType: { in: ["AWAY_GOAL", "MODULE"] } },
				select: { moduleReferenceId: true, moduleReferenceDangling: true },
			});

		const hiddenResponse = await send(
			user,
			richNestedFile({ citedCaseId: hidden.id })
		);
		const sharedResponse = await send(
			user,
			richNestedFile({ citedCaseId: shared.id })
		);

		expect(hiddenResponse.status).toBe(200);
		expect(sharedResponse.status).toBe(200);
		const clearedBody = await hiddenResponse.json();
		const keptBody = await sharedResponse.json();
		expect(await referencesOf(clearedBody.id)).toEqual([
			{ moduleReferenceId: null, moduleReferenceDangling: true },
			{ moduleReferenceId: null, moduleReferenceDangling: true },
		]);
		expect(
			clearedBody.warnings.filter((message: string) =>
				message.endsWith("the reference has been cleared")
			)
		).toHaveLength(2);
		expect(await referencesOf(keptBody.id)).toEqual([
			{ moduleReferenceId: shared.id, moduleReferenceDangling: false },
			{ moduleReferenceId: shared.id, moduleReferenceDangling: false },
		]);
		expect(keptBody.warnings).toEqual([]);
	});
});

describe("PUT /api/cases/import", () => {
	it("validates a pattern file and refuses an invalid kind or a pattern in a 1.0 file, creating nothing either way", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);
		const { PUT } = await import("@/app/api/cases/import/route");
		const send = (file: unknown) =>
			PUT(
				new NextRequest("http://localhost:3000/api/cases/import", {
					method: "PUT",
					body: JSON.stringify(file),
				})
			);

		const valid = await send(
			richNestedFile({ version: "1.1", caseFields: { kind: "PATTERN" } })
		);
		const oldVersion = await send(
			richNestedFile({ version: "1.0", caseFields: { kind: "PATTERN" } })
		);
		const invalid = await send(
			richNestedFile({ caseFields: { kind: "TEMPLATE" } })
		);

		expect(valid.status).toBe(200);
		expect((await valid.json()).isValid).toBe(true);
		expect(oldVersion.status).toBe(400);
		expect(
			(await oldVersion.json()).errors.some((message: string) =>
				message.startsWith("case.kind")
			)
		).toBe(true);
		expect(invalid.status).toBe(400);
		const refused = await invalid.json();
		expect(refused.isValid).toBe(false);
		expect(
			refused.errors.some((message: string) => message.startsWith("case.kind"))
		).toBe(true);
		expect(await prisma.assuranceCase.count()).toBe(0);
	});
});

describe("GET /api/cases/export", () => {
	async function exportThrough(user: User, caseId: string) {
		await mockAuth(user.id, user.username, user.email);
		const { GET } = await import("@/app/api/cases/export/route");
		const response = await GET(
			new Request(`http://localhost:3000/api/cases/export?id=${caseId}`)
		);
		return { response, text: await response.text() };
	}

	async function withGoal(user: User, kind: "CASE" | "PATTERN") {
		const made =
			kind === "PATTERN"
				? await createStoredPattern(user.id)
				: await createStoredCase(user.id);
		await prisma.assuranceElement.create({
			data: {
				caseId: made.id,
				createdById: user.id,
				elementType: "GOAL",
				role: "TOP_LEVEL",
				name: "G1",
				description: "The goal",
			},
		});
		return made;
	}

	it("downloads an ordinary case as a 1.0 file with no kind key", async () => {
		const user = await createTestUser();
		const made = await withGoal(user, "CASE");

		const { response, text } = await exportThrough(user, made.id);

		expect(response.status).toBe(200);
		const file = JSON.parse(text);
		expect(file.version).toBe("1.0");
		expect(Object.keys(file.case)).toEqual(["name", "description"]);
		expect(text).not.toContain('"kind"');
	});

	it("downloads a pattern as a 1.1 file that says PATTERN", async () => {
		const user = await createTestUser();
		const made = await withGoal(user, "PATTERN");

		const { response, text } = await exportThrough(user, made.id);

		expect(response.status).toBe(200);
		const file = JSON.parse(text);
		expect(file.version).toBe("1.1");
		expect(file.case.kind).toBe("PATTERN");
	});
});

describe("the case routes", () => {
	async function putCase(user: User, caseId: string, body: unknown) {
		await mockAuth(user.id, user.username, user.email);
		const { PUT } = await import("@/app/api/cases/[id]/route");
		return PUT(
			new NextRequest(`http://localhost:3000/api/cases/${caseId}`, {
				method: "PUT",
				body: JSON.stringify(body),
				headers: { "Content-Type": "application/json" },
			}),
			{ params: Promise.resolve({ id: caseId }) }
		);
	}

	it("refuse an update that names a kind or a source pattern, and change nothing", async () => {
		const user = await createTestUser();
		const ordinary = await createStoredCase(user.id, "Ordinary");
		const pattern = await createStoredPattern(user.id, "Pattern");

		for (const body of [
			{ kind: "PATTERN" },
			{ name: "Renamed", kind: "PATTERN" },
			{ sourcePatternId: pattern.id },
		]) {
			expect((await putCase(user, ordinary.id, body)).status).toBe(400);
		}
		expect((await putCase(user, pattern.id, { kind: "CASE" })).status).toBe(
			400
		);

		expect(await storedCase(ordinary.id)).toMatchObject({
			kind: "CASE",
			name: "Ordinary",
			sourcePatternId: null,
		});
		expect((await storedCase(pattern.id)).kind).toBe("PATTERN");
	});

	it("keeps the kind through an ordinary rename", async () => {
		const user = await createTestUser();
		const pattern = await createStoredPattern(user.id, "Pattern");

		const response = await putCase(user, pattern.id, { name: "Renamed" });

		expect(response.status).toBe(200);
		expect((await response.json()).kind).toBe("PATTERN");
		expect(await storedCase(pattern.id)).toMatchObject({
			kind: "PATTERN",
			name: "Renamed",
		});
	});

	it("report the kind when a case is fetched", async () => {
		const user = await createTestUser();
		const ordinary = await createStoredCase(user.id);
		const pattern = await createStoredPattern(user.id);
		await mockAuth(user.id, user.username, user.email);
		const { GET } = await import("@/app/api/cases/[id]/route");
		const fetchKind = async (caseId: string) => {
			const response = await GET(
				new NextRequest(`http://localhost:3000/api/cases/${caseId}`),
				{ params: Promise.resolve({ id: caseId }) }
			);
			return (await response.json()).kind;
		};

		expect(await fetchKind(ordinary.id)).toBe("CASE");
		expect(await fetchKind(pattern.id)).toBe("PATTERN");
	});
});

describe("the demo account seed", () => {
	const VALUES: DemoAccountValues = {
		password: "Demo-account-test-1!", // pragma: allowlist secret
		openRouterKey: "test-openrouter-key",
		pipelineToken: `teap_${"a1B2c3D4e5".repeat(4)}-_x`,
	};

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("makes only ordinary, unlinked cases, none of them marked as coming from a pattern, and lists every one", async () => {
		vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));

		await seedDemoAccount(VALUES);

		const seeded = await prisma.assuranceCase.findMany({
			select: {
				id: true,
				kind: true,
				sourcePatternId: true,
				createdById: true,
			},
		});
		expect(seeded).toHaveLength(DEMO_FIXTURES.length);
		expect(seeded.every((row) => row.kind === "CASE")).toBe(true);
		expect(seeded.every((row) => row.sourcePatternId === null)).toBe(true);
		expect(
			await prisma.assuranceElement.count({ where: { fromPattern: true } })
		).toBe(0);
		const owner = seeded[0]?.createdById ?? "";
		const listed = expectSuccess(await listUserCases(owner));
		expect(listed.map((row) => row.id).sort()).toEqual(
			seeded.map((row) => row.id).sort()
		);
	});

	it("keeps the fixed case ids the fixtures name", async () => {
		vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));

		await seedDemoAccount(VALUES);

		const ids = (await prisma.assuranceCase.findMany({ select: { id: true } }))
			.map((row) => row.id)
			.sort();
		expect(ids).toEqual(DEMO_FIXTURES.map((fixture) => fixture.caseId).sort());
	});
});
