import { create } from "zustand";
import type { HistoryEntry, HistoryStore } from "@/types/history";

/** Maximum number of entries to keep in each stack */
const MAX_HISTORY_SIZE = 50;

/**
 * Zustand store for managing undo/redo history.
 *
 * The history is case-specific - when the case ID changes, the history is cleared.
 * Operations are recorded as entries containing before/after snapshots of elements.
 */
const useHistoryStore = create<HistoryStore>((set, get) => ({
	// State
	caseId: null,
	undoStack: [],
	redoStack: [],
	isApplying: false,

	// Actions
	setCaseId: (caseId: string | null) => {
		const currentCaseId = get().caseId;
		if (caseId !== currentCaseId) {
			// Clear history when switching cases
			set({
				caseId,
				undoStack: [],
				redoStack: [],
				isApplying: false,
			});
		}
	},

	recordOperation: (entry: HistoryEntry) => {
		// Don't record during undo/redo operations
		if (get().isApplying) {
			return;
		}

		set((state) => {
			const newUndoStack = [...state.undoStack, entry];
			// Trim to max size
			if (newUndoStack.length > MAX_HISTORY_SIZE) {
				newUndoStack.shift();
			}
			return {
				undoStack: newUndoStack,
				// Clear redo stack when new operation is recorded
				redoStack: [],
			};
		});
	},

	popUndo: () => {
		const { undoStack } = get();
		if (undoStack.length === 0) {
			return;
		}

		const entry = undoStack.at(-1);
		set((state) => ({
			undoStack: state.undoStack.slice(0, -1),
		}));
		return entry;
	},

	popRedo: () => {
		const { redoStack } = get();
		if (redoStack.length === 0) {
			return;
		}

		const entry = redoStack.at(-1);
		set((state) => ({
			redoStack: state.redoStack.slice(0, -1),
		}));
		return entry;
	},

	pushRedo: (entry: HistoryEntry) => {
		set((state) => {
			const newRedoStack = [...state.redoStack, entry];
			if (newRedoStack.length > MAX_HISTORY_SIZE) {
				newRedoStack.shift();
			}
			return { redoStack: newRedoStack };
		});
	},

	pushUndo: (entry: HistoryEntry) => {
		set((state) => {
			const newUndoStack = [...state.undoStack, entry];
			if (newUndoStack.length > MAX_HISTORY_SIZE) {
				newUndoStack.shift();
			}
			return { undoStack: newUndoStack };
		});
	},

	setIsApplying: (value: boolean) => {
		set({ isApplying: value });
	},

	clearHistory: () => {
		set({
			undoStack: [],
			redoStack: [],
		});
	},
}));

export default useHistoryStore;
