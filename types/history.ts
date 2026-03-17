/**
 * History system types for undo/redo functionality.
 *
 * The history system uses a command pattern where each operation
 * (create, update, delete, move, detach, attach) is recorded with
 * before/after snapshots, allowing operations to be reversed.
 */

/** Operation type for history commands */
export type OperationType =
	| "create"
	| "update"
	| "delete"
	| "move"
	| "detach"
	| "attach";

/**
 * Snapshot of an element's state at a point in time.
 * Contains all the fields needed to restore the element.
 */
// Captures arbitrary element fields for history snapshots (undo/redo)
export interface ElementSnapshot {
	assumption?: string | null;
	context?: string[];
	description: string;
	elementType: string;
	id: string;
	inSandbox?: boolean;
	justification?: string | null;
	level?: number | null;
	name: string;
	parentId?: string | null;
	url?: string | null;
	urls?: string[];
	[key: string]: unknown;
}

/**
 * A single command in the history representing one atomic operation.
 *
 * - For creates: before is null, after contains the created element
 * - For updates: both before and after contain element snapshots
 * - For deletes: before contains the deleted element, after is null
 * - For moves: both before and after contain parentId
 * - For detaches: before contains parentId, after is null
 * - For attaches: before is null, after contains parentId
 */
export interface HistoryCommand {
	after: ElementSnapshot | null;
	before: ElementSnapshot | null;
	elementId: string;
	elementType: string;
	type: OperationType;
}

/**
 * A history entry representing a user action.
 * May contain multiple commands for operations that affect multiple elements
 * (e.g., deleting an element with children).
 */
export interface HistoryEntry {
	commands: HistoryCommand[];
	description: string;
	id: string;
	timestamp: number;
}

/**
 * State of the history store.
 */
export interface HistoryState {
	/** Current case ID - history is cleared when this changes */
	caseId: string | null;
	/** Whether an undo/redo operation is currently in progress */
	isApplying: boolean;
	/** Stack of entries that can be redone */
	redoStack: HistoryEntry[];
	/** Stack of entries that can be undone */
	undoStack: HistoryEntry[];
}

/**
 * Actions available on the history store.
 */
export interface HistoryActions {
	/** Clear all history */
	clearHistory: () => void;
	/** Pop the last entry from the redo stack */
	popRedo: () => HistoryEntry | undefined;
	/** Pop the last entry from the undo stack */
	popUndo: () => HistoryEntry | undefined;
	/** Push an entry to the redo stack */
	pushRedo: (entry: HistoryEntry) => void;
	/** Push an entry to the undo stack */
	pushUndo: (entry: HistoryEntry) => void;
	/** Record a new operation to the history */
	recordOperation: (entry: HistoryEntry) => void;
	/** Set the current case ID, clearing history if it changes */
	setCaseId: (caseId: string | null) => void;
	/** Set the isApplying flag */
	setIsApplying: (value: boolean) => void;
}

/**
 * Combined history store type.
 */
export type HistoryStore = HistoryState & HistoryActions;
