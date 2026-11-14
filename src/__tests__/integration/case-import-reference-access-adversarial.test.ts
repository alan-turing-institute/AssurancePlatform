import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { importCase } from "@/lib/services/case-import-service";
import {
	DEMO_FIXTURES,
	type DemoAccountValues,
	seedDemoAccount,
} from "../../../prisma/seed/demo-account-seed";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createStoredCase, richNestedFile } from "../utils/case-kind-kit";
import { referencesOf } from "../utils/pattern-start-kit";
import {
	addTeamMember,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * A case brought in by import keeps a reference to another case only when
 * the user importing it can view that case. A reference to a case they
 * cannot view, to a case in the trash and to a case that does not exist is
 * cleared in the same way: the element is flagged dangling and the import
 * says so, in the same words for each. This holds for every way in: the file,
 * Google Drive and GitHub routes, the import service and the demo seed.
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

interface Imported {
	caseId: string;
	warnings: string[];
}

interface Importer {
	label: string;
	run: (user: User, file: unknown) => Promise<Imported>;
}

async function fromResponse(response: Response): Promise<Imported> {
	if (response.status !== 200) {
		throw new Error(`import refused with ${response.status}`);
	}
	const body = await response.json();
	return { caseId: body.id, warnings: body.warnings };
}

const IMPORTERS: Importer[] = [
	{
		label: "POST /api/cases/import",
		run: async (user, file) => {
			await mockAuth(user.id, user.username, user.email ?? undefined);
			const { POST } = await import("@/app/api/cases/import/route");
			return fromResponse(
				await POST(
					new NextRequest("http://localhost:3000/api/cases/import", {
						method: "POST",
						body: JSON.stringify(file),
					})
				)
			);
		},
	},
	{
		label: "POST /api/cases/import/gdrive",
		run: async (user, file) => {
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
			await mockAuth(user.id, user.username, user.email ?? undefined);
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
			return fromResponse(
				await POST(
					new NextRequest("http://localhost:3000/api/cases/import/gdrive", {
						method: "POST",
						body: JSON.stringify({ fileId: "file-id" }),
						headers: { "Content-Type": "application/json" },
					})
				)
			);
		},
	},
	{
		label: "POST /api/cases/import/github",
		run: async (user, file) => {
			await mockAuth(user.id, user.username, user.email ?? undefined);
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
			return fromResponse(
				await POST(
					new NextRequest("http://localhost:3000/api/cases/import/github", {
						method: "POST",
						body: JSON.stringify({ url: "owner/repo/case.json" }),
						headers: { "Content-Type": "application/json" },
					})
				)
			);
		},
	},
	{
		label: "importCase",
		run: async (user, file) => {
			const result = await importCase(user.id, file);
			if (!("data" in result)) {
				throw new Error(`import failed: ${result.error}`);
			}
			return { caseId: result.data.caseId, warnings: result.data.warnings };
		},
	},
];

const CLEARED_AWAY_GOAL =
	"AG1: cited case not available in this environment; the reference has been cleared";
const CLEARED_MODULE =
	"M1: cited case not available in this environment; the reference has been cleared";
const CLEARED_ELEMENT =
	"AG1: cited element not found; the reference has been cleared";

const trash = (caseId: string) =>
	prisma.assuranceCase.update({
		where: { id: caseId },
		data: { deletedAt: new Date() },
	});

/** A target case for the references, and who may view it. */
interface Target {
	label: string;
	/** Makes the target and returns its id. */
	make: (owner: User, importer: User) => Promise<string>;
	viewable: boolean;
}

const level = (permission: "VIEW" | "COMMENT" | "EDIT" | "ADMIN"): Target => ({
	label: `a case shared with the importer at ${permission}`,
	viewable: true,
	make: async (owner, importer) => {
		const made = await createStoredCase(owner.id);
		await createTestPermission(made.id, importer.id, owner.id, permission);
		return made.id;
	},
});

const TARGETS: Target[] = [
	{
		label: "a case the importer owns",
		viewable: true,
		make: async (_owner, importer) => (await createStoredCase(importer.id)).id,
	},
	level("VIEW"),
	level("COMMENT"),
	level("EDIT"),
	level("ADMIN"),
	...(["MEMBER", "ADMIN"] as const).map(
		(role): Target => ({
			label: `a case shared with a team the importer is a ${role} of`,
			viewable: true,
			make: async (owner, importer) => {
				const lead = await createTestUser();
				const team = await createTestTeam(lead.id);
				await addTeamMember(team.id, importer.id, role);
				const made = await createStoredCase(owner.id);
				await createTestTeamPermission(made.id, team.id, owner.id, "VIEW");
				return made.id;
			},
		})
	),
	{
		label: "a case the importer can not view",
		viewable: false,
		make: async (owner) => (await createStoredCase(owner.id)).id,
	},
	{
		label: "a case shared only with a team the importer is not in",
		viewable: false,
		make: async (owner) => {
			const team = await createTestTeam(owner.id);
			const made = await createStoredCase(owner.id);
			await createTestTeamPermission(made.id, team.id, owner.id, "ADMIN");
			return made.id;
		},
	},
	{
		label: "a case the importer owns that is in the trash",
		viewable: false,
		make: async (_owner, importer) => {
			const made = await createStoredCase(importer.id);
			await trash(made.id);
			return made.id;
		},
	},
	{
		label: "a case shared with the importer that is in the trash",
		viewable: false,
		make: async (owner, importer) => {
			const made = await createStoredCase(owner.id);
			await createTestPermission(made.id, importer.id, owner.id, "ADMIN");
			await trash(made.id);
			return made.id;
		},
	},
	{
		label: "a case id that does not exist",
		viewable: false,
		make: async () => randomUUID(),
	},
];

describe.each(
	IMPORTERS
)("references in a case imported through $label", (importer) => {
	it.each(TARGETS)("handles an away goal and a module citing $label", async ({
		make,
		viewable,
	}) => {
		const owner = await createTestUser();
		const user = await createTestUser();
		const target = await make(owner, user);

		const imported = await importer.run(
			user,
			richNestedFile({ citedCaseId: target })
		);

		const away = await referencesOf(imported.caseId, "AG1");
		const module = await referencesOf(imported.caseId, "M1");
		if (viewable) {
			expect(away).toMatchObject({
				moduleReferenceId: target,
				moduleReferenceDangling: false,
			});
			expect(module).toMatchObject({
				moduleReferenceId: target,
				moduleReferenceDangling: false,
			});
			expect(imported.warnings).toEqual([]);
		} else {
			expect(away).toMatchObject({
				moduleReferenceId: null,
				moduleReferenceDangling: true,
			});
			expect(module).toMatchObject({
				moduleReferenceId: null,
				moduleReferenceDangling: true,
			});
			expect([...imported.warnings].sort()).toEqual(
				[CLEARED_AWAY_GOAL, CLEARED_MODULE].sort()
			);
		}
	});

	it("answers the same for a case the importer cannot view, a trashed case and a case that does not exist", async () => {
		const owner = await createTestUser();
		const user = await createTestUser();
		const answers: unknown[] = [];

		for (const target of TARGETS.filter((candidate) => !candidate.viewable)) {
			const id = await target.make(owner, user);
			const imported = await importer.run(
				user,
				richNestedFile({ citedCaseId: id })
			);
			answers.push({
				away: await referencesOf(imported.caseId, "AG1"),
				module: await referencesOf(imported.caseId, "M1"),
				warnings: [...imported.warnings].sort(),
			});
		}

		expect(answers.length).toBeGreaterThan(1);
		for (const answer of answers) {
			expect(answer).toEqual(answers[0]);
		}
	});

	it("keeps and clears references independently in one file", async () => {
		const owner = await createTestUser();
		const user = await createTestUser();
		const kept = await createStoredCase(owner.id);
		await createTestPermission(kept.id, user.id, owner.id, "VIEW");
		const hidden = await createStoredCase(owner.id);
		const file = richNestedFile({ citedCaseId: kept.id }) as {
			tree: {
				children: {
					children: { name: string; moduleReferenceId?: string }[];
				}[];
			};
		};
		const strategy = file.tree.children[0];
		const module = strategy?.children.find((child) => child.name === "M1");
		if (!module) {
			throw new Error("rich file has no module");
		}
		module.moduleReferenceId = hidden.id;

		const imported = await importer.run(user, file);

		expect(await referencesOf(imported.caseId, "AG1")).toMatchObject({
			moduleReferenceId: kept.id,
			moduleReferenceDangling: false,
		});
		expect(await referencesOf(imported.caseId, "M1")).toMatchObject({
			moduleReferenceId: null,
			moduleReferenceDangling: true,
		});
		expect(imported.warnings).toEqual([CLEARED_MODULE]);
	});
});

/** A nested file holding one away goal that cites an element of another case. */
function citingFile(citedCaseId: string, citedElementId: string) {
	return {
		version: "1.0",
		exportedAt: new Date().toISOString(),
		case: { name: "Citing case", description: "A case that cites another" },
		tree: {
			id: "40000000-0000-4000-8000-000000000001",
			type: "GOAL",
			name: "G1",
			description: "The goal",
			role: "TOP_LEVEL",
			inSandbox: false,
			children: [
				{
					id: "40000000-0000-4000-8000-000000000002",
					type: "STRATEGY",
					name: "S1",
					description: "The strategy",
					inSandbox: false,
					children: [
						{
							id: "40000000-0000-4000-8000-000000000003",
							type: "AWAY_GOAL",
							name: "AG1",
							description: "An away goal citing an element",
							inSandbox: false,
							moduleReferenceId: citedCaseId,
							citedElementId,
							children: [],
						},
					],
				},
			],
		},
	};
}

describe.each(
	IMPORTERS
)("cited elements in a case imported through $label", (importer) => {
	/** A case owned by `ownerId` holding one element, whose id is returned with the case's. */
	async function caseWithElement(ownerId: string) {
		const made = await createStoredCase(ownerId);
		const element = await createTestElement(made.id, ownerId, { name: "G1" });
		return { caseId: made.id, elementId: element.id };
	}

	it("keeps a cited element inside a case the importer can view", async () => {
		const owner = await createTestUser();
		const user = await createTestUser();
		const cited = await caseWithElement(owner.id);
		await createTestPermission(cited.caseId, user.id, owner.id, "VIEW");

		const imported = await importer.run(
			user,
			citingFile(cited.caseId, cited.elementId)
		);

		expect(await referencesOf(imported.caseId, "AG1")).toEqual({
			moduleReferenceId: cited.caseId,
			moduleReferenceDangling: false,
			citedElementId: cited.elementId,
			citationDangling: false,
		});
		expect(imported.warnings).toEqual([]);
	});

	it("clears a cited element inside a case the importer cannot view, flags it, and says so once", async () => {
		const owner = await createTestUser();
		const user = await createTestUser();
		const cited = await caseWithElement(owner.id);

		const imported = await importer.run(
			user,
			citingFile(cited.caseId, cited.elementId)
		);

		expect(await referencesOf(imported.caseId, "AG1")).toEqual({
			moduleReferenceId: null,
			moduleReferenceDangling: true,
			citedElementId: null,
			citationDangling: true,
		});
		expect(imported.warnings).toEqual([CLEARED_AWAY_GOAL]);
	});

	it("clears a cited element inside a trashed case the importer owns", async () => {
		const user = await createTestUser();
		const cited = await caseWithElement(user.id);
		await trash(cited.caseId);

		const imported = await importer.run(
			user,
			citingFile(cited.caseId, cited.elementId)
		);

		expect(await referencesOf(imported.caseId, "AG1")).toEqual({
			moduleReferenceId: null,
			moduleReferenceDangling: true,
			citedElementId: null,
			citationDangling: true,
		});
	});

	it("clears an element of a case the importer cannot view even when the case it names is one they can", async () => {
		const owner = await createTestUser();
		const user = await createTestUser();
		const visible = await caseWithElement(owner.id);
		await createTestPermission(visible.caseId, user.id, owner.id, "VIEW");
		const hidden = await caseWithElement(owner.id);

		const imported = await importer.run(
			user,
			citingFile(visible.caseId, hidden.elementId)
		);

		expect(await referencesOf(imported.caseId, "AG1")).toEqual({
			moduleReferenceId: visible.caseId,
			moduleReferenceDangling: false,
			citedElementId: null,
			citationDangling: true,
		});
		expect(imported.warnings).toEqual([CLEARED_ELEMENT]);
	});
});

describe("the demo account seed", () => {
	const VALUES: DemoAccountValues = {
		password: "Demo-account-test-1!", // pragma: allowlist secret
		openRouterKey: "test-openrouter-key",
		pipelineToken: `teap_${"a1B2c3D4e5".repeat(4)}-_x`,
	};
	let directory: string;

	beforeEach(() => {
		directory = mkdtempSync(join(tmpdir(), "seed-reference-"));
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(directory, { recursive: true, force: true });
	});

	function fixtureCiting(
		citedCaseId: string,
		ids: { goal: string; strategy: string; away: string }
	) {
		const file = citingFile(citedCaseId, randomUUID()) as {
			tree: {
				id: string;
				children: {
					id: string;
					children: { id: string; citedElementId?: string }[];
				}[];
			};
		};
		file.tree.id = ids.goal;
		const [strategy] = file.tree.children;
		if (!strategy) {
			throw new Error("no strategy");
		}
		strategy.id = ids.strategy;
		const [away] = strategy.children;
		if (!away) {
			throw new Error("no away goal");
		}
		away.id = ids.away;
		away.citedElementId = undefined;
		const path = join(directory, `${ids.goal}.json`);
		writeFileSync(path, JSON.stringify(file));
		return path;
	}

	it("keeps a reference to a case it seeded and clears one to another user's case", async () => {
		vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
		const bluebird = DEMO_FIXTURES[0];
		if (!bluebird) {
			throw new Error("no Bluebird fixture");
		}
		const stranger = await createTestUser();
		const private_ = await createStoredCase(stranger.id);
		const toSeeded = {
			file: fixtureCiting(bluebird.caseId, {
				goal: randomUUID(),
				strategy: randomUUID(),
				away: randomUUID(),
			}),
			caseId: randomUUID(),
		};
		const toPrivate = {
			file: fixtureCiting(private_.id, {
				goal: randomUUID(),
				strategy: randomUUID(),
				away: randomUUID(),
			}),
			caseId: randomUUID(),
		};

		await seedDemoAccount(VALUES, [bluebird, toSeeded, toPrivate]);

		expect(await referencesOf(toSeeded.caseId, "AG1")).toMatchObject({
			moduleReferenceId: bluebird.caseId,
			moduleReferenceDangling: false,
		});
		expect(await referencesOf(toPrivate.caseId, "AG1")).toMatchObject({
			moduleReferenceId: null,
			moduleReferenceDangling: true,
		});
	});

	it("seeds the committed cases with every reference they hold kept", async () => {
		vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));

		await seedDemoAccount(VALUES);

		expect(
			await prisma.assuranceElement.count({
				where: {
					OR: [{ moduleReferenceDangling: true }, { citationDangling: true }],
				},
			})
		).toBe(0);
		expect(await prisma.assuranceCase.count()).toBe(DEMO_FIXTURES.length);
	});
});
