import prisma from "@/lib/prisma";
import { mockAuth } from "./auth-helpers";
import {
	addTeamMember,
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "./prisma-factories";

const LEVELS = ["VIEW", "COMMENT", "EDIT", "ADMIN"] as const;

/** An id that no case holds. */
const MISSING_CASE_ID = "00000000-0000-0000-0000-000000000000";

/**
 * An editor with EDIT on a home case, and the cases an away goal or module
 * there could be pointed at, each keyed by a plain description.
 *
 * `viewable` holds every way the editor can view a case: one they created,
 * one shared with them directly at each level and one shared with a team they
 * belong to. `hidden` holds a case they cannot view, a case in the bin and an
 * id that no case holds. `other` is a user who can view none of them.
 */
async function buildReferenceTargets() {
	const owner = await createTestUser();
	const editor = await createTestUser();
	const other = await createTestUser();
	const homeCase = await createTestCase(owner.id);
	await createTestPermission(homeCase.id, editor.id, owner.id, "EDIT");

	const viewable: Record<string, string> = {
		"the editor's own case": (await createTestCase(editor.id)).id,
	};
	for (const level of LEVELS) {
		const shared = await createTestCase(other.id);
		await createTestPermission(shared.id, editor.id, other.id, level);
		viewable[`a case shared with the editor at ${level}`] = shared.id;
	}
	const team = await createTestTeam(other.id);
	await addTeamMember(team.id, editor.id);
	const teamCase = await createTestCase(other.id);
	await createTestTeamPermission(teamCase.id, team.id, other.id, "VIEW");
	viewable["a case shared with the editor's team"] = teamCase.id;

	const binned = await createTestCase(editor.id);
	await prisma.assuranceCase.update({
		where: { id: binned.id },
		data: { deletedAt: new Date() },
	});
	const hidden = {
		"a case the editor cannot view": (await createTestCase(other.id)).id,
		"a case in the bin": binned.id,
		"a case that does not exist": MISSING_CASE_ID,
	};

	return { editor, homeCase, hidden, other, viewable };
}

/** Builds the reference targets and signs the editor in. */
export async function signInEditor() {
	const targets = await buildReferenceTargets();
	const { editor } = targets;
	await mockAuth(editor.id, editor.username, editor.email);
	return targets;
}

/** An away goal or module in the case, pointing at `moduleReferenceId`. */
export function createReferencingElement(
	caseId: string,
	createdById: string,
	elementType: "AWAY_GOAL" | "MODULE",
	moduleReferenceId: string
) {
	return createTestElement(caseId, createdById, {
		elementType,
		moduleReferenceId,
		moduleEmbedType: elementType === "MODULE" ? "REFERENCE" : undefined,
	});
}
