"use client";

import useHistoryStore from "@/data/history-store";
import type { ElementSnapshot, HistoryCommand } from "@/types/history";

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

		default:
			// Exhaustive check - should never reach here
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

		default:
			// Exhaustive check - should never reach here
			break;
	}
}

/**
 * Generates a human-readable description for a history entry.
 */
export function generateOperationDescription(
	type: "create" | "update" | "delete",
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
		default:
			return `Modified ${typeLabel}${name}`;
	}
}

/**
 * Formats element type for display.
 */
function formatElementType(elementType: string): string {
	switch (elementType.toLowerCase()) {
		case "goal":
		case "toplevelgoal":
		case "toplevelgoalnormative":
			return "goal";
		case "strategy":
			return "strategy";
		case "property_claim":
		case "propertyclaim":
			return "claim";
		case "evidence":
			return "evidence";
		default:
			return elementType.toLowerCase();
	}
}

/**
 * Creates an ElementSnapshot from element data.
 */
export function createSnapshot(data: Record<string, unknown>): ElementSnapshot {
	return {
		id: String(data.id ?? ""),
		elementType: String(data.type ?? data.elementType ?? ""),
		name: String(data.name ?? ""),
		description: String(data.short_description ?? data.description ?? ""),
		url: data.URL as string | undefined,
		urls: data.urls as string[] | undefined,
		assumption: data.assumption as string | undefined,
		justification: data.justification as string | undefined,
		context: data.context as string[] | undefined,
		inSandbox: data.in_sandbox as boolean | undefined,
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
