import { z } from "zod";
import {
	createAssuranceCaseNode,
	getNodeMutationErrorMessage,
	refreshCaseIfShown,
	updateAssuranceCaseNode,
} from "@/lib/case";
import { canBeChildOf } from "@/lib/element-compatibility";
import { recordCreate, recordUpdate } from "@/lib/services/history-service";
import useStore from "@/store/store";
import {
	type EditSuggestion,
	type NewElementSuggestion,
	type NewElementType,
	type Suggestion,
	trimmed,
} from "./suggestion";

/**
 * What came of clicking Apply. `changed` means the element is no longer as it
 * was when the suggestion was made, so nothing was saved; `failed` means the
 * save did not go through and the card can be tried again.
 */
export type ApplyResult =
	| { status: "applied" }
	| { status: "changed" }
	| { message: string; status: "failed" };

const APPLIED: ApplyResult = { status: "applied" };
const CHANGED: ApplyResult = { status: "changed" };

function failed(message: string): ApplyResult {
	return { status: "failed", message };
}

/** The part of an element read back that Apply compares and records. */
const elementSchema = z.looseObject({
	id: z.string(),
	type: z.string(),
	assuranceCaseId: z.string(),
	description: z.string().optional(),
	assumption: z.string().nullish(),
	justification: z.string().nullish(),
	context: z.array(z.unknown()).optional(),
});

type CurrentElement = z.infer<typeof elementSchema>;

type ElementRead =
	| { element: CurrentElement; status: "found" }
	| { status: "gone" }
	| { status: "unreadable" };

/** Reads the element as the server holds it now; the copy on the canvas can be out of date. */
async function readElement(id: string): Promise<ElementRead> {
	try {
		const response = await fetch(`/api/elements/${encodeURIComponent(id)}`);
		if (response.status === 404) {
			return { status: "gone" };
		}
		if (!response.ok) {
			return { status: "unreadable" };
		}
		const parsed = elementSchema.safeParse(await response.json());
		return parsed.success
			? { status: "found", element: parsed.data }
			: { status: "unreadable" };
	} catch {
		return { status: "unreadable" };
	}
}

const UNREADABLE = failed(
	"The element could not be read, so nothing was saved. Try again."
);

/** Whether the element's context is still the list of plain entries the suggestion started from. */
function sameContext(
	current: unknown[] | undefined,
	before: string[]
): boolean {
	const entries = current ?? [];
	return (
		entries.length === before.length &&
		entries.every(
			(entry, position) =>
				typeof entry === "string" &&
				trimmed(entry) === trimmed(before[position])
		)
	);
}

/** Whether every field the suggestion changes still holds the text it started from. */
function matchesBefore(
	current: CurrentElement,
	changes: EditSuggestion["changes"]
): boolean {
	return (
		(!changes.description ||
			trimmed(current.description) === trimmed(changes.description.before)) &&
		(!changes.assumption ||
			trimmed(current.assumption) === trimmed(changes.assumption.before)) &&
		(!changes.justification ||
			trimmed(current.justification) ===
				trimmed(changes.justification.before)) &&
		(!changes.context || sameContext(current.context, changes.context.before))
	);
}

/** The values to save: only the fields the suggestion changes, never the label or the status. */
function savedFields(changes: EditSuggestion["changes"]) {
	return {
		...(changes.description && { description: changes.description.after }),
		...(changes.assumption && { assumption: changes.assumption.after }),
		...(changes.justification && {
			justification: changes.justification.after,
		}),
		...(changes.context && { context: changes.context.after }),
	};
}

/** Reads the case again so the diagram shows what was saved, without waiting for the live-update stream. */
function refreshShownCase(caseId: string): void {
	refreshCaseIfShown(
		caseId,
		() => useStore.getState().assuranceCase?.id,
		useStore.getState().setAssuranceCase
	);
}

async function applyEdit(
	caseId: string,
	suggestion: EditSuggestion
): Promise<ApplyResult> {
	const read = await readElement(suggestion.elementId);
	if (read.status !== "found") {
		return read.status === "gone" ? CHANGED : UNREADABLE;
	}
	const { element } = read;
	if (
		element.assuranceCaseId !== caseId ||
		!matchesBefore(element, suggestion.changes)
	) {
		return CHANGED;
	}
	const fields = savedFields(suggestion.changes);
	const updated = await updateAssuranceCaseNode(
		element.type,
		element.id,
		"",
		fields
	);
	if (updated !== true) {
		return failed(
			getNodeMutationErrorMessage(
				updated,
				"The change could not be saved. Try again."
			)
		);
	}
	// The element read back leaves `context` out when it is empty, and Undo
	// sends back only what the saved entry holds, so an empty list is spelled
	// out when the suggestion fills it.
	const before = suggestion.changes.context
		? { ...element, context: element.context ?? [] }
		: element;
	recordUpdate(element.id, element.type, before, { ...element, ...fields });
	refreshShownCase(caseId);
	return APPLIED;
}

const COLLECTIONS: Record<NewElementType, string> = {
	strategy: "strategies",
	property_claim: "propertyclaims",
	evidence: "evidence",
};

async function applyNewElement(
	caseId: string,
	suggestion: NewElementSuggestion
): Promise<ApplyResult> {
	const read = await readElement(suggestion.parentId);
	if (read.status !== "found") {
		return read.status === "gone" ? CHANGED : UNREADABLE;
	}
	const { element: parent } = read;
	if (
		parent.assuranceCaseId !== caseId ||
		!canBeChildOf(suggestion.childType, parent.type)
	) {
		return CHANGED;
	}
	const created = await createAssuranceCaseNode(
		COLLECTIONS[suggestion.childType],
		{
			description: suggestion.description,
			parentId: parent.id,
			assuranceCaseId: caseId,
		},
		""
	);
	if (created.error || !created.data) {
		return failed(
			typeof created.error === "string"
				? created.error
				: "The new element could not be saved. Try again."
		);
	}
	recordCreate(created.data.id, suggestion.childType, created.data);
	refreshShownCase(caseId);
	return APPLIED;
}

/**
 * Saves a suggestion as if the user had typed it into the element's form. The
 * element is read again first, because the copy on the canvas can be out of
 * date, and is compared with the text the suggestion started from: if it
 * differs, or a parent no longer accepts the new element, nothing is saved.
 * A saved change is recorded for Undo and Redo, and the case is read again so
 * the diagram redraws. The server still makes its own checks of edit rights
 * and field length.
 */
export function applySuggestion(
	caseId: string,
	suggestion: Suggestion
): Promise<ApplyResult> {
	return suggestion.kind === "edit"
		? applyEdit(caseId, suggestion)
		: applyNewElement(caseId, suggestion);
}
