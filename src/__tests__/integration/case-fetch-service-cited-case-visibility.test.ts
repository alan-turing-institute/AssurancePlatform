import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { fetchCaseFromPrisma } from "@/lib/services/case-fetch-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { createStoredCase } from "../utils/case-kind-kit";
import {
	createTestElement,
	createTestPermission,
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

/**
 * The canvas fetch gives a viewer the name of a cited case, and of the cited
 * element, only while they can view the cited case. In every other state (in
 * the bin, deleted, never shared, no longer shared) the card gets no name, and
 * the response as a whole carries none.
 */

const hiddenLabel = () => `Hidden-${randomUUID().slice(0, 8)}`;

interface Cited {
	caseId: string;
	caseName: string;
	elementId: string;
	elementName: string;
}

/** A cited element, with a name nothing else in the world has, inside `caseId`. */
async function citedElementIn(
	caseId: string,
	ownerId: string
): Promise<{ id: string; name: string }> {
	const name = hiddenLabel();
	const element = await createTestElement(caseId, ownerId, {
		elementType: "PROPERTY_CLAIM",
		name,
	});
	return { id: element.id, name };
}

/** The case a target stands for, with an element in it to cite. */
async function citedIn(world: World, caseId: string): Promise<Cited> {
	const { name } = await prisma.assuranceCase.findUniqueOrThrow({
		where: { id: caseId },
		select: { name: true },
	});
	const element = await citedElementIn(caseId, world.stranger.id);
	return {
		caseId,
		caseName: name,
		elementId: element.id,
		elementName: element.name,
	};
}

/** What the home case's reference card shows `viewerId`, and the whole serialised response. */
async function shownTo(viewerId: string, world: World, kind: RefKind) {
	const data = expectSuccess(
		await fetchCaseFromPrisma(world.homeCaseId, viewerId)
	);
	const strategy = data.goals?.[0]?.strategies?.[0];
	const serialised = JSON.stringify(data);
	if (kind === "AWAY_GOAL") {
		const card = strategy?.awayGoals?.[0];
		return {
			accessible: card?.citedCaseAccessible,
			caseName: card?.citedCaseName,
			elementName: card?.citedElementName,
			referenceId: card?.moduleReferenceId,
			serialised,
		};
	}
	const card = strategy?.modules?.[0];
	return {
		accessible: card?.moduleCaseAccessible,
		caseName: card?.moduleCaseName,
		elementName: null,
		referenceId: card?.moduleReferenceId,
		serialised,
	};
}

/** The cited element's id, which only an away goal holds. */
function citedElementOption(kind: RefKind, cited: Cited) {
	return kind === "AWAY_GOAL" ? { citedElementId: cited.elementId } : {};
}

describe.each(
	REF_KINDS
)("fetchCaseFromPrisma, a %s citing another case", (kind) => {
	describe("a case the viewer can view", () => {
		it.each(
			VIEWABLE_TARGETS.map((target) => [target.label, target] as const)
		)("shows the names and the link for %s", async (_label, target) => {
			const world = await makeWorld();
			const cited = await citedIn(world, await target.make(world));
			await storeReference(
				world,
				kind,
				cited.caseId,
				citedElementOption(kind, cited)
			);

			const shown = await shownTo(world.editor.id, world, kind);

			expect(shown.accessible).toBe(true);
			expect(shown.caseName).toBe(cited.caseName);
			expect(shown.referenceId).toBe(cited.caseId);
			if (kind === "AWAY_GOAL") {
				expect(shown.elementName).toBe(cited.elementName);
			}
		});
	});

	describe("a case the viewer can not view", () => {
		it.each(
			LOST_TARGETS.map((target) => [target.label, target] as const)
		)("returns no name for %s", async (_label, target) => {
			const world = await makeWorld();
			const cited = await citedIn(world, await target.make(world));
			await storeReference(
				world,
				kind,
				cited.caseId,
				citedElementOption(kind, cited)
			);

			const shown = await shownTo(world.editor.id, world, kind);

			expect(shown.accessible).toBe(false);
			expect(shown.caseName).toBeNull();
			expect(shown.elementName).toBeNull();
			expect(shown.serialised).not.toContain(cited.caseName);
			expect(shown.serialised).not.toContain(cited.elementName);
			// The stored reference itself is still carried, as an id.
			expect(shown.referenceId).toBe(cited.caseId);
		});
	});

	it("follows the cited case through sharing, the bin, restoring and revoking", async () => {
		const world = await makeWorld();
		const cited = await citedIn(
			world,
			(await createStoredCase(world.stranger.id)).id
		);
		await storeReference(
			world,
			kind,
			cited.caseId,
			citedElementOption(kind, cited)
		);
		const caseNameShown = async () =>
			(await shownTo(world.editor.id, world, kind)).caseName ?? null;

		expect(await caseNameShown()).toBeNull();

		await createTestPermission(
			cited.caseId,
			world.editor.id,
			world.stranger.id,
			"VIEW"
		);
		expect(await caseNameShown()).toBe(cited.caseName);

		await prisma.assuranceCase.update({
			where: { id: cited.caseId },
			data: { deletedAt: new Date() },
		});
		const inBin = await shownTo(world.editor.id, world, kind);
		expect(inBin.caseName).toBeNull();
		expect(inBin.serialised).not.toContain(cited.caseName);

		await prisma.assuranceCase.update({
			where: { id: cited.caseId },
			data: { deletedAt: null },
		});
		expect(await caseNameShown()).toBe(cited.caseName);

		await prisma.casePermission.deleteMany({
			where: { caseId: cited.caseId, userId: world.editor.id },
		});
		const revoked = await shownTo(world.editor.id, world, kind);
		expect(revoked.caseName).toBeNull();
		expect(revoked.serialised).not.toContain(cited.caseName);
	});

	it("decides for each viewer of the same case separately", async () => {
		const world = await makeWorld();
		const cited = await citedIn(
			world,
			(await createStoredCase(world.stranger.id)).id
		);
		await createTestPermission(
			cited.caseId,
			world.editor.id,
			world.stranger.id,
			"VIEW"
		);
		await storeReference(
			world,
			kind,
			cited.caseId,
			citedElementOption(kind, cited)
		);

		const editorSees = await shownTo(world.editor.id, world, kind);
		const hostSees = await shownTo(world.host.id, world, kind);

		expect(editorSees.caseName).toBe(cited.caseName);
		expect(hostSees.caseName).toBeNull();
		expect(hostSees.serialised).not.toContain(cited.caseName);
		expect(hostSees.serialised).not.toContain(cited.elementName);
	});
});

describe("fetchCaseFromPrisma, an away goal stored with a citation that does not match its case", () => {
	it("does not read an element's name from a case other than the one cited", async () => {
		const world = await makeWorld();
		const viewable = await citedIn(
			world,
			(await createStoredCase(world.editor.id)).id
		);
		const hidden = await citedIn(
			world,
			(await createStoredCase(world.stranger.id)).id
		);
		await storeReference(world, "AWAY_GOAL", viewable.caseId, {
			citedElementId: hidden.elementId,
		});

		const shown = await shownTo(world.editor.id, world, "AWAY_GOAL");

		expect(shown.accessible).toBe(true);
		expect(shown.caseName).toBe(viewable.caseName);
		expect(shown.elementName).toBeNull();
		expect(shown.serialised).not.toContain(hidden.caseName);
		expect(shown.serialised).not.toContain(hidden.elementName);
	});

	it("shows no element name under a case the viewer can not view, even when the element is in a case they can", async () => {
		const world = await makeWorld();
		const viewable = await citedIn(
			world,
			(await createStoredCase(world.editor.id)).id
		);
		const hidden = await citedIn(
			world,
			(await createStoredCase(world.stranger.id)).id
		);
		await storeReference(world, "AWAY_GOAL", hidden.caseId, {
			citedElementId: viewable.elementId,
		});

		const shown = await shownTo(world.editor.id, world, "AWAY_GOAL");

		expect(shown.accessible).toBe(false);
		expect(shown.elementName).toBeNull();
		expect(shown.serialised).not.toContain(hidden.caseName);
		expect(shown.serialised).not.toContain(viewable.elementName);
	});

	it("shows no element name when the row cites an element but names no case", async () => {
		const world = await makeWorld();
		const hidden = await citedIn(
			world,
			(await createStoredCase(world.stranger.id)).id
		);
		const row = await storeReference(world, "AWAY_GOAL", hidden.caseId, {
			citedElementId: hidden.elementId,
		});
		await prisma.assuranceElement.update({
			where: { id: row.id },
			data: { moduleReferenceId: null },
		});

		const shown = await shownTo(world.editor.id, world, "AWAY_GOAL");

		expect(shown.accessible).toBe(false);
		expect(shown.caseName).toBeNull();
		expect(shown.elementName).toBeNull();
		expect(shown.serialised).not.toContain(hidden.caseName);
		expect(shown.serialised).not.toContain(hidden.elementName);
	});
});
