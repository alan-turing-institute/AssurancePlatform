import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createNestedCaseJSON,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Route-level coverage for named context entries on every case import route:
 * POST /api/cases/import (a 1.0 file, a 1.1 file, and a "1.0" file holding a
 * named entry), and the GitHub and Google Drive imports, which hand the file
 * to the same import service. The import row builder writes context as it
 * finds it, so the checks that matter are made explicitly before it runs.
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

const WINDOW = {
	id: "k3f9x2m7qa",
	name: "window",
	text: "the interval over which separation is measured",
	value: "5 minutes",
};
const RANGE = {
	id: "p4n8c2d6xz",
	name: "range",
	text: "how far ahead we look",
};
const GOAL_ID = "00000000-0000-4000-8000-000000000001";
const CLAIM_ID = "00000000-0000-4000-8000-000000000002";

beforeEach(async () => {
	await mockNoAuth();
	vi.clearAllMocks();
	mockDrive.mockReturnValue({
		files: { list: vi.fn(), create: vi.fn(), get: mockFilesGet },
	});
});

/** A nested case file: a goal holding `goalContext` with one claim holding `claimContext`. */
function caseFile(
	version: string,
	goalContext: unknown[],
	claimContext: unknown[] = []
) {
	return createNestedCaseJSON({
		version,
		tree: {
			id: GOAL_ID,
			type: "GOAL",
			name: "G1",
			description: "The root goal",
			inSandbox: false,
			role: "TOP_LEVEL",
			context: goalContext,
			children: [
				{
					id: CLAIM_ID,
					type: "PROPERTY_CLAIM",
					name: "P1",
					description: `Separation holds within the {window#${WINDOW.id}}.`,
					inSandbox: false,
					context: claimContext,
					children: [],
				},
			],
		},
	});
}

function postImport(body: unknown) {
	return new NextRequest("http://localhost:3000/api/cases/import", {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
	});
}

async function importViaRoute(file: unknown) {
	const { POST } = await import("@/app/api/cases/import/route");
	const response = await POST(postImport(file));
	return { response, body: await response.json() };
}

async function storedContexts(caseId: string): Promise<unknown[]> {
	const rows = await prisma.assuranceElement.findMany({
		where: { caseId },
		orderBy: { name: "asc" },
		select: { name: true, context: true },
	});
	return rows.map((row) => row.context);
}

describe("POST /api/cases/import — named context entries", () => {
	it("imports a 1.0 file of plain-text context as it always did", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { response, body } = await importViaRoute(
			caseFile("1.0", ["plain one", "plain two"])
		);

		expect(response.status).toBe(200);
		expect(await storedContexts(body.id)).toEqual([
			["plain one", "plain two"],
			[],
		]);
	});

	it("imports a 1.1 file with named entries and keeps their ids and the references to them", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { response, body } = await importViaRoute(
			caseFile("1.1", ["plain", WINDOW], [RANGE])
		);

		expect(response.status).toBe(200);
		expect(await storedContexts(body.id)).toEqual([["plain", WINDOW], [RANGE]]);
		const claim = await prisma.assuranceElement.findFirst({
			where: { caseId: body.id, name: "P1" },
		});
		expect(claim?.description).toBe(
			`Separation holds within the {window#${WINDOW.id}}.`
		);
	});

	it("rejects a file that says 1.0 but holds a named entry, saying how to fix it", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { response, body } = await importViaRoute(caseFile("1.0", [WINDOW]));

		expect(response.status).toBe(400);
		expect(body.validationErrors).toEqual([
			'tree.context.0: A version "1.0" file cannot hold named context entries; set the version to "1.1"',
		]);
		expect(await prisma.assuranceCase.count()).toBe(0);
	});

	it("rejects a 1.1 file whose named entry has a bad name, naming the rule", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { response, body } = await importViaRoute(
			caseFile("1.1", [{ ...WINDOW, name: "1st window" }])
		);

		expect(response.status).toBe(400);
		expect(body.validationErrors[0]).toContain(
			"Context entry names must start with a letter"
		);
	});

	it("rejects a 1.1 file whose entry has a key it should not have", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { response, body } = await importViaRoute(
			caseFile("1.1", [{ ...WINDOW, hidden: false }])
		);

		expect(response.status).toBe(400);
		expect(body.validationErrors[0]).toContain('Unrecognized key: "hidden"');
	});

	it("rejects two names that differ only in case on one element", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { response, body } = await importViaRoute(
			caseFile("1.1", [WINDOW, { ...RANGE, name: "WINDOW" }])
		);

		expect(response.status).toBe(400);
		expect(body.validationErrors).toEqual([
			'Context entry names must be unique within an element, ignoring case: "window" and "WINDOW" both appear',
		]);
	});

	it("rejects an id used on two elements of the file", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { response, body } = await importViaRoute(
			caseFile("1.1", [WINDOW], [{ ...RANGE, id: WINDOW.id }])
		);

		expect(response.status).toBe(400);
		expect(body.validationErrors).toEqual([
			`Context entry id "${WINDOW.id}" is used by more than one entry in this case`,
		]);
		expect(await prisma.assuranceCase.count()).toBe(0);
	});

	it("lets the same file be imported twice, as two cases with the same entry ids", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);
		const file = caseFile("1.1", [WINDOW]);

		const first = await importViaRoute(file);
		const second = await importViaRoute(file);

		expect(first.response.status).toBe(200);
		expect(second.response.status).toBe(200);
	});
});

describe("POST /api/cases/import/gdrive — named context entries", () => {
	function setGoogleTokens(userId: string) {
		return prisma.user.update({
			where: { id: userId },
			data: {
				googleAccessToken: "test-access-token",
				googleRefreshToken: "test-refresh-token",
				googleTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
				googleId: "google-test-id",
				googleEmail: "googleuser@example.com",
			},
		});
	}

	async function importFromDrive(file: unknown) {
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
		const response = await POST(
			new NextRequest("http://localhost:3000/api/cases/import/gdrive", {
				method: "POST",
				body: JSON.stringify({ fileId: "file-id" }),
				headers: { "Content-Type": "application/json" },
			})
		);
		return { response, body: await response.json() };
	}

	it("imports a 1.1 backup that holds a named entry", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		await mockAuth(user.id, user.username, user.email);

		const { response, body } = await importFromDrive(
			caseFile("1.1", ["plain", WINDOW])
		);

		expect(response.status).toBe(200);
		expect((await storedContexts(body.id))[0]).toEqual(["plain", WINDOW]);
	});

	it("rejects a backup that says 1.0 but holds a named entry, with a readable message", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		await mockAuth(user.id, user.username, user.email);

		const { response, body } = await importFromDrive(caseFile("1.0", [WINDOW]));

		expect(response.status).toBe(400);
		expect(body.validationErrors).toEqual([
			'tree.context.0: A version "1.0" file cannot hold named context entries; set the version to "1.1"',
		]);
	});

	it("rejects a backup that repeats an entry id", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		await mockAuth(user.id, user.username, user.email);

		const { response, body } = await importFromDrive(
			caseFile("1.1", [WINDOW], [{ ...RANGE, id: WINDOW.id }])
		);

		expect(response.status).toBe(400);
		expect(body.validationErrors[0]).toContain(
			`Context entry id "${WINDOW.id}" is used by more than one entry in this case`
		);
	});
});

describe("POST /api/cases/import/github — named context entries", () => {
	async function importFromGitHub(file: unknown) {
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
		const response = await POST(
			new NextRequest("http://localhost:3000/api/cases/import/github", {
				method: "POST",
				body: JSON.stringify({ url: "owner/repo/case.json" }),
				headers: { "Content-Type": "application/json" },
			})
		);
		return { response, body: await response.json() };
	}

	it("imports a 1.1 file that holds a named entry", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { response, body } = await importFromGitHub(
			caseFile("1.1", ["plain", WINDOW])
		);

		expect(response.status).toBe(200);
		expect((await storedContexts(body.id))[0]).toEqual(["plain", WINDOW]);
	});

	it("rejects a file that says 1.0 but holds a named entry, with a readable message", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { response, body } = await importFromGitHub(
			caseFile("1.0", [WINDOW])
		);

		expect(response.status).toBe(400);
		expect(body.validationErrors).toEqual([
			'tree.context.0: A version "1.0" file cannot hold named context entries; set the version to "1.1"',
		]);
	});

	it("rejects a file that repeats a name on one element", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { response, body } = await importFromGitHub(
			caseFile("1.1", [WINDOW, { ...RANGE, name: "Window" }])
		);

		expect(response.status).toBe(400);
		expect(body.validationErrors[0]).toContain(
			"Context entry names must be unique within an element, ignoring case"
		);
	});
});
