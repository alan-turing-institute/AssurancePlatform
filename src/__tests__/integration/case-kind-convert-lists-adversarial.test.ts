import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	listSharedCases,
	listUserCases,
} from "@/lib/services/case-fetch-service";
import { listUserPatterns } from "@/lib/services/case-kind-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createRichCase } from "../utils/case-kind-convert-kit";
import {
	addTeamMember,
	createTestCase,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * The lists a conversion moves a case between: My Patterns holds a user's own
 * and directly shared patterns, My Assurance Cases never holds one, and
 * Shared With Me and Trash show patterns marked as patterns.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/navigation")>()),
	redirect: vi.fn((url: string) => {
		throw new Error(`redirected to ${url}`);
	}),
}));

beforeEach(async () => {
	await mockNoAuth();
});

type User = Awaited<ReturnType<typeof createTestUser>>;

function idsOf(result: { data: { id: string }[] } | { error: string }) {
	if (!("data" in result)) {
		throw new Error(`list failed: ${result.error}`);
	}
	return result.data.map((item) => item.id);
}

async function trash(caseId: string, userId: string) {
	await prisma.assuranceCase.update({
		where: { id: caseId },
		data: { deletedAt: new Date(), deletedById: userId },
	});
}

async function convertAs(user: User, caseId: string, target: unknown) {
	await mockAuth(user.id, user.username, user.email);
	const { convertCaseKind } = await import("@/actions/case-kind");
	return convertCaseKind(caseId, target as "CASE" | "PATTERN");
}

/** Every React element in a rendered page that `match` accepts. */
function findElements(
	node: ReactNode,
	match: (element: ReactElement) => boolean
): ReactElement[] {
	if (Array.isArray(node)) {
		return node.flatMap((child) => findElements(child, match));
	}
	if (node === null || typeof node !== "object" || !("props" in node)) {
		return [];
	}
	const element = node as ReactElement<{ children?: ReactNode }>;
	const found = match(element) ? [element] : [];
	return [...found, ...findElements(element.props.children, match)];
}

describe("listUserPatterns", () => {
	it("lists the patterns a user owns and never an ordinary case", async () => {
		const user = await createTestUser();
		const pattern = await createTestCase(user.id, { kind: "PATTERN" });
		await createTestCase(user.id, { kind: "CASE" });

		const result = await listUserPatterns(user.id);

		expect(idsOf(result)).toEqual([pattern.id]);
		expect(result).toMatchObject({
			data: [{ id: pattern.id, kind: "PATTERN", permissions: "owner" }],
		});
	});

	it.each([
		"VIEW",
		"COMMENT",
		"EDIT",
		"ADMIN",
	] as const)("lists a pattern shared directly at %s, not as owned", async (level) => {
		const owner = await createTestUser();
		const guest = await createTestUser();
		const pattern = await createTestCase(owner.id, { kind: "PATTERN" });
		await createTestPermission(pattern.id, guest.id, owner.id, level);

		const result = await listUserPatterns(guest.id);

		expect(idsOf(result)).toEqual([pattern.id]);
		expect(result).toMatchObject({
			data: [{ kind: "PATTERN", owner: owner.id }],
		});
		expect(
			(result as { data: { permissions: string }[] }).data[0]?.permissions
		).not.toBe("owner");
	});

	it("does not list an ordinary case shared directly", async () => {
		const owner = await createTestUser();
		const guest = await createTestUser();
		const shared = await createTestCase(owner.id, { kind: "CASE" });
		await createTestPermission(shared.id, guest.id, owner.id, "ADMIN");

		expect(idsOf(await listUserPatterns(guest.id))).toEqual([]);
	});

	it("does not list a pattern shared only through a team", async () => {
		const owner = await createTestUser();
		const member = await createTestUser();
		const pattern = await createTestCase(owner.id, { kind: "PATTERN" });
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, member.id);
		await createTestTeamPermission(pattern.id, team.id, owner.id, "ADMIN");

		expect(idsOf(await listUserPatterns(member.id))).toEqual([]);
		expect(idsOf(await listSharedCases(member.id))).toEqual([pattern.id]);
	});

	it("does not list a pattern that belongs to someone else and is not shared", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		await createTestCase(owner.id, { kind: "PATTERN" });

		expect(idsOf(await listUserPatterns(stranger.id))).toEqual([]);
	});

	it("does not list a pattern in Trash, owned or shared", async () => {
		const owner = await createTestUser();
		const guest = await createTestUser();
		const owned = await createTestCase(owner.id, { kind: "PATTERN" });
		const shared = await createTestCase(owner.id, { kind: "PATTERN" });
		await createTestPermission(shared.id, guest.id, owner.id, "VIEW");
		await trash(owned.id, owner.id);
		await trash(shared.id, owner.id);

		expect(idsOf(await listUserPatterns(owner.id))).toEqual([]);
		expect(idsOf(await listUserPatterns(guest.id))).toEqual([]);
	});

	it("lists a pattern once however it is shared", async () => {
		const owner = await createTestUser();
		const pattern = await createTestCase(owner.id, { kind: "PATTERN" });
		const helper = await createTestUser();
		await createTestPermission(pattern.id, helper.id, owner.id, "VIEW");
		await createTestPermission(pattern.id, owner.id, owner.id, "ADMIN");

		expect(idsOf(await listUserPatterns(owner.id))).toEqual([pattern.id]);
	});

	it("lists the newest first", async () => {
		const user = await createTestUser();
		const older = await createTestCase(user.id, { kind: "PATTERN" });
		await prisma.assuranceCase.update({
			where: { id: older.id },
			data: { createdAt: new Date("2026-01-01T00:00:00Z") },
		});
		const newer = await createTestCase(user.id, { kind: "PATTERN" });

		expect(idsOf(await listUserPatterns(user.id))).toEqual([
			newer.id,
			older.id,
		]);
	});

	it("is empty for someone with no patterns", async () => {
		const user = await createTestUser();
		await createTestCase(user.id);

		expect(await listUserPatterns(user.id)).toEqual({ data: [] });
	});

	it("shares no case with My Assurance Cases, whatever mix a user holds", async () => {
		const me = await createTestUser();
		const other = await createTestUser();
		const mine = [
			await createTestCase(me.id, { kind: "CASE" }),
			await createTestCase(me.id, { kind: "PATTERN" }),
			await createTestCase(me.id, { kind: "CASE" }),
			await createTestCase(me.id, { kind: "PATTERN" }),
		];
		const sharedCase = await createTestCase(other.id, { kind: "CASE" });
		const sharedPattern = await createTestCase(other.id, { kind: "PATTERN" });
		const trashedPattern = await createTestCase(me.id, { kind: "PATTERN" });
		const trashedCase = await createTestCase(me.id, { kind: "CASE" });
		await createTestPermission(sharedCase.id, me.id, other.id, "VIEW");
		await createTestPermission(sharedPattern.id, me.id, other.id, "VIEW");
		await trash(trashedPattern.id, me.id);
		await trash(trashedCase.id, me.id);

		const cases = idsOf(await listUserCases(me.id));
		const patterns = idsOf(await listUserPatterns(me.id));

		expect(cases.filter((id) => patterns.includes(id))).toEqual([]);
		expect([...cases, ...patterns].sort()).toEqual(
			[...mine.map((item) => item.id), sharedCase.id, sharedPattern.id].sort()
		);
		expect(patterns.sort()).toEqual(
			[mine[1]?.id, mine[3]?.id, sharedPattern.id].sort()
		);
	});
});

describe("moving between the lists by converting", () => {
	async function listsFor(user: User) {
		await mockAuth(user.id, user.username, user.email);
		const { fetchAssuranceCases, fetchSharedAssuranceCases } = await import(
			"@/actions/assurance-cases"
		);
		const { fetchUserPatterns } = await import("@/actions/case-kind");
		const idsFrom = (items: { id: number | string }[] | null) =>
			(items ?? []).map((item) => String(item.id));
		return {
			cases: idsFrom(await fetchAssuranceCases()),
			patterns: idsFrom(await fetchUserPatterns()),
			shared: await fetchSharedAssuranceCases(),
		};
	}

	it("takes a converted case out of My Assurance Cases and puts it in My Patterns, and back", async () => {
		const rich = await createRichCase("CASE");
		const guest = await createTestUser();
		await createTestPermission(rich.caseId, guest.id, rich.ownerId, "VIEW");

		const beforeOwner = await listsFor(rich.owner);
		expect(beforeOwner.cases).toContain(rich.caseId);
		expect(beforeOwner.patterns).not.toContain(rich.caseId);

		expect(await convertAs(rich.owner, rich.caseId, "PATTERN")).toMatchObject({
			success: true,
		});

		const asPatternOwner = await listsFor(rich.owner);
		expect(asPatternOwner.cases).not.toContain(rich.caseId);
		expect(asPatternOwner.patterns).toContain(rich.caseId);
		const asPatternGuest = await listsFor(guest);
		expect(asPatternGuest.cases).not.toContain(rich.caseId);
		expect(asPatternGuest.patterns).toContain(rich.caseId);

		expect(await convertAs(rich.owner, rich.caseId, "CASE")).toMatchObject({
			success: true,
		});

		const backOwner = await listsFor(rich.owner);
		expect(backOwner.cases).toContain(rich.caseId);
		expect(backOwner.patterns).not.toContain(rich.caseId);
		const backGuest = await listsFor(guest);
		expect(backGuest.cases).toContain(rich.caseId);
		expect(backGuest.patterns).not.toContain(rich.caseId);
	});

	it("keeps the other cases and patterns where they were", async () => {
		const rich = await createRichCase("CASE");
		const bystanderCase = await createTestCase(rich.ownerId, { kind: "CASE" });
		const bystanderPattern = await createTestCase(rich.ownerId, {
			kind: "PATTERN",
		});

		await convertAs(rich.owner, rich.caseId, "PATTERN");

		const lists = await listsFor(rich.owner);
		expect(lists.cases).toContain(bystanderCase.id);
		expect(lists.cases).not.toContain(bystanderPattern.id);
		expect(lists.patterns).toContain(bystanderPattern.id);
		expect(lists.patterns).not.toContain(bystanderCase.id);
	});

	it("shows a converted pattern as a pattern in Shared With Me, and as a case again after converting back", async () => {
		const rich = await createRichCase("CASE");
		const guest = await createTestUser();
		await createTestPermission(rich.caseId, guest.id, rich.ownerId, "EDIT");
		const kindInSharedList = async () => {
			const { shared } = await listsFor(guest);
			return (shared ?? []).find((item) => item.id === rich.caseId)?.kind;
		};

		expect(await kindInSharedList()).toBe("CASE");
		await convertAs(rich.owner, rich.caseId, "PATTERN");
		expect(await kindInSharedList()).toBe("PATTERN");
		await convertAs(rich.owner, rich.caseId, "CASE");
		expect(await kindInSharedList()).toBe("CASE");
	});

	it("takes a converted case out of the choice of cases to cite, and puts it back when converted back, leaving existing citations alone", async () => {
		const rich = await createRichCase("CASE");
		const citation = () =>
			prisma.assuranceElement.findFirstOrThrow({
				where: { caseId: rich.citingCaseId, elementType: "AWAY_GOAL" },
			});
		const before = await citation();
		const citable = async () => {
			await mockAuth(rich.owner.id, rich.owner.username, rich.owner.email);
			const { listCitableCases } = await import(
				"@/actions/cited-element-picker"
			);
			const result = await listCitableCases();
			return result.success ? result.data.map((item) => item.id) : [];
		};

		expect(await citable()).toContain(rich.caseId);
		await convertAs(rich.owner, rich.caseId, "PATTERN");
		expect(await citable()).not.toContain(rich.caseId);
		expect(await citation()).toEqual(before);
		await convertAs(rich.owner, rich.caseId, "CASE");
		expect(await citable()).toContain(rich.caseId);
		expect(await citation()).toEqual(before);
	});

	it("is not changed by a collaborator who lacks ADMIN, so the lists stay put", async () => {
		const rich = await createRichCase("CASE");
		const editor = await createTestUser();
		await createTestPermission(rich.caseId, editor.id, rich.ownerId, "EDIT");

		expect(await convertAs(editor, rich.caseId, "PATTERN")).toMatchObject({
			success: false,
		});

		const lists = await listsFor(rich.owner);
		expect(lists.cases).toContain(rich.caseId);
		expect(lists.patterns).not.toContain(rich.caseId);
	});
});

describe("fetchUserPatterns", () => {
	it("returns nothing for a signed-out caller", async () => {
		const { fetchUserPatterns } = await import("@/actions/case-kind");

		expect(await fetchUserPatterns()).toBeNull();
	});

	it("returns only the signed-in person's own and directly shared patterns", async () => {
		const me = await createTestUser();
		const other = await createTestUser();
		const mine = await createTestCase(me.id, { kind: "PATTERN" });
		const theirs = await createTestCase(other.id, { kind: "PATTERN" });
		const shared = await createTestCase(other.id, { kind: "PATTERN" });
		await createTestPermission(shared.id, me.id, other.id, "VIEW");
		await mockAuth(me.id, me.username, me.email);
		const { fetchUserPatterns } = await import("@/actions/case-kind");

		const patterns = await fetchUserPatterns();

		expect((patterns ?? []).map((item) => item.id).sort()).toEqual(
			[mine.id, shared.id].sort()
		);
		expect((patterns ?? []).map((item) => item.id)).not.toContain(theirs.id);
	});
});

describe("the My Patterns page", () => {
	async function renderPage() {
		const { default: MyPatternsPage } = await import(
			"@/app/(authenticated)/dashboard/patterns/page"
		);
		const { default: CaseList } = await import("@/components/cases/case-list");
		const tree = (await MyPatternsPage()) as ReactNode;
		return { tree, CaseList };
	}

	it("sends a signed-out visitor to the login page", async () => {
		const { default: MyPatternsPage } = await import(
			"@/app/(authenticated)/dashboard/patterns/page"
		);

		await expect(MyPatternsPage()).rejects.toThrow("redirected to /login");
	});

	it("hands the list its own and shared patterns and nothing else, with no create tile", async () => {
		const me = await createTestUser();
		const other = await createTestUser();
		const mine = await createTestCase(me.id, { kind: "PATTERN" });
		await createTestCase(me.id, { kind: "CASE" });
		const shared = await createTestCase(other.id, { kind: "PATTERN" });
		await createTestPermission(shared.id, me.id, other.id, "VIEW");
		await createTestCase(other.id, { kind: "PATTERN" });
		await mockAuth(me.id, me.username, me.email);

		const { tree, CaseList } = await renderPage();

		const lists = findElements(tree, (element) => element.type === CaseList);
		expect(lists).toHaveLength(1);
		const props = lists[0]?.props as {
			assuranceCases: { id: string; kind?: string }[];
			showCreate?: boolean;
		};
		expect(props.assuranceCases.map((item) => item.id).sort()).toEqual(
			[mine.id, shared.id].sort()
		);
		expect(props.assuranceCases.every((item) => item.kind === "PATTERN")).toBe(
			true
		);
		expect(props.showCreate).toBeFalsy();
	});

	it("points at converting a case, whether or not there are patterns", async () => {
		const me = await createTestUser();
		await mockAuth(me.id, me.username, me.email);
		const { tree: withoutPatterns } = await renderPage();
		await createTestCase(me.id, { kind: "PATTERN" });
		const { tree: withPatterns } = await renderPage();

		expect(JSON.stringify(withoutPatterns)).toContain("Convert to pattern");
		expect(JSON.stringify(withPatterns)).toContain("Convert to pattern");
	});

	it("shows the empty state, not a list, when there are no patterns", async () => {
		const me = await createTestUser();
		await createTestCase(me.id, { kind: "CASE" });
		await mockAuth(me.id, me.username, me.email);

		const { tree, CaseList } = await renderPage();

		expect(findElements(tree, (element) => element.type === CaseList)).toEqual(
			[]
		);
		expect(JSON.stringify(tree)).toContain("No patterns yet");
	});

	it("shows a case that was converted to a pattern and drops it again after converting back", async () => {
		const rich = await createRichCase("CASE");
		const listed = async () => {
			await mockAuth(rich.owner.id, rich.owner.username, rich.owner.email);
			const { tree, CaseList } = await renderPage();
			return findElements(tree, (element) => element.type === CaseList).flatMap(
				(element) =>
					(
						element.props as { assuranceCases: { id: string }[] }
					).assuranceCases.map((item) => item.id)
			);
		};

		expect(await listed()).toEqual([]);
		await convertAs(rich.owner, rich.caseId, "PATTERN");
		expect(await listed()).toContain(rich.caseId);
		await convertAs(rich.owner, rich.caseId, "CASE");
		expect(await listed()).toEqual([]);
	});
});

describe("the Trash page", () => {
	it("tells the list which trashed items are patterns", async () => {
		const me = await createTestUser();
		const pattern = await createTestCase(me.id, { kind: "PATTERN" });
		const ordinary = await createTestCase(me.id, { kind: "CASE" });
		await trash(pattern.id, me.id);
		await trash(ordinary.id, me.id);
		await mockAuth(me.id, me.username, me.email);
		const { default: TrashPage } = await import(
			"@/app/(authenticated)/dashboard/trash/page"
		);
		const { TrashList } = await import("@/components/cases/trash-list");

		const tree = (await TrashPage()) as ReactNode;

		const lists = findElements(tree, (element) => element.type === TrashList);
		expect(lists).toHaveLength(1);
		const cases = (lists[0]?.props as { cases: { id: string; kind: string }[] })
			.cases;
		expect(cases.find((item) => item.id === pattern.id)?.kind).toBe("PATTERN");
		expect(cases.find((item) => item.id === ordinary.id)?.kind).toBe("CASE");
	});

	it("keeps the kind of a converted case when it is trashed", async () => {
		const rich = await createRichCase("CASE");
		await convertAs(rich.owner, rich.caseId, "PATTERN");
		await trash(rich.caseId, rich.ownerId);
		await mockAuth(rich.owner.id, rich.owner.username, rich.owner.email);
		const { default: TrashPage } = await import(
			"@/app/(authenticated)/dashboard/trash/page"
		);
		const { TrashList } = await import("@/components/cases/trash-list");

		const tree = (await TrashPage()) as ReactNode;

		const cases = (
			findElements(tree, (element) => element.type === TrashList)[0]?.props as {
				cases: { id: string; kind: string }[];
			}
		).cases;
		expect(cases.find((item) => item.id === rich.caseId)?.kind).toBe("PATTERN");
	});
});
