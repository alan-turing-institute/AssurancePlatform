"use client";

import { useEffect } from "react";
import { useHistory } from "@/hooks/use-history";

/**
 * Checks if the event target is an editable element (input, textarea, contenteditable).
 */
function isEditableElement(target: EventTarget | null): boolean {
	if (!target) {
		return false;
	}
	const element = target as HTMLElement;
	return (
		element instanceof HTMLInputElement ||
		element instanceof HTMLTextAreaElement ||
		element.isContentEditable
	);
}

/**
 * Checks if this is an undo shortcut (Cmd/Ctrl + Z without Shift).
 */
function isUndoShortcut(e: KeyboardEvent): boolean {
	const isMod = e.metaKey || e.ctrlKey;
	return isMod && e.key.toLowerCase() === "z" && !e.shiftKey;
}

/**
 * Checks if this is a redo shortcut (Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y).
 */
function isRedoShortcut(e: KeyboardEvent): boolean {
	const isMod = e.metaKey || e.ctrlKey;
	const isShiftZ = e.key.toLowerCase() === "z" && e.shiftKey;
	const isY = e.key.toLowerCase() === "y";
	return isMod && (isShiftZ || isY);
}

/**
 * Hook that sets up keyboard shortcuts for undo/redo operations.
 *
 * Shortcuts:
 * - Cmd/Ctrl + Z: Undo
 * - Cmd/Ctrl + Shift + Z: Redo
 * - Cmd/Ctrl + Y: Redo (Windows alternative)
 *
 * Shortcuts are disabled when focus is in an input, textarea, or contenteditable element.
 */
export function useKeyboardShortcuts() {
	const { undo, redo, canUndo, canRedo } = useHistory();

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			// Don't intercept keyboard shortcuts when typing in inputs
			if (isEditableElement(e.target)) {
				return;
			}

			if (isUndoShortcut(e) && canUndo) {
				e.preventDefault();
				undo();
				return;
			}

			if (isRedoShortcut(e) && canRedo) {
				e.preventDefault();
				redo();
			}
		};

		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [undo, redo, canUndo, canRedo]);
}
