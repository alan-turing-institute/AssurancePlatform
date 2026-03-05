"use client";

import useHistoryStore from "@/store/history-store";
import type {
	ElementSnapshot,
	HistoryCommand,
	OperationType,
} from "@/types/history";

/**
 * Applies an undo operation for a single command.
 * Reverses the effect of the original operation.
 */
export async function applyUndo(command: HistoryCommand): Promise<void> {
	switch (command.type) {
		case "create":
			// Undo create = soft-delete the created element
			await fetch(`/api/elements/${command.elementId}`, {
				method: "DELETE",
			});
			break;

		case "update":
			// Undo update = restore previous state
			if (command.before) {
				await fetch(`/api/elements/${command.elementId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: command.before.name,
						description: command.before.description,
						url: command.before.url,
						urls: command.before.urls,
						assumption: command.before.assumption,
						justification: command.before.justification,
						context: command.before.context,
						in_sandbox: command.before.inSandbox,
					}),
				});
			}
			break;

		case "delete":
			// Undo delete = restore the soft-deleted element
			await fetch(`/api/elements/${command.elementId}/restore`, {
				method: "POST",
			});
			break;

		case "move":
			// Undo move = move back to original parent
			if (command.before?.parentId) {
				await fetch(`/api/elements/${command.elementId}/move`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ parentId: command.before.parentId }),
				});
			}
			break;

		case "detach":
			// Undo detach = reattach to original parent
			if (command.before?.parentId) {
				await fetch(`/api/elements/${command.elementId}/attach`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ parentId: command.before.parentId }),
				});
			}
			break;

		case "attach":
			// Undo attach = detach from parent
			await fetch(
				`/api/elements/${command.elementId}/detach?element_type=${command.elementType}`,
				{ method: "POST" }
			);
			break;

		default:
			break;
	}
}

/**
 * Applies a redo operation for a single command.
 * Re-applies the original operation.
 */
export async function applyRedo(command: HistoryCommand): Promise<void> {
	switch (command.type) {
		case "create":
			// Redo create = restore the soft-deleted element
			await fetch(`/api/elements/${command.elementId}/restore`, {
				method: "POST",
			});
			break;

		case "update":
			// Redo update = apply new state
			if (command.after) {
				await fetch(`/api/elements/${command.elementId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: command.after.name,
						description: command.after.description,
						url: command.after.url,
						urls: command.after.urls,
						assumption: command.after.assumption,
						justification: command.after.justification,
						context: command.after.context,
						in_sandbox: command.after.inSandbox,
					}),
				});
			}
			break;

		case "delete":
			// Redo delete = soft-delete again
			await fetch(`/api/elements/${command.elementId}`, {
				method: "DELETE",
			});
			break;

		case "move":
			// Redo move = move to new parent again
			if (command.after?.parentId) {
				await fetch(`/api/elements/${command.elementId}/move`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ parentId: command.after.parentId }),
				});
			}
			break;

		case "detach":
			// Redo detach = detach again
			await fetch(
				`/api/elements/${command.elementId}/detach?element_type=${command.elementType}`,
				{ method: "POST" }
			);
			break;

		case "attach":
			// Redo attach = reattach to parent
			if (command.after?.parentId) {
				await fetch(`/api/elements/${command.elementId}/attach`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ parentId: command.after.parentId }),
				});
			}
			break;

		default:
			break;
	}
}

/**
 * Generates a human-readable description for a history entry.
 */
export function generateOperationDescription(
	type: OperationType,
	elementType: string,
	elementName?: string
): string {
	const typeLabel = formatElementType(elementType);
	const name = elementName ? ` "${elementName}"` : "";

	switch (type) {
		case "create":
			return `Created ${typeLabel}${name}`;
		case "update":
			return `Updated ${typeLabel}${name}`;
		case "delete":
			return `Deleted ${typeLabel}${name}`;
		case "move":
			return `Moved ${typeLabel}${name}`;
		case "detach":
			return `Detached ${typeLabel}${name}`;
		case "attach":
			return `Attached ${typeLabel}${name}`;
		default:
			return `Modified ${typeLabel}${name}`;
	}
}

/**
 * Formats element type for display.
 */
function formatElementType(elementType: string): string {
	if (elementType === "property_claim") {
		return "claim";
	}
	return elementType.toLowerCase();
}

/**
 * Creates an ElementSnapshot from element data.
 */
export function createSnapshot(data: Record<string, unknown>): ElementSnapshot {
	return {
		id: String(data.id ?? ""),
		elementType: String(data.type ?? data.elementType ?? ""),
		name: String(data.name ?? ""),
		description: String(data.description ?? ""),
		url: data.URL as string | undefined,
		urls: data.urls as string[] | undefined,
		assumption: data.assumption as string | undefined,
		justification: data.justification as string | undefined,
		context: data.context as string[] | undefined,
		inSandbox: data.inSandbox as boolean | undefined,
	};
}

/**
 * Records a create operation to the history store.
 * Call this after successfully creating an element.
 */
export function recordCreate(
	elementId: string | number,
	elementType: string,
	elementData: Record<string, unknown>
): void {
	const store = useHistoryStore.getState();

	// Don't record during undo/redo
	if (store.isApplying) {
		return;
	}

	const snapshot = createSnapshot({ ...elementData, id: elementId });
	const description = generateOperationDescription(
		"create",
		elementType,
		snapshot.name
	);

	store.recordOperation({
		id: crypto.randomUUID(),
		timestamp: Date.now(),
		description,
		commands: [
			{
				type: "create",
				elementId: String(elementId),
				elementType,
				before: null,
				after: snapshot,
			},
		],
	});
}

/**
 * Records an update operation to the history store.
 * Call this after successfully updating an element.
 */
export function recordUpdate(
	elementId: string | number,
	elementType: string,
	beforeData: Record<string, unknown>,
	afterData: Record<string, unknown>
): void {
	const store = useHistoryStore.getState();

	// Don't record during undo/redo
	if (store.isApplying) {
		return;
	}

	const beforeSnapshot = createSnapshot({ ...beforeData, id: elementId });
	const afterSnapshot = createSnapshot({ ...afterData, id: elementId });
	const description = generateOperationDescription(
		"update",
		elementType,
		beforeSnapshot.name || afterSnapshot.name
	);

	store.recordOperation({
		id: crypto.randomUUID(),
		timestamp: Date.now(),
		description,
		commands: [
			{
				type: "update",
				elementId: String(elementId),
				elementType,
				before: beforeSnapshot,
				after: afterSnapshot,
			},
		],
	});
}

/**
 * Records a delete operation to the history store.
 * Call this after successfully deleting an element.
 */
export function recordDelete(
	elementId: string | number,
	elementType: string,
	elementData: Record<string, unknown>
): void {
	const store = useHistoryStore.getState();

	// Don't record during undo/redo
	if (store.isApplying) {
		return;
	}

	const snapshot = createSnapshot({ ...elementData, id: elementId });
	const description = generateOperationDescription(
		"delete",
		elementType,
		snapshot.name
	);

	store.recordOperation({
		id: crypto.randomUUID(),
		timestamp: Date.now(),
		description,
		commands: [
			{
				type: "delete",
				elementId: String(elementId),
				elementType,
				before: snapshot,
				after: null,
			},
		],
	});
}

/**
 * Records a move operation to the history store.
 * Call this after successfully moving an element to a new parent.
 */
export function recordMove(
	elementId: string | number,
	elementType: string,
	oldParentId: string | number,
	newParentId: string | number,
	elementName?: string
): void {
	const store = useHistoryStore.getState();

	if (store.isApplying) {
		return;
	}

	const description = generateOperationDescription(
		"move",
		elementType,
		elementName
	);

	store.recordOperation({
		id: crypto.randomUUID(),
		timestamp: Date.now(),
		description,
		commands: [
			{
				type: "move",
				elementId: String(elementId),
				elementType,
				before: {
					id: String(elementId),
					elementType,
					name: elementName ?? "",
					description: "",
					parentId: String(oldParentId),
				},
				after: {
					id: String(elementId),
					elementType,
					name: elementName ?? "",
					description: "",
					parentId: String(newParentId),
				},
			},
		],
	});
}

/**
 * Records a detach operation to the history store.
 * Call this after successfully detaching an element from its parent.
 */
export function recordDetach(
	elementId: string | number,
	elementType: string,
	parentId: string | number,
	elementData: Record<string, unknown>
): void {
	const store = useHistoryStore.getState();

	if (store.isApplying) {
		return;
	}

	const snapshot = createSnapshot({ ...elementData, id: elementId });
	const description = generateOperationDescription(
		"detach",
		elementType,
		snapshot.name
	);

	store.recordOperation({
		id: crypto.randomUUID(),
		timestamp: Date.now(),
		description,
		commands: [
			{
				type: "detach",
				elementId: String(elementId),
				elementType,
				before: { ...snapshot, parentId: String(parentId) },
				after: null,
			},
		],
	});
}

/**
 * Records an attach operation to the history store.
 * Call this after successfully attaching an orphan element to a parent.
 */
export function recordAttach(
	elementId: string | number,
	elementType: string,
	parentId: string | number,
	elementData: Record<string, unknown>
): void {
	const store = useHistoryStore.getState();

	if (store.isApplying) {
		return;
	}

	const snapshot = createSnapshot({ ...elementData, id: elementId });
	const description = generateOperationDescription(
		"attach",
		elementType,
		snapshot.name
	);

	store.recordOperation({
		id: crypto.randomUUID(),
		timestamp: Date.now(),
		description,
		commands: [
			{
				type: "attach",
				elementId: String(elementId),
				elementType,
				before: null,
				after: { ...snapshot, parentId: String(parentId) },
			},
		],
	});
}
