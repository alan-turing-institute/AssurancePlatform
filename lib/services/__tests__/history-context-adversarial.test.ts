import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useHistoryStore from "@/store/history-store";
import {
	applyRedo,
	applyUndo,
	createSnapshot,
	recordUpdate,
} from "../history-service";

const BROAD = {
	id: "aaaaaaaaaa",
	name: "window",
	text: "the interval",
	value: "5 minutes",
};

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

describe("an element snapshot taken for undo and redo", () => {
	it("holds named entries with their four fields and nothing a card's data adds", () => {
		const snapshot = createSnapshot({
			id: "e1",
			type: "property",
			name: "P1",
			description: "Within the {window#aaaaaaaaaa}",
			context: [
				"plain",
				{ ...BROAD, hidden: false, childrenHidden: false, stray: [1] },
			],
			termsInReach: [BROAD],
			hidden: false,
		});
		expect(snapshot.context).toEqual(["plain", BROAD]);
		expect(Object.keys(snapshot.context?.[1] as object).sort()).toEqual([
			"id",
			"name",
			"text",
			"value",
		]);
		expect(snapshot.description).toBe("Within the {window#aaaaaaaaaa}");
	});

	it("keeps the variable marker on a named entry", () => {
		const snapshot = createSnapshot({
			id: "e1",
			type: "property",
			name: "P1",
			context: [{ ...BROAD, variable: true, hidden: false }],
		});

		expect(snapshot.context).toEqual([{ ...BROAD, variable: true }]);
	});

	it("leaves context out when the element has none, rather than inventing a list", () => {
		expect(createSnapshot({ id: "e1", name: "P1" }).context).toBeUndefined();
		expect(
			createSnapshot({ id: "e1", name: "P1", context: "text" }).context
		).toBeUndefined();
	});
});

describe("undo and redo of an edit to an element with a named entry", () => {
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

	it("send the entries back exactly, with no key the server's strict check would refuse", async () => {
		const before = {
			id: "e1",
			type: "property",
			name: "P1",
			description: "Before {window#aaaaaaaaaa}",
			context: ["plain", { ...BROAD, hidden: false }],
		};
		const after = {
			...before,
			description: "After {window#aaaaaaaaaa}",
			context: [{ ...BROAD, name: "interval", hidden: false }],
		};
		recordUpdate("e1", "property", before, after);
		const entry = useHistoryStore.getState().undoStack[0];
		const command = entry?.commands[0];
		if (!command) {
			throw new Error("no command was recorded");
		}

		const [undone] = await sentBodies(() => applyUndo(command));
		expect(undone).toMatchObject({
			url: "/api/elements/e1",
			method: "PUT",
			body: {
				description: "Before {window#aaaaaaaaaa}",
				context: ["plain", BROAD],
			},
		});

		const [redone] = await sentBodies(() => applyRedo(command));
		expect(redone).toMatchObject({
			method: "PUT",
			body: {
				description: "After {window#aaaaaaaaaa}",
				context: [{ ...BROAD, name: "interval" }],
			},
		});
	});
	it("send a variable back as it was, and as it became, when its value is changed", async () => {
		const before = {
			id: "e1",
			type: "property",
			name: "P1",
			description: "On {window#aaaaaaaaaa}",
			context: [{ ...BROAD, variable: true }],
		};
		const after = {
			...before,
			context: [{ ...BROAD, value: "10 minutes", variable: true }],
		};
		recordUpdate("e1", "property", before, after);
		const command = useHistoryStore.getState().undoStack[0]?.commands[0];
		if (!command) {
			throw new Error("no command was recorded");
		}

		const [undone] = await sentBodies(() => applyUndo(command));
		const [redone] = await sentBodies(() => applyRedo(command));

		expect(undone?.body.context).toEqual([{ ...BROAD, variable: true }]);
		expect(redone?.body.context).toEqual([
			{ ...BROAD, value: "10 minutes", variable: true },
		]);
	});
});
