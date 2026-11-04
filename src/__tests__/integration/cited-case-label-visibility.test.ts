import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canAccessCase } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { exportCase } from "@/lib/services/case-export-service";
import { fetchCaseFromPrisma } from "@/lib/services/case-fetch-service";
import { softDeleteCase } from "@/lib/services/case-trash-service";
import { publishAssuranceCase } from "@/lib/services/publish-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createStoredCase } from "../utils/case-kind-kit";
import { fetchNodes } from "../utils/counter-goal-kit";
import {
	addTeamMember,
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";
import {
	LOST_TARGETS,
	makeWorld,
	REF_KINDS,
	type RefKind,
	storeReference,
	VIEWABLE_TARGETS,
	type World,
} from "../utils/reference-edit-access-kit";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

beforeEach(async () => {
	await mockNoAuth();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Card = Record<string, unknown>;

/** A cited case given a name and an element name that nobody could guess. */
interface Dressed {
	caseId: string;
	caseName: string;
	elementId: string;
	elementName: string;
}

/** Renames `caseId` to a unique string and puts one uniquely named element in it. */
async function dress(caseId: string, ownerId: string): Promise<Dressed> {
	const caseName = `CitedCase-${randomUUID()}`;
	const elementName = `CitedElem-${randomUUID()}`;
	await prisma.assuranceCase.update({
		where: { id: caseId },
		data: { name: caseName },
	});
	const element = await createTestElement(caseId, ownerId, {
		elementType: "GOAL",
		name: elementName,
		role: "TOP_LEVEL",
	});
	return { caseId, caseName, elementId: element.id, elementName };
}

/** Every away goal and module card in a fetched case, wherever it hangs. */
function cardsIn(goals: unknown): Card[] {
	return fetchNodes(goals).filter(
		(node) => node.type === "away_goal" || node.type === "module"
	);
}

function nth<T>(list: readonly T[], index: number): T {
	const item = list[index];
	if (item === undefined) {
		throw new Error(`nothing at position ${index}`);
	}
	return item;
}

function cardNamed(goals: unknown, name: string): Card {
	const card = cardsIn(goals).find((node) => node.name === name);
	if (!card) {
		throw new Error(`no card named ${name} in the fetched case`);
	}
	return card;
}

/** What a card tells the viewer about the case it cites, whichever kind it is. */
function told(card: Card) {
	return {
		accessible: Boolean(card.citedCaseAccessible ?? card.moduleCaseAccessible),
		caseName: (card.citedCaseName ?? card.moduleCaseName ?? null) as
			| string
			| null,
		elementName: (card.citedElementName ?? null) as string | null,
	};
}

async function fetchAs(viewerId: string, caseId: string) {
	const result = await fetchCaseFromPrisma(caseId, viewerId);
	if (!("data" in result) || result.data === undefined) {
		throw new Error(`fetch failed: ${JSON.stringify(result)}`);
	}
	return result.data;
}

/** GET /api/cases/[id], as the signed-in viewer, returning the raw response text. */
async function getRoute(
	viewer: { id: string; username: string },
	caseId: string
) {
	await mockAuth(viewer.id, viewer.username);
	const { GET } = await import("@/app/api/cases/[id]/route");
	const response = await GET(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}`),
		{ params: Promise.resolve({ id: caseId }) }
	);
	return { status: response.status, text: await response.text() };
}

function expectNothingOf(serialised: string, dressed: Dressed) {
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(serialised).not.toContain(dressed.caseName);
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(serialised).not.toContain(dressed.elementName);
}

const CARD_NAME: Record<RefKind, string> = { AWAY_GOAL: "AG1", MODULE: "M1" };

/** Stores one reference in the world's home case to a target, dressed up, and says what the card should be named. */
async function arrange(
	world: World,
	kind: RefKind,
	makeTarget: (world: World) => Promise<string>
) {
	const caseId = await makeTarget(world);
	const dressed = await dress(caseId, world.stranger.id);
	await storeReference(world, kind, caseId, {
		citedElementId: kind === "AWAY_GOAL" ? dressed.elementId : undefined,
	});
	return { dressed, cardName: CARD_NAME[kind] };
}

// ---------------------------------------------------------------------------
// Every route to the cited case, both card kinds
// ---------------------------------------------------------------------------

describe.each(REF_KINDS)("a %s citing a case the viewer can open", (kind) => {
	describe.each(
		VIEWABLE_TARGETS.map((target) => [target.label, target] as const)
	)("%s", (_label, target) => {
		it("tells the viewer the case name, the element name and that they can open it", async () => {
			const world = await makeWorld();
			const { dressed, cardName } = await arrange(world, kind, target.make);

			const data = await fetchAs(world.editor.id, world.homeCaseId);
			const card = cardNamed(data.goals, cardName);

			expect(told(card)).toEqual({
				accessible: true,
				caseName: dressed.caseName,
				elementName: kind === "AWAY_GOAL" ? dressed.elementName : null,
			});
			expect(card.moduleReferenceId).toBe(dressed.caseId);
		});

		it("serves the same names through GET /api/cases/[id]", async () => {
			const world = await makeWorld();
			const { dressed } = await arrange(world, kind, target.make);

			const { status, text } = await getRoute(world.editor, world.homeCaseId);

			expect(status).toBe(200);
			expect(text).toContain(dressed.caseName);
			if (kind === "AWAY_GOAL") {
				expect(text).toContain(dressed.elementName);
			}
		});
	});
});

describe.each(
	REF_KINDS
)("a %s citing a case the viewer cannot open", (kind) => {
	describe.each(
		LOST_TARGETS.map((target) => [target.label, target] as const)
	)("%s", (_label, target) => {
		it("tells the viewer no names, and that they cannot open it", async () => {
			const world = await makeWorld();
			const { dressed, cardName } = await arrange(world, kind, target.make);

			const data = await fetchAs(world.editor.id, world.homeCaseId);
			const card = cardNamed(data.goals, cardName);

			expect(told(card)).toEqual({
				accessible: false,
				caseName: null,
				elementName: null,
			});
			expectNothingOf(JSON.stringify(data), dressed);
			// Raw ids are unchanged: the reference itself is still stored on the card.
			expect(card.moduleReferenceId).toBe(dressed.caseId);
		});

		it("sends no name in GET /api/cases/[id]", async () => {
			const world = await makeWorld();
			const { dressed } = await arrange(world, kind, target.make);

			const { status, text } = await getRoute(world.editor, world.homeCaseId);

			expect(status).toBe(200);
			expectNothingOf(text, dressed);
		});
	});
});

describe("the card's access flag agrees with the permission check", () => {
	it.each(
		[...VIEWABLE_TARGETS, ...LOST_TARGETS].map(
			(target) => [target.label, target] as const
		)
	)("%s", async (_label, target) => {
		const world = await makeWorld();
		const { dressed } = await arrange(world, "MODULE", target.make);

		const data = await fetchAs(world.editor.id, world.homeCaseId);
		const card = cardNamed(data.goals, "M1");
		const mayOpen = await canAccessCase(
			{ userId: world.editor.id, caseId: dressed.caseId },
			"VIEW"
		);

		expect(told(card).accessible).toBe(mayOpen);
		expect(told(card).caseName !== null).toBe(mayOpen);
	});
});

// ---------------------------------------------------------------------------
// The viewer's own level on the citing case does not matter
// ---------------------------------------------------------------------------

const LEVELS = ["VIEW", "COMMENT", "EDIT", "ADMIN"] as const;

describe.each(LEVELS)("a viewer holding %s on the citing case", (level) => {
	async function viewerDirect(world: World) {
		const viewer = await createTestUser();
		await createTestPermission(
			world.homeCaseId,
			viewer.id,
			world.host.id,
			level
		);
		return viewer;
	}

	async function viewerThroughTeam(world: World, role: "MEMBER" | "ADMIN") {
		const viewer = await createTestUser();
		const team = await createTestTeam(world.host.id);
		await addTeamMember(team.id, viewer.id, role);
		await createTestTeamPermission(
			world.homeCaseId,
			team.id,
			world.host.id,
			level
		);
		return viewer;
	}

	const WAYS: [
		string,
		(world: World) => Promise<{ id: string; username: string }>,
	][] = [
		["directly", (world) => viewerDirect(world)],
		["as a team member", (world) => viewerThroughTeam(world, "MEMBER")],
		["as a team admin", (world) => viewerThroughTeam(world, "ADMIN")],
	];

	it.each(
		WAYS
	)("%s: sees the label, and the name only once the cited case is shared", async (_way, makeViewer) => {
		const world = await makeWorld();
		const viewer = await makeViewer(world);
		const caseId = (await createStoredCase(world.stranger.id)).id;
		const dressed = await dress(caseId, world.stranger.id);
		await storeReference(world, "AWAY_GOAL", caseId, {
			citedElementId: dressed.elementId,
		});
		await storeReference(world, "MODULE", caseId);

		const before = await fetchAs(viewer.id, world.homeCaseId);
		expect(told(cardNamed(before.goals, "AG1")).accessible).toBe(false);
		expect(told(cardNamed(before.goals, "M1")).accessible).toBe(false);
		expectNothingOf(JSON.stringify(before), dressed);
		const routed = await getRoute(viewer, world.homeCaseId);
		expectNothingOf(routed.text, dressed);

		await createTestPermission(caseId, viewer.id, world.stranger.id, "VIEW");

		const after = await fetchAs(viewer.id, world.homeCaseId);
		expect(told(cardNamed(after.goals, "AG1"))).toEqual({
			accessible: true,
			caseName: dressed.caseName,
			elementName: dressed.elementName,
		});
		expect(told(cardNamed(after.goals, "M1"))).toEqual({
			accessible: true,
			caseName: dressed.caseName,
			elementName: null,
		});
	});

	it("the owner of the citing case is held to the same rule", async () => {
		const world = await makeWorld();
		await viewerDirect(world);
		const caseId = (await createStoredCase(world.stranger.id)).id;
		const dressed = await dress(caseId, world.stranger.id);
		await storeReference(world, "AWAY_GOAL", caseId, {
			citedElementId: dressed.elementId,
		});

		const data = await fetchAs(world.host.id, world.homeCaseId);

		expect(told(cardNamed(data.goals, "AG1")).accessible).toBe(false);
		expectNothingOf(JSON.stringify(data), dressed);
	});
});

// ---------------------------------------------------------------------------
// The answer follows the cited case's sharing at the moment of each fetch
// ---------------------------------------------------------------------------

describe("one reference followed through changes to who can open the cited case", () => {
	it("gives the label, then the name, then the label again at every change", async () => {
		const world = await makeWorld();
		const lead = await createTestUser();
		const caseId = (await createStoredCase(world.stranger.id)).id;
		const dressed = await dress(caseId, world.stranger.id);
		await storeReference(world, "AWAY_GOAL", caseId, {
			citedElementId: dressed.elementId,
		});

		const hidden = async (step: string) => {
			const data = await fetchAs(world.editor.id, world.homeCaseId);
			const card = cardNamed(data.goals, "AG1");
			expect(told(card), step).toEqual({
				accessible: false,
				caseName: null,
				elementName: null,
			});
			expect(JSON.stringify(data), step).not.toContain(dressed.caseName);
			expect(JSON.stringify(data), step).not.toContain(dressed.elementName);
			const routed = await getRoute(world.editor, world.homeCaseId);
			expect(routed.text, step).not.toContain(dressed.caseName);
			expect(routed.text, step).not.toContain(dressed.elementName);
		};
		const shown = async (step: string) => {
			const data = await fetchAs(world.editor.id, world.homeCaseId);
			expect(told(cardNamed(data.goals, "AG1")), step).toEqual({
				accessible: true,
				caseName: dressed.caseName,
				elementName: dressed.elementName,
			});
		};

		await hidden("never shared");

		await createTestPermission(
			caseId,
			world.editor.id,
			world.stranger.id,
			"VIEW"
		);
		await shown("shared directly");

		await prisma.casePermission.deleteMany({
			where: { caseId, userId: world.editor.id },
		});
		await hidden("direct share revoked");

		const team = await createTestTeam(lead.id);
		await createTestTeamPermission(caseId, team.id, world.stranger.id, "VIEW");
		await hidden("shared with a team the viewer is not in");

		await addTeamMember(team.id, world.editor.id, "MEMBER");
		await shown("viewer joined the team");

		await prisma.teamMember.deleteMany({
			where: { teamId: team.id, userId: world.editor.id },
		});
		await hidden("viewer removed from the team");

		await addTeamMember(team.id, world.editor.id, "ADMIN");
		await shown("viewer rejoined as team admin");

		await prisma.team.delete({ where: { id: team.id } });
		await hidden("the team was deleted");

		await createTestPermission(
			caseId,
			world.editor.id,
			world.stranger.id,
			"COMMENT"
		);
		await shown("shared directly again");

		await prisma.assuranceCase.update({
			where: { id: caseId },
			data: { deletedAt: new Date() },
		});
		await hidden("cited case in the bin");

		await prisma.assuranceCase.update({
			where: { id: caseId },
			data: { deletedAt: null },
		});
		await shown("cited case restored");
	});

	it.each(
		LEVELS
	)("keeps the label when the cited case is shared at %s with other people and with a team, but not with the viewer", async (level) => {
		const world = await makeWorld();
		const caseId = (await createStoredCase(world.stranger.id)).id;
		const dressed = await dress(caseId, world.stranger.id);
		const firstOther = await createTestUser();
		const secondOther = await createTestUser();
		for (const other of [firstOther, secondOther]) {
			await createTestPermission(caseId, other.id, world.stranger.id, level);
		}
		const team = await createTestTeam(firstOther.id);
		await addTeamMember(team.id, secondOther.id, "ADMIN");
		await createTestTeamPermission(caseId, team.id, world.stranger.id, level);
		await storeReference(world, "AWAY_GOAL", caseId, {
			citedElementId: dressed.elementId,
		});
		await storeReference(world, "MODULE", caseId);

		const data = await fetchAs(world.editor.id, world.homeCaseId);

		expect(told(cardNamed(data.goals, "AG1")).accessible).toBe(false);
		expect(told(cardNamed(data.goals, "M1")).accessible).toBe(false);
		expectNothingOf(JSON.stringify(data), dressed);
		const routed = await getRoute(world.editor, world.homeCaseId);
		expectNothingOf(routed.text, dressed);
	});

	it("shows a rename at once, and neither name after the share is revoked", async () => {
		const world = await makeWorld();
		const caseId = (await createStoredCase(world.stranger.id)).id;
		const dressed = await dress(caseId, world.stranger.id);
		await createTestPermission(
			caseId,
			world.editor.id,
			world.stranger.id,
			"VIEW"
		);
		await storeReference(world, "MODULE", caseId);

		const renamed = `Renamed-${randomUUID()}`;
		await prisma.assuranceCase.update({
			where: { id: caseId },
			data: { name: renamed },
		});
		const seenRenamed = await fetchAs(world.editor.id, world.homeCaseId);
		expect(told(cardNamed(seenRenamed.goals, "M1")).caseName).toBe(renamed);

		await prisma.casePermission.deleteMany({
			where: { caseId, userId: world.editor.id },
		});
		const after = JSON.stringify(
			await fetchAs(world.editor.id, world.homeCaseId)
		);
		expect(after).not.toContain(renamed);
		expect(after).not.toContain(dressed.caseName);
	});
});

describe("bin, purge, never shared and no longer shared read the same to the viewer", () => {
	it("gives identical cards, apart from the ids, for all four", async () => {
		const world = await makeWorld();
		const makeAndStore = async (name: string) => {
			const caseId = (await createStoredCase(world.stranger.id)).id;
			const dressed = await dress(caseId, world.stranger.id);
			await storeReference(world, "AWAY_GOAL", caseId, {
				citedElementId: dressed.elementId,
				name,
			});
			return { caseId, dressed };
		};

		const never = await makeAndStore("AG1");
		const revoked = await makeAndStore("AG2");
		await createTestPermission(
			revoked.caseId,
			world.editor.id,
			world.stranger.id,
			"ADMIN"
		);
		await prisma.casePermission.deleteMany({
			where: { caseId: revoked.caseId, userId: world.editor.id },
		});
		const binned = await makeAndStore("AG3");
		await createTestPermission(
			binned.caseId,
			world.editor.id,
			world.stranger.id,
			"ADMIN"
		);
		await prisma.assuranceCase.update({
			where: { id: binned.caseId },
			data: { deletedAt: new Date() },
		});
		const purged = await makeAndStore("AG4");
		await createTestPermission(
			purged.caseId,
			world.editor.id,
			world.stranger.id,
			"ADMIN"
		);
		await prisma.assuranceCase.delete({ where: { id: purged.caseId } });

		const data = await fetchAs(world.editor.id, world.homeCaseId);
		const cards = ["AG1", "AG2", "AG3", "AG4"].map((n) =>
			cardNamed(data.goals, n)
		);

		for (const card of cards) {
			expect(told(card)).toEqual({
				accessible: false,
				caseName: null,
				elementName: null,
			});
		}
		const keySets = new Set(cards.map((c) => Object.keys(c).sort().join(",")));
		expect(keySets.size).toBe(1);
		const serialised = JSON.stringify(data);
		for (const state of [never, revoked, binned, purged]) {
			expectNothingOf(serialised, state.dressed);
		}
	});

	it("gives a case in the bin the same card as a never-shared one", async () => {
		const world = await makeWorld();
		const a = (await createStoredCase(world.stranger.id)).id;
		const b = (await createStoredCase(world.stranger.id)).id;
		await prisma.assuranceCase.update({
			where: { id: b },
			data: { deletedAt: new Date() },
		});
		await storeReference(world, "MODULE", a, { name: "M1" });
		await storeReference(world, "MODULE", b, { name: "M2" });

		const data = await fetchAs(world.editor.id, world.homeCaseId);
		const [one, two] = [
			cardNamed(data.goals, "M1"),
			cardNamed(data.goals, "M2"),
		];

		expect(told(one)).toEqual(told(two));
		expect(one.moduleReferenceDangling).toBe(two.moduleReferenceDangling);
	});
});

// ---------------------------------------------------------------------------
// Old rows, where the pieces of a citation disagree
// ---------------------------------------------------------------------------

describe("an away goal whose cited element is not in the cited case", () => {
	it("reveals no element name when the cited case is hidden, though the element is in a case the viewer can open", async () => {
		const world = await makeWorld();
		const hiddenCase = (await createStoredCase(world.stranger.id)).id;
		const hidden = await dress(hiddenCase, world.stranger.id);
		const openCase = (await createStoredCase(world.editor.id)).id;
		const open = await dress(openCase, world.editor.id);
		await storeReference(world, "AWAY_GOAL", hiddenCase, {
			citedElementId: open.elementId,
		});

		const data = await fetchAs(world.editor.id, world.homeCaseId);
		const card = cardNamed(data.goals, "AG1");

		expect(told(card)).toEqual({
			accessible: false,
			caseName: null,
			elementName: null,
		});
		const serialised = JSON.stringify(data);
		expectNothingOf(serialised, hidden);
		expect(serialised).not.toContain(open.elementName);
	});

	it("reads an element's name only under the case it belongs to, when another card cites that case", async () => {
		const world = await makeWorld();
		const firstCase = (await createStoredCase(world.editor.id)).id;
		const first = await dress(firstCase, world.editor.id);
		const secondCase = (await createStoredCase(world.editor.id)).id;
		const second = await dress(secondCase, world.editor.id);
		await storeReference(world, "AWAY_GOAL", firstCase, {
			citedElementId: second.elementId,
			name: "AG1",
		});
		await storeReference(world, "AWAY_GOAL", secondCase, {
			citedElementId: second.elementId,
			name: "AG2",
		});

		const data = await fetchAs(world.editor.id, world.homeCaseId);

		expect(told(cardNamed(data.goals, "AG1"))).toEqual({
			accessible: true,
			caseName: first.caseName,
			elementName: null,
		});
		expect(told(cardNamed(data.goals, "AG2"))).toEqual({
			accessible: true,
			caseName: second.caseName,
			elementName: second.elementName,
		});
	});

	it("reveals no element name when the cited case can be opened but the element is in a hidden case", async () => {
		const world = await makeWorld();
		const hiddenCase = (await createStoredCase(world.stranger.id)).id;
		const hidden = await dress(hiddenCase, world.stranger.id);
		const openCase = (await createStoredCase(world.editor.id)).id;
		const open = await dress(openCase, world.editor.id);
		await storeReference(world, "AWAY_GOAL", openCase, {
			citedElementId: hidden.elementId,
		});

		const data = await fetchAs(world.editor.id, world.homeCaseId);
		const card = cardNamed(data.goals, "AG1");

		expect(told(card).accessible).toBe(true);
		expect(told(card).caseName).toBe(open.caseName);
		expect(told(card).elementName).toBeNull();
		expectNothingOf(JSON.stringify(data), hidden);
		const routed = await getRoute(world.editor, world.homeCaseId);
		expectNothingOf(routed.text, hidden);
	});

	it("reveals no element name when the element is in a case the viewer can open that is not the cited one", async () => {
		const world = await makeWorld();
		const citedCase = (await createStoredCase(world.editor.id)).id;
		const cited = await dress(citedCase, world.editor.id);
		const otherCase = (await createStoredCase(world.editor.id)).id;
		const other = await dress(otherCase, world.editor.id);
		await storeReference(world, "AWAY_GOAL", citedCase, {
			citedElementId: other.elementId,
		});

		const data = await fetchAs(world.editor.id, world.homeCaseId);
		const card = cardNamed(data.goals, "AG1");

		expect(told(card).caseName).toBe(cited.caseName);
		expect(told(card).elementName).toBeNull();
		expect(JSON.stringify(data)).not.toContain(other.elementName);
	});

	it("reveals no element name when the cited case has been purged and only the element reference is left", async () => {
		const world = await makeWorld();
		const hiddenCase = (await createStoredCase(world.stranger.id)).id;
		const hidden = await dress(hiddenCase, world.stranger.id);
		const goneCase = (await createStoredCase(world.editor.id)).id;
		const awayGoal = await storeReference(world, "AWAY_GOAL", goneCase, {
			citedElementId: hidden.elementId,
		});
		await prisma.assuranceCase.delete({ where: { id: goneCase } });
		const stored = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: awayGoal.id },
		});
		expect(stored.moduleReferenceId).toBeNull();
		expect(stored.citedElementId).toBe(hidden.elementId);

		const data = await fetchAs(world.editor.id, world.homeCaseId);
		const card = cardNamed(data.goals, "AG1");

		expect(told(card)).toEqual({
			accessible: false,
			caseName: null,
			elementName: null,
		});
		expectNothingOf(JSON.stringify(data), hidden);
		const routed = await getRoute(world.editor, world.homeCaseId);
		expectNothingOf(routed.text, hidden);
	});

	it("reveals no element name when the element is in a case that is in the bin", async () => {
		const world = await makeWorld();
		const binnedCase = (await createStoredCase(world.editor.id)).id;
		const binned = await dress(binnedCase, world.editor.id);
		await prisma.assuranceCase.update({
			where: { id: binnedCase },
			data: { deletedAt: new Date() },
		});
		const openCase = (await createStoredCase(world.editor.id)).id;
		await dress(openCase, world.editor.id);
		await storeReference(world, "AWAY_GOAL", openCase, {
			citedElementId: binned.elementId,
		});
		await storeReference(world, "AWAY_GOAL", binnedCase, {
			citedElementId: binned.elementId,
			name: "AG2",
		});

		const data = await fetchAs(world.editor.id, world.homeCaseId);

		expectNothingOf(JSON.stringify(data), binned);
	});
});

describe("a cited element that was deleted while its case is still open to the viewer", () => {
	it("names the case, gives no element name, and sends no trace of the deleted element's name", async () => {
		const world = await makeWorld();
		const caseId = (await createStoredCase(world.editor.id)).id;
		const dressed = await dress(caseId, world.editor.id);
		await storeReference(world, "AWAY_GOAL", caseId, {
			citedElementId: dressed.elementId,
		});
		await prisma.assuranceElement.update({
			where: { id: dressed.elementId },
			data: { deletedAt: new Date() },
		});

		const data = await fetchAs(world.editor.id, world.homeCaseId);
		const card = cardNamed(data.goals, "AG1");

		expect(told(card)).toEqual({
			accessible: true,
			caseName: dressed.caseName,
			elementName: null,
		});
		expect(JSON.stringify(data)).not.toContain(dressed.elementName);
	});

	it("sends no trace of a deleted element's name when the case is hidden as well", async () => {
		const world = await makeWorld();
		const caseId = (await createStoredCase(world.stranger.id)).id;
		const dressed = await dress(caseId, world.stranger.id);
		await storeReference(world, "AWAY_GOAL", caseId, {
			citedElementId: dressed.elementId,
		});
		await prisma.assuranceElement.update({
			where: { id: dressed.elementId },
			data: { deletedAt: new Date() },
		});

		const data = await fetchAs(world.editor.id, world.homeCaseId);

		expectNothingOf(JSON.stringify(data), dressed);
	});

	it("a purged cited element leaves the case name showing for a viewer who can open the case", async () => {
		const world = await makeWorld();
		const caseId = (await createStoredCase(world.editor.id)).id;
		const dressed = await dress(caseId, world.editor.id);
		await storeReference(world, "AWAY_GOAL", caseId, {
			citedElementId: dressed.elementId,
		});
		await prisma.assuranceElement.delete({ where: { id: dressed.elementId } });

		const data = await fetchAs(world.editor.id, world.homeCaseId);

		expect(told(cardNamed(data.goals, "AG1"))).toEqual({
			accessible: true,
			caseName: dressed.caseName,
			elementName: null,
		});
	});
});

describe("a cited case that was binned and then purged", () => {
	it("leaves the fetch working and the viewer with no name", async () => {
		const world = await makeWorld();
		const owner = await createTestUser();
		const caseId = (await createStoredCase(owner.id)).id;
		const dressed = await dress(caseId, owner.id);
		await createTestPermission(caseId, world.editor.id, owner.id, "VIEW");
		await storeReference(world, "AWAY_GOAL", caseId, {
			citedElementId: dressed.elementId,
		});
		await storeReference(world, "MODULE", caseId);

		const trashed = await softDeleteCase(owner.id, caseId);
		expect("error" in trashed).toBe(false);
		const whileBinned = JSON.stringify(
			await fetchAs(world.editor.id, world.homeCaseId)
		);
		expectNothingOf(whileBinned, dressed);

		await prisma.assuranceCase.delete({ where: { id: caseId } });
		const data = await fetchAs(world.editor.id, world.homeCaseId);

		expect(told(cardNamed(data.goals, "AG1")).accessible).toBe(false);
		expect(told(cardNamed(data.goals, "M1")).accessible).toBe(false);
		expectNothingOf(JSON.stringify(data), dressed);
	});
});

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

describe("a cited case that is a pattern", () => {
	it("is hidden from a viewer who cannot open it and shown to one who can", async () => {
		const world = await makeWorld();
		const owner = await createTestUser();
		const hiddenPattern = await createTestCase(owner.id, { kind: "PATTERN" });
		const hidden = await dress(hiddenPattern.id, owner.id);
		const sharedPattern = await createTestCase(owner.id, { kind: "PATTERN" });
		const shared = await dress(sharedPattern.id, owner.id);
		await createTestPermission(
			sharedPattern.id,
			world.editor.id,
			owner.id,
			"VIEW"
		);
		await storeReference(world, "AWAY_GOAL", hiddenPattern.id, {
			citedElementId: hidden.elementId,
			name: "AG1",
		});
		await storeReference(world, "MODULE", hiddenPattern.id, { name: "M1" });
		await storeReference(world, "AWAY_GOAL", sharedPattern.id, {
			citedElementId: shared.elementId,
			name: "AG2",
		});
		await storeReference(world, "MODULE", sharedPattern.id, { name: "M2" });

		const data = await fetchAs(world.editor.id, world.homeCaseId);

		expect(told(cardNamed(data.goals, "AG1")).caseName).toBeNull();
		expect(told(cardNamed(data.goals, "M1")).caseName).toBeNull();
		expect(told(cardNamed(data.goals, "AG2"))).toEqual({
			accessible: true,
			caseName: shared.caseName,
			elementName: shared.elementName,
		});
		expect(told(cardNamed(data.goals, "M2")).caseName).toBe(shared.caseName);
		expectNothingOf(JSON.stringify(data), hidden);
		const routed = await getRoute(world.editor, world.homeCaseId);
		expectNothingOf(routed.text, hidden);
	});

	it("a published pattern nobody shared with the viewer stays hidden", async () => {
		const world = await makeWorld();
		const owner = await createTestUser();
		const pattern = await createTestCase(owner.id, {
			kind: "PATTERN",
			published: true,
			publishStatus: "PUBLISHED",
		});
		const dressed = await dress(pattern.id, owner.id);
		await storeReference(world, "MODULE", pattern.id);

		const data = await fetchAs(world.editor.id, world.homeCaseId);

		expect(told(cardNamed(data.goals, "M1")).accessible).toBe(false);
		expectNothingOf(JSON.stringify(data), dressed);
	});
});

// ---------------------------------------------------------------------------
// Many references at once
// ---------------------------------------------------------------------------

interface ExpectedCard {
	dressed: Dressed;
	kind: RefKind;
	visible: boolean;
}

/** Stores one reference to a dressed case in the home case, citing its element when the kind is an away goal. */
function storeCitation(
	world: World,
	kind: RefKind,
	cited: Dressed,
	name: string
) {
	return storeReference(world, kind, cited.caseId, {
		citedElementId: kind === "AWAY_GOAL" ? cited.elementId : undefined,
		name,
	});
}

/**
 * Stores, for each position, one reference to the open case and one to the
 * hidden case, and returns what each card should tell the viewer by name.
 * Which kind cites the open and which the hidden case alternates, so neither
 * kind is all one answer.
 */
async function storeMixedReferences(
	world: World,
	open: readonly Dressed[],
	hidden: readonly Dressed[]
): Promise<Map<string, ExpectedCard>> {
	const expected = new Map<string, ExpectedCard>();
	for (let i = 0; i < open.length; i++) {
		const awayKind = i % 2 === 0;
		const openKind: RefKind = awayKind ? "AWAY_GOAL" : "MODULE";
		const hiddenKind: RefKind = awayKind ? "MODULE" : "AWAY_GOAL";
		const openName = `${openKind === "AWAY_GOAL" ? "AG" : "M"}${10 + i}`;
		const hiddenName = `${hiddenKind === "AWAY_GOAL" ? "AG" : "M"}${20 + i}`;
		const openCase = nth(open, i);
		const hiddenCase = nth(hidden, i);
		await storeCitation(world, openKind, openCase, openName);
		await storeCitation(world, hiddenKind, hiddenCase, hiddenName);
		expected.set(openName, {
			dressed: openCase,
			visible: true,
			kind: openKind,
		});
		expected.set(hiddenName, {
			dressed: hiddenCase,
			visible: false,
			kind: hiddenKind,
		});
	}
	return expected;
}

/** Checks that every card in the fetched case tells the viewer exactly what `expected` says for its name. */
function expectEachCardItsOwnAnswer(
	goals: unknown,
	expected: ReadonlyMap<string, ExpectedCard>
) {
	for (const [cardName, want] of expected) {
		const card = cardNamed(goals, cardName);
		if (want.visible) {
			// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
			expect(told(card), cardName).toEqual({
				accessible: true,
				caseName: want.dressed.caseName,
				elementName:
					want.kind === "AWAY_GOAL" ? want.dressed.elementName : null,
			});
		} else {
			// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
			expect(told(card), cardName).toEqual({
				accessible: false,
				caseName: null,
				elementName: null,
			});
		}
	}
}

describe("many references of both kinds to a mix of open and hidden cases", () => {
	it("gives each card its own case's answer and mixes nothing up", async () => {
		const world = await makeWorld();
		const open: Dressed[] = [];
		const hidden: Dressed[] = [];
		for (let i = 0; i < 6; i++) {
			const openId = (await createStoredCase(world.editor.id)).id;
			open.push(await dress(openId, world.editor.id));
			const hiddenId = (await createStoredCase(world.stranger.id)).id;
			hidden.push(await dress(hiddenId, world.stranger.id));
		}
		const expected = await storeMixedReferences(world, open, hidden);

		const data = await fetchAs(world.editor.id, world.homeCaseId);

		expectEachCardItsOwnAnswer(data.goals, expected);
		const serialised = JSON.stringify(data);
		for (const dressed of hidden) {
			expectNothingOf(serialised, dressed);
		}
		const routed = await getRoute(world.editor, world.homeCaseId);
		for (const dressed of hidden) {
			expectNothingOf(routed.text, dressed);
		}
		for (const dressed of open) {
			expect(routed.text).toContain(dressed.caseName);
		}
	});

	it("answers every card of a case that cites a hundred and twenty cases", async () => {
		const world = await makeWorld();
		const wanted = new Map<string, { dressed: Dressed; visible: boolean }>();
		for (let i = 0; i < 120; i++) {
			const visible = i % 2 === 0;
			const owner = visible ? world.editor : world.stranger;
			const caseId = (await createStoredCase(owner.id)).id;
			const dressed = await dress(caseId, owner.id);
			const name = `M${100 + i}`;
			await storeReference(world, "MODULE", caseId, { name });
			wanted.set(name, { dressed, visible });
		}

		const data = await fetchAs(world.editor.id, world.homeCaseId);

		let shown = 0;
		for (const [name, want] of wanted) {
			const card = cardNamed(data.goals, name);
			expect(told(card).accessible, name).toBe(want.visible);
			expect(told(card).caseName, name).toBe(
				want.visible ? want.dressed.caseName : null
			);
			shown += told(card).accessible ? 1 : 0;
		}
		expect(shown).toBe(60);
		const serialised = JSON.stringify(data);
		for (const { dressed, visible } of wanted.values()) {
			if (!visible) {
				expectNothingOf(serialised, dressed);
			}
		}
	});

	it("treats one hidden case cited by an away goal and a module alike, and one open case likewise", async () => {
		const world = await makeWorld();
		const hiddenId = (await createStoredCase(world.stranger.id)).id;
		const hidden = await dress(hiddenId, world.stranger.id);
		const openId = (await createStoredCase(world.editor.id)).id;
		const open = await dress(openId, world.editor.id);
		await storeReference(world, "AWAY_GOAL", hiddenId, {
			citedElementId: hidden.elementId,
			name: "AG1",
		});
		await storeReference(world, "MODULE", hiddenId, { name: "M1" });
		await storeReference(world, "AWAY_GOAL", openId, {
			citedElementId: open.elementId,
			name: "AG2",
		});
		await storeReference(world, "MODULE", openId, { name: "M2" });

		const data = await fetchAs(world.editor.id, world.homeCaseId);

		expect(told(cardNamed(data.goals, "AG1")).accessible).toBe(false);
		expect(told(cardNamed(data.goals, "M1")).accessible).toBe(false);
		expect(told(cardNamed(data.goals, "AG2")).caseName).toBe(open.caseName);
		expect(told(cardNamed(data.goals, "M2")).caseName).toBe(open.caseName);
		expectNothingOf(JSON.stringify(data), hidden);
	});

	it("serves two viewers of one case their own answers, fetched together", async () => {
		const world = await makeWorld();
		const caseId = (await createStoredCase(world.stranger.id)).id;
		const dressed = await dress(caseId, world.stranger.id);
		await createTestPermission(
			caseId,
			world.editor.id,
			world.stranger.id,
			"VIEW"
		);
		await storeReference(world, "AWAY_GOAL", caseId, {
			citedElementId: dressed.elementId,
		});
		await storeReference(world, "MODULE", caseId);
		const outsider = await createTestUser();
		await createTestPermission(
			world.homeCaseId,
			outsider.id,
			world.host.id,
			"VIEW"
		);

		const results = await Promise.all(
			[0, 1, 2, 3, 4, 5].map((i) =>
				fetchAs(i % 2 === 0 ? world.editor.id : outsider.id, world.homeCaseId)
			)
		);

		results.forEach((data, i) => {
			const mayOpen = i % 2 === 0;
			expect(told(cardNamed(data.goals, "AG1")).accessible).toBe(mayOpen);
			expect(told(cardNamed(data.goals, "M1")).accessible).toBe(mayOpen);
			if (mayOpen) {
				expect(JSON.stringify(data)).toContain(dressed.caseName);
			} else {
				expectNothingOf(JSON.stringify(data), dressed);
			}
		});
	});
});

// ---------------------------------------------------------------------------
// Where a card can hang
// ---------------------------------------------------------------------------

describe("cards in every place the case fetch builds them", () => {
	it("hides the cited case beneath goals, strategies, claims and counter-goals alike", async () => {
		const world = await makeWorld();
		const owner = world.host.id;
		const hiddenId = (await createStoredCase(world.stranger.id)).id;
		const hidden = await dress(hiddenId, world.stranger.id);
		const openId = (await createStoredCase(world.editor.id)).id;
		const open = await dress(openId, world.editor.id);

		const goal = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId: world.homeCaseId, elementType: "GOAL", parentId: null },
		});
		const claim = await createTestElement(world.homeCaseId, owner, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: world.strategyId,
		});
		const counterGoal = await createTestElement(world.homeCaseId, owner, {
			elementType: "GOAL",
			name: "CG1",
			parentId: goal.id,
			isDefeater: true,
			defeatsElementId: goal.id,
		});

		const parents: [string, string][] = [
			["goal", goal.id],
			["strategy", world.strategyId],
			["claim", claim.id],
			["counter-goal", counterGoal.id],
		];
		for (const [place, parentId] of parents) {
			await createTestElement(world.homeCaseId, owner, {
				elementType: "AWAY_GOAL",
				name: `AG-${place}`,
				parentId,
				moduleReferenceId: hiddenId,
				citedElementId: hidden.elementId,
			});
			await createTestElement(world.homeCaseId, owner, {
				elementType: "MODULE",
				name: `M-${place}`,
				parentId,
				moduleReferenceId: hiddenId,
				moduleEmbedType: "COPY",
			});
			await createTestElement(world.homeCaseId, owner, {
				elementType: "AWAY_GOAL",
				name: `AGopen-${place}`,
				parentId,
				moduleReferenceId: openId,
				citedElementId: open.elementId,
			});
		}
		// A counter-goal that hangs from an away goal, with a module inside it.
		const awayHost = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId: world.homeCaseId, name: "AG-goal" },
		});
		const nestedCounter = await createTestElement(world.homeCaseId, owner, {
			elementType: "GOAL",
			name: "CG2",
			parentId: awayHost.id,
			isDefeater: true,
			defeatsElementId: awayHost.id,
		});
		await createTestElement(world.homeCaseId, owner, {
			elementType: "MODULE",
			name: "M-nested",
			parentId: nestedCounter.id,
			moduleReferenceId: hiddenId,
			moduleEmbedType: "COPY",
		});

		const data = await fetchAs(world.editor.id, world.homeCaseId);

		for (const [place] of parents) {
			expect(told(cardNamed(data.goals, `AG-${place}`)).accessible).toBe(false);
			expect(told(cardNamed(data.goals, `M-${place}`)).accessible).toBe(false);
			expect(told(cardNamed(data.goals, `AGopen-${place}`))).toEqual({
				accessible: true,
				caseName: open.caseName,
				elementName: open.elementName,
			});
		}
		expect(told(cardNamed(data.goals, "M-nested")).accessible).toBe(false);
		expectNothingOf(JSON.stringify(data), hidden);
		const routed = await getRoute(world.editor, world.homeCaseId);
		expectNothingOf(routed.text, hidden);
	});

	it("hides the cited case on a card in the sandbox", async () => {
		const world = await makeWorld();
		const hiddenId = (await createStoredCase(world.stranger.id)).id;
		const hidden = await dress(hiddenId, world.stranger.id);
		await createTestElement(world.homeCaseId, world.host.id, {
			elementType: "AWAY_GOAL",
			name: "AG1",
			parentId: world.strategyId,
			moduleReferenceId: hiddenId,
			citedElementId: hidden.elementId,
			inSandbox: true,
		});

		const data = await fetchAs(world.editor.id, world.homeCaseId);

		expectNothingOf(JSON.stringify(data), hidden);
	});
});

describe("the citing element's own text is untouched", () => {
	it("still carries its name, description and raw ids while the cited case is hidden", async () => {
		const world = await makeWorld();
		const hiddenId = (await createStoredCase(world.stranger.id)).id;
		const hidden = await dress(hiddenId, world.stranger.id);
		const element = await createTestElement(world.homeCaseId, world.host.id, {
			elementType: "AWAY_GOAL",
			name: "AG7",
			description: "Why this goal is cited here",
			parentId: world.strategyId,
			moduleReferenceId: hiddenId,
			citedElementId: hidden.elementId,
		});

		const data = await fetchAs(world.editor.id, world.homeCaseId);
		const card = cardNamed(data.goals, "AG7");

		expect(card.id).toBe(element.id);
		expect(card.description).toBe("Why this goal is cited here");
		expect(card.moduleReferenceId).toBe(hiddenId);
		expect(card.citedElementId).toBe(hidden.elementId);
	});
});

// ---------------------------------------------------------------------------
// The other deliveries of a case carry raw ids and no names
// ---------------------------------------------------------------------------

describe("exporting and publishing a case that cites a hidden case", () => {
	async function worldWithHiddenCitations() {
		const world = await makeWorld();
		const caseId = (await createStoredCase(world.stranger.id)).id;
		const hidden = await dress(caseId, world.stranger.id);
		await storeReference(world, "AWAY_GOAL", caseId, {
			citedElementId: hidden.elementId,
		});
		await storeReference(world, "MODULE", caseId);
		return { world, hidden };
	}

	it("exports raw ids and no names", async () => {
		const { world, hidden } = await worldWithHiddenCitations();

		const result = await exportCase(world.editor.id, world.homeCaseId);

		const serialised = JSON.stringify(result);
		expectNothingOf(serialised, hidden);
		expect(serialised).toContain(hidden.caseId);
		expect(serialised).toContain(hidden.elementId);
	});

	it("publishes raw ids and no names, on the stored snapshot and the public route", async () => {
		const { world, hidden } = await worldWithHiddenCitations();

		const published = await publishAssuranceCase(
			world.host.id,
			world.homeCaseId
		);
		if ("error" in published) {
			throw new Error(published.error);
		}
		const row = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: published.data.publishedId },
		});
		const { GET } = await import("@/app/api/public/discover/[slug]/route");
		const response = await GET(
			new NextRequest(`http://localhost:3000/api/public/discover/${row.slug}`),
			{ params: Promise.resolve({ slug: row.slug }) }
		);

		expect(response.status).toBe(200);
		expectNothingOf(JSON.stringify(row.content), hidden);
		expectNothingOf(await response.text(), hidden);
	});
});
