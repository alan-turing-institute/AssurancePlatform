import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useHistoryStore from "@/store/history-store";
import {
	applyRedo,
	applyUndo,
	createSnapshot,
	recordUpdate,
} from "../history-service";

/**
 * Undo and redo of marking a name as a variable, of giving it a value, and of
 * clearing it: each write back to the server carries exactly the entries the
 * element had at that point, flag and value included.
 */

const PLAIN = {
	id: "aaaaaaaaaa",
	name: "system",
	text: "the system under test",
};
const VARIABLE = { ...PLAIN, variable: true as const };
const FILLED = { ...VARIABLE, value: "AcmeBot" };

function resetStore(): void {
	useHistoryStore.setState({
		caseId: null,
		undoStack: [],
		redoStack: [],
		isApplying: false,
	});
}

beforeEach(resetStore);
afterEach(() => {
	vi.restoreAllMocks();
	resetStore();
});

async function sentBodies(run: () => Promise<void>) {
	const fetchMock = vi
		.spyOn(globalThis, "fetch")
		.mockResolvedValue(new Response(null, { status: 200 }));
	fetchMock.mockClear();
	await run();
	return fetchMock.mock.calls.map(([url, init]) => ({
		url: String(url),
		method: init?.method,
		body: JSON.parse(String(init?.body ?? "null")),
	}));
}

function edit(before: unknown[], after: unknown[]) {
	const element = {
		id: "e1",
		type: "property",
		name: "P1",
		description: "Within the {system#aaaaaaaaaa}",
	};
	recordUpdate(
		"e1",
		"property",
		{ ...element, context: before },
		{ ...element, context: after }
	);
	const command = useHistoryStore.getState().undoStack[0]?.commands[0];
	if (!command) {
		throw new Error("no command was recorded");
	}
	return command;
}

describe("a snapshot of an element that defines a variable", () => {
	it("keeps the flag and the value of the entry", () => {
		const snapshot = createSnapshot({
			id: "e1",
			type: "property",
			name: "P1",
			context: [FILLED],
		});
		expect(snapshot.context).toEqual([FILLED]);
	});

	it("keeps the flag of a variable that has no value, and does not invent a value", () => {
		const [entry] = createSnapshot({
			id: "e1",
			name: "P1",
			context: [VARIABLE],
		}).context as Record<string, unknown>[];
		expect(entry).toEqual(VARIABLE);
		expect(entry).not.toHaveProperty("value");
	});

	it.each([
		["false", false],
		["the string true", "true"],
		["null", null],
		["the number one", 1],
	])("does not carry a flag of %s", (_what, flag) => {
		const [entry] = createSnapshot({
			id: "e1",
			name: "P1",
			context: [{ ...PLAIN, value: "x", variable: flag }],
		}).context as Record<string, unknown>[];
		expect(entry).toEqual({ ...PLAIN, value: "x" });
	});

	it("does not carry a stray key beside the flag", () => {
		const [entry] = createSnapshot({
			id: "e1",
			name: "P1",
			context: [{ ...FILLED, hidden: false, termsInReach: [] }],
		}).context as Record<string, unknown>[];
		expect(Object.keys(entry as object).sort()).toEqual([
			"id",
			"name",
			"text",
			"value",
			"variable",
		]);
	});
});

describe("undo and redo of an edit to a variable", () => {
	it("undoes marking a name by sending the entry without the flag, and redoes it with the flag", async () => {
		const command = edit([{ ...PLAIN, value: "AcmeBot" }], [FILLED]);

		const [undone] = await sentBodies(() => applyUndo(command));
		expect(undone?.body.context).toEqual([{ ...PLAIN, value: "AcmeBot" }]);
		expect(undone?.body.context[0]).not.toHaveProperty("variable");

		const [redone] = await sentBodies(() => applyRedo(command));
		expect(redone?.body.context).toEqual([FILLED]);
	});

	it("undoes giving a value by sending the variable without one, and redoes it with the value", async () => {
		const command = edit([VARIABLE], [FILLED]);

		const [undone] = await sentBodies(() => applyUndo(command));
		expect(undone?.body.context).toEqual([VARIABLE]);
		expect(undone?.body.context[0]).not.toHaveProperty("value");

		const [redone] = await sentBodies(() => applyRedo(command));
		expect(redone?.body.context).toEqual([FILLED]);
	});

	it("undoes changing a value and redoes it", async () => {
		const command = edit([FILLED], [{ ...FILLED, value: "BetaBot" }]);

		const [undone] = await sentBodies(() => applyUndo(command));
		expect(undone?.body.context).toEqual([FILLED]);
		const [redone] = await sentBodies(() => applyRedo(command));
		expect(redone?.body.context).toEqual([{ ...FILLED, value: "BetaBot" }]);
	});

	it("undoes unmarking a variable by sending the flag back", async () => {
		const command = edit([FILLED], [{ ...PLAIN, value: "AcmeBot" }]);

		const [undone] = await sentBodies(() => applyUndo(command));
		expect(undone?.body.context).toEqual([FILLED]);
		const [redone] = await sentBodies(() => applyRedo(command));
		expect(redone?.body.context[0]).not.toHaveProperty("variable");
	});

	it("sends a hostile value back exactly as it was", async () => {
		const value =
			"<img src=x onerror=alert(1)> {other#bbbbbbbbbb} } = [system]\nnext";
		const command = edit([{ ...VARIABLE, value }], [FILLED]);

		const [undone] = await sentBodies(() => applyUndo(command));
		expect(undone?.body.context).toEqual([{ ...VARIABLE, value }]);
	});

	it("keeps the description as the stored text with the token in both directions", async () => {
		const command = edit([VARIABLE], [FILLED]);

		const [undone] = await sentBodies(() => applyUndo(command));
		const [redone] = await sentBodies(() => applyRedo(command));
		for (const sent of [undone, redone]) {
			expect(sent?.body.description).toBe("Within the {system#aaaaaaaaaa}");
			expect(JSON.stringify(sent?.body)).not.toContain("[system]");
		}
	});
});
