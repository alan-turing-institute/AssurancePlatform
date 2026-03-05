import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useHistoryStore from "@/store/history-store";
import type { HistoryCommand } from "@/types/history";
import {
	applyRedo,
	applyUndo,
	generateOperationDescription,
	recordAttach,
	recordDetach,
	recordMove,
} from "../history-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a resolved Response that fetch can return without crashing */
function mockOkResponse(): Response {
	return new Response(null, { status: 200 });
}

/** Resets the Zustand store to a clean initial state between tests */
function resetStore(): void {
	useHistoryStore.setState({
		caseId: null,
		undoStack: [],
		redoStack: [],
		isApplying: false,
	});
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	resetStore();
});

afterEach(() => {
	vi.restoreAllMocks();
	resetStore();
});

// ---------------------------------------------------------------------------
// recordMove
// ---------------------------------------------------------------------------

describe("recordMove", () => {
	it("records the correct command structure to the store", () => {
		recordMove("elem-1", "goal", "parent-old", "parent-new", "My Goal");

		const { undoStack } = useHistoryStore.getState();
		expect(undoStack).toHaveLength(1);

		const entry = undoStack[0]!;
		expect(entry.description).toBe('Moved goal "My Goal"');
		expect(entry.commands).toHaveLength(1);

		const command = entry.commands[0]!;
		expect(command.type).toBe("move");
		expect(command.elementId).toBe("elem-1");
		expect(command.elementType).toBe("goal");
		expect(command.before?.parentId).toBe("parent-old");
		expect(command.after?.parentId).toBe("parent-new");
	});

	it("converts numeric IDs to strings", () => {
		recordMove(42, "evidence", 10, 20);

		const { undoStack } = useHistoryStore.getState();
		const command = undoStack[0]!.commands[0]!;

		expect(command.elementId).toBe("42");
		expect(command.before?.parentId).toBe("10");
		expect(command.after?.parentId).toBe("20");
	});

	it("records empty string for name when elementName is omitted", () => {
		recordMove("elem-2", "goal", "parent-a", "parent-b");

		const { undoStack } = useHistoryStore.getState();
		const command = undoStack[0]!.commands[0]!;

		expect(command.before?.name).toBe("");
		expect(command.after?.name).toBe("");
	});

	it("generates the correct description with a name", () => {
		recordMove("elem-3", "goal", "p1", "p2", "Target Goal");

		const { undoStack } = useHistoryStore.getState();
		expect(undoStack[0]!.description).toBe('Moved goal "Target Goal"');
	});

	it("generates the correct description without a name", () => {
		recordMove("elem-4", "evidence", "p1", "p2");

		const { undoStack } = useHistoryStore.getState();
		expect(undoStack[0]!.description).toBe("Moved evidence");
	});

	it("does not record when isApplying is true", () => {
		useHistoryStore.setState({ isApplying: true });

		recordMove("elem-5", "goal", "p1", "p2", "Name");

		const { undoStack } = useHistoryStore.getState();
		expect(undoStack).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// recordDetach
// ---------------------------------------------------------------------------

describe("recordDetach", () => {
	it("populates before.parentId from the argument and sets after to null", () => {
		recordDetach("elem-10", "property_claim", "parent-99", {
			name: "My Claim",
			description: "A claim",
		});

		const { undoStack } = useHistoryStore.getState();
		expect(undoStack).toHaveLength(1);

		const command = undoStack[0]!.commands[0]!;
		expect(command.type).toBe("detach");
		expect(command.elementId).toBe("elem-10");
		expect(command.elementType).toBe("property_claim");
		expect(command.before?.parentId).toBe("parent-99");
		expect(command.after).toBeNull();
	});

	it("converts numeric parentId to string", () => {
		recordDetach(7, "evidence", 3, { name: "Evidence A", description: "" });

		const { undoStack } = useHistoryStore.getState();
		const command = undoStack[0]!.commands[0]!;

		expect(command.before?.parentId).toBe("3");
	});

	it("carries the element name through the snapshot", () => {
		recordDetach("elem-11", "goal", "parent-1", {
			name: "Named Element",
			description: "",
		});

		const { undoStack } = useHistoryStore.getState();
		const command = undoStack[0]!.commands[0]!;

		expect(command.before?.name).toBe("Named Element");
	});

	it("generates a description using the element name", () => {
		recordDetach("elem-12", "goal", "parent-2", {
			name: "Detached Goal",
			description: "",
		});

		const { undoStack } = useHistoryStore.getState();
		expect(undoStack[0]!.description).toBe('Detached goal "Detached Goal"');
	});

	it("does not record when isApplying is true", () => {
		useHistoryStore.setState({ isApplying: true });

		recordDetach("elem-13", "goal", "parent-3", {
			name: "Name",
			description: "",
		});

		const { undoStack } = useHistoryStore.getState();
		expect(undoStack).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// recordAttach
// ---------------------------------------------------------------------------

describe("recordAttach", () => {
	it("sets before to null and populates after.parentId", () => {
		recordAttach("elem-20", "strategy", "parent-55", {
			name: "My Strategy",
			description: "A strategy",
		});

		const { undoStack } = useHistoryStore.getState();
		expect(undoStack).toHaveLength(1);

		const command = undoStack[0]!.commands[0]!;
		expect(command.type).toBe("attach");
		expect(command.elementId).toBe("elem-20");
		expect(command.elementType).toBe("strategy");
		expect(command.before).toBeNull();
		expect(command.after?.parentId).toBe("parent-55");
	});

	it("converts numeric parentId to string", () => {
		recordAttach(9, "evidence", 4, { name: "Evidence B", description: "" });

		const { undoStack } = useHistoryStore.getState();
		const command = undoStack[0]!.commands[0]!;

		expect(command.after?.parentId).toBe("4");
	});

	it("carries the element name through the snapshot", () => {
		recordAttach("elem-21", "strategy", "parent-5", {
			name: "Named Strategy",
			description: "",
		});

		const { undoStack } = useHistoryStore.getState();
		const command = undoStack[0]!.commands[0]!;

		expect(command.after?.name).toBe("Named Strategy");
	});

	it("generates a description using the element name", () => {
		recordAttach("elem-22", "strategy", "parent-6", {
			name: "Attached Strategy",
			description: "",
		});

		const { undoStack } = useHistoryStore.getState();
		expect(undoStack[0]!.description).toBe(
			'Attached strategy "Attached Strategy"'
		);
	});

	it("does not record when isApplying is true", () => {
		useHistoryStore.setState({ isApplying: true });

		recordAttach("elem-23", "strategy", "parent-7", {
			name: "Name",
			description: "",
		});

		const { undoStack } = useHistoryStore.getState();
		expect(undoStack).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// applyUndo -- move
// ---------------------------------------------------------------------------

describe('applyUndo("move")', () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockOkResponse()));
	});

	it("fetches the move endpoint with the old parentId", async () => {
		const command: HistoryCommand = {
			type: "move",
			elementId: "elem-30",
			elementType: "goal",
			before: {
				id: "elem-30",
				elementType: "goal",
				name: "",
				description: "",
				parentId: "original-parent",
			},
			after: {
				id: "elem-30",
				elementType: "goal",
				name: "",
				description: "",
				parentId: "new-parent",
			},
		};

		await applyUndo(command);

		expect(fetch).toHaveBeenCalledWith("/api/elements/elem-30/move", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parentId: "original-parent" }),
		});
	});

	it("does not fetch when before.parentId is absent", async () => {
		const command: HistoryCommand = {
			type: "move",
			elementId: "elem-31",
			elementType: "goal",
			before: {
				id: "elem-31",
				elementType: "goal",
				name: "",
				description: "",
				// parentId intentionally omitted
			},
			after: null,
		};

		await applyUndo(command);

		expect(fetch).not.toHaveBeenCalled();
	});

	it("does not fetch when before is null", async () => {
		const command: HistoryCommand = {
			type: "move",
			elementId: "elem-32",
			elementType: "goal",
			before: null,
			after: null,
		};

		await applyUndo(command);

		expect(fetch).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// applyUndo -- detach
// ---------------------------------------------------------------------------

describe('applyUndo("detach")', () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockOkResponse()));
	});

	it("fetches the attach endpoint with the original parentId to reattach", async () => {
		const command: HistoryCommand = {
			type: "detach",
			elementId: "elem-40",
			elementType: "goal",
			before: {
				id: "elem-40",
				elementType: "goal",
				name: "",
				description: "",
				parentId: "original-parent",
			},
			after: null,
		};

		await applyUndo(command);

		expect(fetch).toHaveBeenCalledWith("/api/elements/elem-40/attach", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parentId: "original-parent" }),
		});
	});

	it("does not fetch when before.parentId is absent", async () => {
		const command: HistoryCommand = {
			type: "detach",
			elementId: "elem-41",
			elementType: "goal",
			before: {
				id: "elem-41",
				elementType: "goal",
				name: "",
				description: "",
				// parentId omitted
			},
			after: null,
		};

		await applyUndo(command);

		expect(fetch).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// applyUndo -- attach
// ---------------------------------------------------------------------------

describe('applyUndo("attach")', () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockOkResponse()));
	});

	it("fetches the detach endpoint with the element_type query parameter", async () => {
		const command: HistoryCommand = {
			type: "attach",
			elementId: "elem-50",
			elementType: "strategy",
			before: null,
			after: {
				id: "elem-50",
				elementType: "strategy",
				name: "",
				description: "",
				parentId: "some-parent",
			},
		};

		await applyUndo(command);

		expect(fetch).toHaveBeenCalledWith(
			"/api/elements/elem-50/detach?element_type=strategy",
			{ method: "POST" }
		);
	});
});

// ---------------------------------------------------------------------------
// applyRedo -- move
// ---------------------------------------------------------------------------

describe('applyRedo("move")', () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockOkResponse()));
	});

	it("fetches the move endpoint with the new parentId", async () => {
		const command: HistoryCommand = {
			type: "move",
			elementId: "elem-60",
			elementType: "goal",
			before: {
				id: "elem-60",
				elementType: "goal",
				name: "",
				description: "",
				parentId: "original-parent",
			},
			after: {
				id: "elem-60",
				elementType: "goal",
				name: "",
				description: "",
				parentId: "new-parent",
			},
		};

		await applyRedo(command);

		expect(fetch).toHaveBeenCalledWith("/api/elements/elem-60/move", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parentId: "new-parent" }),
		});
	});

	it("does not fetch when after.parentId is absent", async () => {
		const command: HistoryCommand = {
			type: "move",
			elementId: "elem-61",
			elementType: "goal",
			before: null,
			after: {
				id: "elem-61",
				elementType: "goal",
				name: "",
				description: "",
				// parentId intentionally omitted
			},
		};

		await applyRedo(command);

		expect(fetch).not.toHaveBeenCalled();
	});

	it("does not fetch when after is null", async () => {
		const command: HistoryCommand = {
			type: "move",
			elementId: "elem-62",
			elementType: "goal",
			before: null,
			after: null,
		};

		await applyRedo(command);

		expect(fetch).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// applyRedo -- detach
// ---------------------------------------------------------------------------

describe('applyRedo("detach")', () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockOkResponse()));
	});

	it("fetches the detach endpoint with the element_type query parameter", async () => {
		const command: HistoryCommand = {
			type: "detach",
			elementId: "elem-70",
			elementType: "goal",
			before: {
				id: "elem-70",
				elementType: "goal",
				name: "",
				description: "",
				parentId: "former-parent",
			},
			after: null,
		};

		await applyRedo(command);

		expect(fetch).toHaveBeenCalledWith(
			"/api/elements/elem-70/detach?element_type=goal",
			{ method: "POST" }
		);
	});
});

// ---------------------------------------------------------------------------
// applyRedo -- attach
// ---------------------------------------------------------------------------

describe('applyRedo("attach")', () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockOkResponse()));
	});

	it("fetches the attach endpoint with after.parentId", async () => {
		const command: HistoryCommand = {
			type: "attach",
			elementId: "elem-80",
			elementType: "strategy",
			before: null,
			after: {
				id: "elem-80",
				elementType: "strategy",
				name: "",
				description: "",
				parentId: "target-parent",
			},
		};

		await applyRedo(command);

		expect(fetch).toHaveBeenCalledWith("/api/elements/elem-80/attach", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parentId: "target-parent" }),
		});
	});

	it("does not fetch when after.parentId is absent", async () => {
		const command: HistoryCommand = {
			type: "attach",
			elementId: "elem-81",
			elementType: "strategy",
			before: null,
			after: {
				id: "elem-81",
				elementType: "strategy",
				name: "",
				description: "",
				// parentId intentionally omitted
			},
		};

		await applyRedo(command);

		expect(fetch).not.toHaveBeenCalled();
	});

	it("does not fetch when after is null", async () => {
		const command: HistoryCommand = {
			type: "attach",
			elementId: "elem-82",
			elementType: "strategy",
			before: null,
			after: null,
		};

		await applyRedo(command);

		expect(fetch).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// generateOperationDescription
// ---------------------------------------------------------------------------

describe("generateOperationDescription", () => {
	describe('"move" type', () => {
		it("returns the correct label with a name", () => {
			expect(generateOperationDescription("move", "goal", "Moved Goal")).toBe(
				'Moved goal "Moved Goal"'
			);
		});

		it("returns the correct label without a name", () => {
			expect(generateOperationDescription("move", "evidence")).toBe(
				"Moved evidence"
			);
		});

		it("formats property_claim as claim", () => {
			expect(
				generateOperationDescription("move", "property_claim", "My Claim")
			).toBe('Moved claim "My Claim"');
		});
	});

	describe('"detach" type', () => {
		it("returns the correct label with a name", () => {
			expect(
				generateOperationDescription("detach", "strategy", "My Strategy")
			).toBe('Detached strategy "My Strategy"');
		});

		it("returns the correct label without a name", () => {
			expect(generateOperationDescription("detach", "goal")).toBe(
				"Detached goal"
			);
		});

		it("formats property_claim as claim", () => {
			expect(
				generateOperationDescription("detach", "property_claim", "A Claim")
			).toBe('Detached claim "A Claim"');
		});
	});

	describe('"attach" type', () => {
		it("returns the correct label with a name", () => {
			expect(
				generateOperationDescription("attach", "evidence", "My Evidence")
			).toBe('Attached evidence "My Evidence"');
		});

		it("returns the correct label without a name", () => {
			expect(generateOperationDescription("attach", "strategy")).toBe(
				"Attached strategy"
			);
		});

		it("formats property_claim as claim", () => {
			expect(
				generateOperationDescription("attach", "property_claim", "Sub-claim")
			).toBe('Attached claim "Sub-claim"');
		});
	});
});
