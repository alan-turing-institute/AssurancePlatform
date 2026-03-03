"use client";

import { useCallback } from "react";
import { applyRedo, applyUndo } from "@/lib/services/history-service";
import { toastError, toastSuccess } from "@/lib/toast";
import useHistoryStore from "@/store/history-store";
import useStore from "@/store/store";

/**
 * Hook for managing undo/redo operations in the diagram editor.
 *
 * Provides undo/redo actions and state information.
 */
export function useHistory() {
	const {
		undoStack,
		redoStack,
		isApplying,
		popUndo,
		popRedo,
		pushUndo,
		pushRedo,
		setIsApplying,
	} = useHistoryStore();

	const { assuranceCase, setAssuranceCase } = useStore();

	const canUndo = undoStack.length > 0 && !isApplying;
	const canRedo = redoStack.length > 0 && !isApplying;

	/**
	 * Refetches the case data after an undo/redo operation.
	 */
	const refetchCase = useCallback(async () => {
		if (!assuranceCase?.id) {
			return;
		}

		try {
			const response = await fetch(`/api/cases/${assuranceCase.id}`);
			if (response.ok) {
				const data = await response.json();
				setAssuranceCase(data);
			}
		} catch (error) {
			console.error("Failed to refetch case:", error);
		}
	}, [assuranceCase?.id, setAssuranceCase]);

	/**
	 * Undoes the last operation.
	 */
	const undo = useCallback(async () => {
		if (!canUndo) {
			return;
		}

		setIsApplying(true);

		try {
			const entry = popUndo();
			if (!entry) {
				setIsApplying(false);
				return;
			}

			// Apply undo operations in reverse order
			const reversedCommands = [...entry.commands].reverse();
			for (const command of reversedCommands) {
				await applyUndo(command);
			}

			// Move to redo stack
			pushRedo(entry);

			// Refetch case to update UI
			await refetchCase();

			toastSuccess(`Undid: ${entry.description}`);
		} catch (error) {
			console.error("Undo failed:", error);
			toastError("Undo failed - element may have been modified");
		} finally {
			setIsApplying(false);
		}
	}, [canUndo, popUndo, pushRedo, refetchCase, setIsApplying]);

	/**
	 * Redoes the last undone operation.
	 */
	const redo = useCallback(async () => {
		if (!canRedo) {
			return;
		}

		setIsApplying(true);

		try {
			const entry = popRedo();
			if (!entry) {
				setIsApplying(false);
				return;
			}

			// Apply redo operations in original order
			for (const command of entry.commands) {
				await applyRedo(command);
			}

			// Move back to undo stack
			pushUndo(entry);

			// Refetch case to update UI
			await refetchCase();

			toastSuccess(`Redid: ${entry.description}`);
		} catch (error) {
			console.error("Redo failed:", error);
			toastError("Redo failed - element may have been modified");
		} finally {
			setIsApplying(false);
		}
	}, [canRedo, popRedo, pushUndo, refetchCase, setIsApplying]);

	return {
		undo,
		redo,
		canUndo,
		canRedo,
		isApplying,
		undoStackLength: undoStack.length,
		redoStackLength: redoStack.length,
	};
}
