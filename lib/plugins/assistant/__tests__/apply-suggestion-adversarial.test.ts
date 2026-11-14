import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applySuggestion } from "@/lib/plugins/assistant/apply-suggestion";
import type { Suggestion } from "@/lib/plugins/assistant/suggestion";
import { applyRedo, applyUndo } from "@/lib/services/history-service";
import useHistoryStore from "@/store/history-store";

const CASE_ID = "case-1";
const NAMED = { id: "k3f9x2m7qa", name: "window", text: "five minutes" };

interface Call {
	body: Record<string, unknown> | undefined;
	method: string;
	url: string;
}

type Handler = (call: Call) => Response | Promise<Response>;

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/** A fake server: handlers by "METHOD /path"; anything else is a 404. */
function serve(handlers: Record<string, Handler>) {
	const calls: Call[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string, init?: RequestInit) => {
			const call: Call = {
				url,
				method: init?.method ?? "GET",
				body:
					typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
			};
			calls.push(call);
			const handler = handlers[`${call.method} ${url}`];
			return handler ? await handler(call) : json({ error: "Not found" }, 404);
		})
	);
	return calls;
}

function writes(calls: Call[]) {
	return calls.filter((call) => call.method !== "GET");
}

function serverElement(overrides: Record<string, unknown> = {}) {
	return {
		id: "e1",
		type: "property_claim",
		name: "P1",
		description: "Old description",
		assuranceCaseId: CASE_ID,
		inSandbox: false,
		...overrides,
	};
}

function edit(
	changes: Extract<Suggestion, { kind: "edit" }>["changes"]
): Suggestion {
	return {
		suggested: true,
		kind: "edit",
		elementId: "e1",
		elementType: "property_claim",
		label: "P1",
		changes,
	};
}

function addition(
	childType: "strategy" | "property_claim" | "evidence",
	parentType = "property_claim"
): Suggestion {
	return {
		suggested: true,
		kind: "new",
		parentId: "p1",
		parentLabel: "P1",
		parentType,
		childType,
		description: "New text",
	};
}

const DESCRIPTION = edit({
	description: { before: "Old description", after: "New description" },
});

const PUT_E1 = "PUT /api/elements/e1";
const GET_E1 = "GET /api/elements/e1";
const GET_P1 = "GET /api/elements/p1";
const POST_ELEMENTS = `POST /api/cases/${CASE_ID}/elements`;

function undoStack() {
	return useHistoryStore.getState().undoStack;
}

beforeEach(() => {
	useHistoryStore.setState({
		caseId: null,
		undoStack: [],
		redoStack: [],
		isApplying: false,
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("applySuggestion: what a rewording saves", () => {
	it("re-reads the element before it writes, and sends only the changed field", async () => {
		const calls = serve({
			[GET_E1]: () => json(serverElement()),
			[PUT_E1]: () => json({}),
		});

		const result = await applySuggestion(CASE_ID, DESCRIPTION);

		expect(result).toEqual({ status: "applied" });
		expect(
			calls.map((call) => `${call.method} ${call.url}`).slice(0, 2)
		).toEqual([GET_E1, PUT_E1]);
		expect(calls[1]?.body).toEqual({ description: "New description" });
	});

	it("sends no label, status, sandbox flag or link along with any combination of fields", async () => {
		const calls = serve({
			[GET_E1]: () =>
				json(
					serverElement({
						assumption: "Old assumption",
						justification: "Old justification",
						context: ["one"],
						assertionStatus: "ASSUMED",
					})
				),
			[PUT_E1]: () => json({}),
		});

		await applySuggestion(
			CASE_ID,
			edit({
				description: { before: "Old description", after: "New description" },
				assumption: { before: "Old assumption", after: "New assumption" },
				justification: {
					before: "Old justification",
					after: "New justification",
				},
				context: { before: ["one"], after: ["one", "two"] },
			})
		);

		const body = writes(calls)[0]?.body ?? {};
		expect(Object.keys(body).sort()).toEqual([
			"assumption",
			"context",
			"description",
			"justification",
		]);
		expect(body).not.toHaveProperty("name");
		expect(body).not.toHaveProperty("assertionStatus");
	});

	it.each([
		["text with spaces around it", { description: "  Old description \n" }],
		["a missing assumption read as empty", {}],
		["a null assumption read as empty", { assumption: null }],
		["a blank assumption read as empty", { assumption: "   " }],
	])("applies when the element holds %s", async (_what, current) => {
		const calls = serve({
			[GET_E1]: () => json(serverElement(current)),
			[PUT_E1]: () => json({}),
		});

		const result = await applySuggestion(
			CASE_ID,
			edit({
				description: { before: "Old description", after: "New description" },
				assumption: { before: "", after: "A first assumption" },
			})
		);

		expect(result).toEqual({ status: "applied" });
		expect(writes(calls)).toHaveLength(1);
	});
});

describe("applySuggestion: refuses when the element has changed", () => {
	it.each([
		[
			"the description differs by a character",
			{ description: "Old descriptioN" },
		],
		["an assumption was added", { assumption: "Someone added this" }],
		["the description was edited", { description: "Edited by someone" }],
	])("saves nothing when %s", async (_what, current) => {
		const calls = serve({
			[GET_E1]: () => json(serverElement(current)),
			[PUT_E1]: () => json({}),
		});

		const result = await applySuggestion(
			CASE_ID,
			edit({
				description: { before: "Old description", after: "New description" },
				assumption: { before: "", after: "A first assumption" },
			})
		);

		expect(result).toEqual({ status: "changed" });
		expect(writes(calls)).toEqual([]);
		expect(undoStack()).toHaveLength(0);
		expect(calls.map((call) => call.url)).not.toContain(
			`/api/cases/${CASE_ID}`
		);
	});

	it("saves nothing when only one of two changed fields has been edited since", async () => {
		const calls = serve({
			[GET_E1]: () =>
				json(serverElement({ justification: "Edited in another tab" })),
			[PUT_E1]: () => json({}),
		});

		const result = await applySuggestion(
			CASE_ID,
			edit({
				description: { before: "Old description", after: "New description" },
				justification: { before: "Old justification", after: "New one" },
			})
		);

		expect(result).toEqual({ status: "changed" });
		expect(writes(calls)).toEqual([]);
	});

	it.each([
		["entries in a different order", ["two", "one"]],
		["an entry added", ["one", "two", "three"]],
		["an entry removed", ["one"]],
		["an entry changed", ["one", "TWO"]],
		["an entry turned into a named entry", ["one", NAMED]],
		["no entries", undefined],
	])("saves nothing when the context list has %s", async (_what, context) => {
		const calls = serve({
			[GET_E1]: () => json(serverElement({ context })),
			[PUT_E1]: () => json({}),
		});

		const result = await applySuggestion(
			CASE_ID,
			edit({ context: { before: ["one", "two"], after: ["new"] } })
		);

		expect(result).toEqual({ status: "changed" });
		expect(writes(calls)).toEqual([]);
	});

	it("applies when the context entries differ from the list suggested on only by spaces around them", async () => {
		const calls = serve({
			[GET_E1]: () => json(serverElement({ context: [" one", "two "] })),
			[PUT_E1]: () => json({}),
		});

		const result = await applySuggestion(
			CASE_ID,
			edit({ context: { before: ["one", "two"], after: ["new"] } })
		);

		expect(result).toEqual({ status: "applied" });
		expect(writes(calls)[0]?.body).toEqual({ context: ["new"] });
	});

	it.each([
		["the server fails", () => json({ error: "boom" }, 500)],
		["the reply is not an element", () => json({ unexpected: true })],
		["the reply is not JSON", () => new Response("<html>", { status: 200 })],
		[
			"the network fails",
			() => {
				throw new TypeError("network down");
			},
		],
	])("fails without saving, and does not call it a change, when %s", async (_what, reply) => {
		const calls = serve({ [GET_E1]: reply, [PUT_E1]: () => json({}) });

		const result = await applySuggestion(CASE_ID, DESCRIPTION);

		expect(result.status).toBe("failed");
		expect(writes(calls)).toEqual([]);
		expect(undoStack()).toHaveLength(0);
	});
});

describe("applySuggestion: undo is recorded only for a saved change", () => {
	it("records nothing while the save is still running, and one update once it has gone through", async () => {
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const calls = serve({
			[GET_E1]: () => json(serverElement()),
			[PUT_E1]: async () => {
				await gate;
				return json({});
			},
		});

		const pending = applySuggestion(CASE_ID, DESCRIPTION);
		await vi.waitFor(() => expect(writes(calls)).toHaveLength(1));
		expect(undoStack()).toHaveLength(0);
		release();
		await pending;

		expect(undoStack()).toHaveLength(1);
		expect(undoStack()[0]?.commands[0]).toMatchObject({
			type: "update",
			elementId: "e1",
			before: { description: "Old description" },
			after: { description: "New description" },
		});
	});

	it("records nothing, and does not redraw the diagram, when the server refuses the save", async () => {
		const calls = serve({
			[GET_E1]: () => json(serverElement()),
			[PUT_E1]: () => json({ error: "You do not have permission" }, 403),
		});

		const result = await applySuggestion(CASE_ID, DESCRIPTION);

		expect(result).toEqual({
			status: "failed",
			message: "You do not have permission",
		});
		expect(undoStack()).toHaveLength(0);
		expect(calls.map((call) => call.url)).not.toContain(
			`/api/cases/${CASE_ID}`
		);
	});

	it("reads the case again after a save so the diagram redraws", async () => {
		const calls = serve({
			[GET_E1]: () => json(serverElement()),
			[PUT_E1]: () => json({}),
		});

		await applySuggestion(CASE_ID, DESCRIPTION);

		const urls = calls.map((call) => `${call.method} ${call.url}`);
		expect(urls.indexOf(`GET /api/cases/${CASE_ID}`)).toBeGreaterThan(
			urls.indexOf(PUT_E1)
		);
	});
});

describe("applySuggestion: Undo and Redo of a reworded element", () => {
	it("puts the old text back on Undo and the new text back on Redo", async () => {
		serve({
			[GET_E1]: () => json(serverElement()),
			[PUT_E1]: () => json({}),
		});
		await applySuggestion(CASE_ID, DESCRIPTION);
		const command = undoStack()[0]?.commands[0];
		if (!command) {
			throw new Error("Nothing was recorded for Undo");
		}
		const calls = serve({ [PUT_E1]: () => json({}) });

		await applyUndo(command);
		await applyRedo(command);

		expect(calls[0]?.body).toMatchObject({ description: "Old description" });
		expect(calls[1]?.body).toMatchObject({ description: "New description" });
	});

	// Undo needs the old context list in the saved entry. The element read
	// back leaves the list out when it is empty, so an Undo that sends the
	// saved entry back cannot empty the list the suggestion filled.
	it("empties a context list on Undo when the suggestion added the first entries", async () => {
		serve({
			[GET_E1]: () => json(serverElement()),
			[PUT_E1]: () => json({}),
		});
		await applySuggestion(
			CASE_ID,
			edit({ context: { before: [], after: ["A new entry"] } })
		);
		const command = undoStack()[0]?.commands[0];
		if (!command) {
			throw new Error("Nothing was recorded for Undo");
		}
		const calls = serve({ [PUT_E1]: () => json({}) });

		await applyUndo(command);

		expect(calls[0]?.body).toMatchObject({ context: [] });
	});
});

describe("applySuggestion: a new element", () => {
	it.each([
		["strategy", "strategy"],
		["property_claim", "property_claim"],
		["evidence", "evidence"],
	] as const)("creates a %s beneath the parent with its text and nothing else of its own", async (childType, type) => {
		const calls = serve({
			[GET_P1]: () => json(serverElement({ id: "p1", type: "property_claim" })),
			[POST_ELEMENTS]: () => json({ id: "new-1", name: "X1" }),
		});

		const result = await applySuggestion(CASE_ID, addition(childType));

		expect(result).toEqual({ status: "applied" });
		const created = writes(calls)[0]?.body ?? {};
		expect(created).toEqual({
			description: "New text",
			parentId: "p1",
			type,
		});
	});

	it("reads the parent before it writes", async () => {
		const calls = serve({
			[GET_P1]: () => json(serverElement({ id: "p1" })),
			[POST_ELEMENTS]: () => json({ id: "new-1" }),
		});

		await applySuggestion(CASE_ID, addition("evidence"));

		expect(calls.map((call) => call.method)[0]).toBe("GET");
		expect(calls[0]?.url).toBe("/api/elements/p1");
	});

	it.each([
		["the parent is gone", {}],
		[
			"the parent is now evidence",
			{ [GET_P1]: () => json(serverElement({ id: "p1", type: "evidence" })) },
		],
		[
			"the parent is now an away goal",
			{ [GET_P1]: () => json(serverElement({ id: "p1", type: "away_goal" })) },
		],
		[
			"the parent is in another case",
			{
				[GET_P1]: () =>
					json(serverElement({ id: "p1", assuranceCaseId: "case-2" })),
			},
		],
	])("creates nothing when %s", async (_what, handlers) => {
		const calls = serve({
			...handlers,
			[POST_ELEMENTS]: () => json({ id: "n" }),
		});

		const result = await applySuggestion(CASE_ID, addition("evidence"));

		expect(result).toEqual({ status: "changed" });
		expect(writes(calls)).toEqual([]);
		expect(undoStack()).toHaveLength(0);
	});

	it("creates nothing under a goal that now holds the wrong kind of child", async () => {
		const calls = serve({
			[GET_P1]: () => json(serverElement({ id: "p1", type: "goal" })),
			[POST_ELEMENTS]: () => json({ id: "n" }),
		});

		const result = await applySuggestion(CASE_ID, addition("evidence", "goal"));

		expect(result).toEqual({ status: "changed" });
		expect(writes(calls)).toEqual([]);
	});

	it("records the creation for Undo only once it is saved, and Undo removes that element", async () => {
		const calls = serve({
			[GET_P1]: () => json(serverElement({ id: "p1" })),
			[POST_ELEMENTS]: () => json({ id: "new-1", name: "E1" }),
		});

		await applySuggestion(CASE_ID, addition("evidence"));
		const command = undoStack()[0]?.commands[0];
		if (!command) {
			throw new Error("Nothing was recorded for Undo");
		}
		await applyUndo(command);

		expect(command).toMatchObject({ type: "create", elementId: "new-1" });
		expect(calls.at(-1)).toMatchObject({
			method: "DELETE",
			url: "/api/elements/new-1",
		});
	});

	it("fails without recording anything when the server refuses the new element", async () => {
		const calls = serve({
			[GET_P1]: () => json(serverElement({ id: "p1" })),
			[POST_ELEMENTS]: () => json({ error: "Description is too long" }, 400),
		});

		const result = await applySuggestion(CASE_ID, addition("strategy"));

		expect(result).toEqual({
			status: "failed",
			message: "Description is too long",
		});
		expect(undoStack()).toHaveLength(0);
		expect(calls.map((call) => call.url)).not.toContain(
			`/api/cases/${CASE_ID}`
		);
	});
});
