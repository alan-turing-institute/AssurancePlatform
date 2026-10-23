import { hasReference } from "@/lib/case/defined-terms";
import { canBeChildOf } from "@/lib/element-compatibility";
import type { TreeNode } from "@/lib/schemas/case-export";
import { isNamedContextEntry } from "@/lib/schemas/context-entry";
import { fieldAppliesTo } from "@/lib/schemas/element-validation";
import {
	type EditSuggestion,
	MAX_SUGGESTED_CHARS,
	NEW_ELEMENT_TYPES,
	type NewElementSuggestion,
	type NewElementType,
	type Refusal,
	typeLabel,
} from "./suggestion";

/**
 * The rules for what the assistant may suggest. They work on a node of the
 * stored export (the case as the database holds it, before references and
 * named context entries are flattened), so the "before" text of a suggestion
 * is what the server would read back, and a field that holds a defined-term
 * reference can be told from one that does not.
 */

/** The element types whose text the assistant may suggest rewording. Away goals and modules point at other cases and are left out. */
const EDITABLE_TYPES = new Set([
	"GOAL",
	"STRATEGY",
	"PROPERTY_CLAIM",
	"EVIDENCE",
	"JUSTIFICATION",
	"ASSUMPTION",
]);

const TEXT_FIELDS = ["description", "assumption", "justification"] as const;

type TextField = (typeof TEXT_FIELDS)[number];

interface EditRequest {
	assumption?: string;
	context?: string[];
	description?: string;
	justification?: string;
}

function refuse(reason: string): Refusal {
	return { suggested: false, reason };
}

/** Names an element in a refusal: its label, or its kind when it has none. */
function called(node: TreeNode): string {
	return node.name?.trim() || `this ${typeLabel(node.type)}`;
}

/** Stored text as plain trimmed text; a missing value reads as empty. */
function trimmed(value: string | null | undefined): string {
	return value?.trim() ?? "";
}

/** The reason a piece of new text cannot be suggested, or null when it can. */
function textProblem(field: string, text: string): string | null {
	if (text === "") {
		return `The ${field} cannot be emptied, and a suggestion has to give some text.`;
	}
	if (text.length > MAX_SUGGESTED_CHARS) {
		return `The ${field} is over ${MAX_SUGGESTED_CHARS} characters, which is the most TEA saves in one field.`;
	}
	return null;
}

type FieldPlan = { change: { before: string; after: string } | null } | Refusal;

function planTextField(
	node: TreeNode,
	field: TextField,
	requested: string
): FieldPlan {
	if (!fieldAppliesTo(field, node.type)) {
		return refuse(`A ${typeLabel(node.type)} has no ${field} field.`);
	}
	const stored = node[field];
	if (hasReference(stored)) {
		return refuse(
			`The ${field} of ${called(node)} refers to a defined term, and rewording it would break the reference. The user can edit it in the element's form.`
		);
	}
	const after = requested.trim();
	const problem = textProblem(field, after);
	if (problem) {
		return refuse(problem);
	}
	const before = trimmed(stored);
	return { change: after === before ? null : { before, after } };
}

type ContextPlan =
	| { change: { before: string[]; after: string[] } | null }
	| Refusal;

function planContext(node: TreeNode, requested: string[]): ContextPlan {
	if (!fieldAppliesTo("context", node.type)) {
		return refuse(`A ${typeLabel(node.type)} has no context field.`);
	}
	const stored = node.context ?? [];
	if (
		stored.some((entry) => isNamedContextEntry(entry) || hasReference(entry))
	) {
		return refuse(
			`The context of ${called(node)} defines terms or refers to them, and rewording the list would break them. The user can edit it in the element's form.`
		);
	}
	const after = requested.map((entry) => entry.trim());
	if (after.length === 0) {
		return refuse(
			"The context list cannot be emptied, and a suggestion has to give some text."
		);
	}
	for (const entry of after) {
		const problem = textProblem("context entry", entry);
		if (problem) {
			return refuse(problem);
		}
	}
	const before = stored.map((entry) =>
		isNamedContextEntry(entry) ? "" : trimmed(entry)
	);
	const same =
		before.length === after.length &&
		before.every((entry, position) => entry === after[position]);
	return { change: same ? null : { before, after } };
}

function isRefusal(plan: FieldPlan | ContextPlan): plan is Refusal {
	return "suggested" in plan;
}

/** The changes each requested field would make, or the refusal of the first one that cannot be made. */
function planChanges(
	node: TreeNode,
	request: EditRequest
): EditSuggestion["changes"] | Refusal {
	const changes: EditSuggestion["changes"] = {};
	for (const field of TEXT_FIELDS) {
		const requested = request[field];
		if (requested === undefined) {
			continue;
		}
		const plan = planTextField(node, field, requested);
		if (isRefusal(plan)) {
			return plan;
		}
		if (plan.change) {
			changes[field] = plan.change;
		}
	}
	if (request.context !== undefined) {
		const plan = planContext(node, request.context);
		if (isRefusal(plan)) {
			return plan;
		}
		if (plan.change) {
			changes.context = plan.change;
		}
	}
	return changes;
}

/**
 * A suggestion to reword `node`, or the plain reason it cannot be made. Only
 * the fields that would change appear in the suggestion, each with its stored
 * text and the new text trimmed as the server will save it.
 */
export function planEdit(
	node: TreeNode,
	request: EditRequest
): EditSuggestion | Refusal {
	if (!EDITABLE_TYPES.has(node.type)) {
		return refuse(
			`The assistant cannot suggest changes to ${called(node)}: away goals and modules point at other cases, and TEA does not offer anything else of this kind to reword.`
		);
	}
	if (Object.values(request).every((value) => value === undefined)) {
		return refuse(
			"No new text was given. Give the complete new text for each field to change."
		);
	}
	const changes = planChanges(node, request);
	if ("suggested" in changes) {
		return changes;
	}
	if (Object.keys(changes).length === 0) {
		return refuse("The suggested text is the same as the current text.");
	}
	return {
		suggested: true,
		kind: "edit",
		elementId: node.id,
		elementType: node.type.toLowerCase(),
		label: node.name?.trim() ?? "",
		changes,
	};
}

/** The spellings a model may use for a child type, with spaces, hyphens and underscores removed. */
const CHILD_TYPE_ALIASES: Record<string, NewElementType> = {
	strategy: "strategy",
	propertyclaim: "property_claim",
	property: "property_claim",
	claim: "property_claim",
	evidence: "evidence",
};

/** The child type a model named, in any of the spellings it might use, or null. */
function childTypeFrom(name: string): NewElementType | null {
	return CHILD_TYPE_ALIASES[name.toLowerCase().replace(/[\s_-]+/g, "")] ?? null;
}

const PLURAL_LABELS: Record<NewElementType, string> = {
	strategy: "strategies",
	property_claim: "claims",
	evidence: "evidence",
};

/** The suggested child types TEA allows beneath a parent type, named in the plural. */
function allowedBeneath(parentType: string): string[] {
	return NEW_ELEMENT_TYPES.filter((type) => canBeChildOf(type, parentType)).map(
		(type) => PLURAL_LABELS[type]
	);
}

/**
 * A suggestion to add a child of `childName` beneath `parent`, or the plain
 * reason it cannot be made. The server does not check the parent's type when
 * an element is created, so this check is the one that keeps a strategy or
 * claim from being placed where TEA does not allow it.
 */
export function planNewElement(
	parent: TreeNode,
	childName: string,
	description: string
): NewElementSuggestion | Refusal {
	const childType = childTypeFrom(childName);
	if (!childType) {
		return refuse(
			"The assistant can suggest a new strategy, a new claim or new evidence, and nothing else."
		);
	}
	if (!canBeChildOf(childType, parent.type)) {
		const allowed = allowedBeneath(parent.type);
		return refuse(
			allowed.length === 0
				? `TEA does not allow anything to be added beneath ${called(parent)}.`
				: `TEA does not allow ${PLURAL_LABELS[childType]} directly beneath ${called(parent)}. It allows ${allowed.join(" and ")} there.`
		);
	}
	const text = description.trim();
	const problem = textProblem("description", text);
	if (problem) {
		return refuse(problem);
	}
	return {
		suggested: true,
		kind: "new",
		parentId: parent.id,
		parentLabel: parent.name?.trim() ?? "",
		parentType: parent.type.toLowerCase(),
		childType,
		description: text,
	};
}
