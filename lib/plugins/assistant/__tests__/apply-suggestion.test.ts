import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import useHistoryStore from "@/store/history-store";
import useStore from "@/store/store";
import { applySuggestion } from "../apply-suggestion";
import type { EditSuggestion, NewElementSuggestion } from "../suggestion";

const CASE_ID = "case-1";

const EDIT: EditSuggestion = {
	suggested: true,
	kind: "edit",
	elementId: "p1",
	elementType: "property_claim",
	label: "P1",
	changes: {
		description: {
			before: "The model is accurate",
			after: "It is accurate to 2%",
		},
	},
};

const NEW_EVIDENCE: NewElementSuggestion = {
	suggested: true,
	kind: "new",
	parentId: "p1",
	parentLabel: "P1",
	parentType: "property_claim",
	childType: "evidence",
	description: "Quarterly test report",
};

/** The element as `GET /api/elements/:id` returns it. */
const element = (overrides: Record<string, unknown> = {}) => ({
	id: "p1",
	type: "property_claim",
	name: "P1",
	description: "The model is accurate",
	assuranceCaseId: CASE_ID,
	inSandbox: false,
	...overrides,
});

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

interface Server {
	/** The JSON body of the request made to this path with this method. */
	bodyOf: (method: string, path: string) => unknown;
	/** Every request made, as "METHOD path". */
	requests: string[];
}

/** Answers the element and case routes from the given responses; any other request is a failure. */
function serve(routes: Record<string, () => Response>): Server {
	const bodies = new Map<string, unknown>();
	const requests: string[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn((url: string, init?: RequestInit) => {
			const key = `${init?.method ?? "GET"} ${url}`;
			requests.push(key);
			if (typeof init?.body === "string") {
				bodies.set(key, JSON.parse(init.body));
			}
			const route = routes[key];
			return Promise.resolve(
				route ? route() : json({ error: "No route" }, 500)
			);
		})
	);
	return {
		requests,
		bodyOf: (method, path) => bodies.get(`${method} ${path}`),
	};
}

const FRESH_CASE = { id: CASE_ID, name: "Fresh", goals: [] };

beforeEach(() => {
	useHistoryStore.setState({ undoStack: [], redoStack: [], isApplying: false });
	useStore.setState({
		assuranceCase: { id: CASE_ID } as AssuranceCaseResponse,
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("applying a rewording", () => {
	it("saves only the changed fields, records the edit for Undo with the stored values, and redraws the case", async () => {
		const server = serve({
			"GET /api/elements/p1": () => json(element({ justification: "Agreed" })),
			"PUT /api/elements/p1": () => json(element()),
			[`GET /api/cases/${CASE_ID}`]: () => json(FRESH_CASE),
		});

		const result = await applySuggestion(CASE_ID, EDIT);

		expect(result).toEqual({ status: "applied" });
		expect(server.bodyOf("PUT", "/api/elements/p1")).toEqual({
			description: "It is accurate to 2%",
		});
		const [entry] = useHistoryStore.getState().undoStack;
		expect(entry?.commands[0]).toMatchObject({
			type: "update",
			elementId: "p1",
			before: { description: "The model is accurate", name: "P1" },
			after: { description: "It is accurate to 2%", name: "P1" },
		});
		await vi.waitFor(() =>
			expect(useStore.getState().assuranceCase).toMatchObject({ name: "Fresh" })
		);
	});

	it("records a placeholder in a case as marked before the edit and not marked after it", async () => {
		useStore.setState({
			assuranceCase: { id: CASE_ID, kind: "CASE" } as AssuranceCaseResponse,
		});
		serve({
			"GET /api/elements/p1": () =>
				json(
					element({
						description: "",
						isPlaceholder: true,
						placeholderHint: "Say what the claim asserts",
					})
				),
			"PUT /api/elements/p1": () => json(element()),
			[`GET /api/cases/${CASE_ID}`]: () => json(FRESH_CASE),
		});

		await applySuggestion(CASE_ID, {
			...EDIT,
			changes: { description: { before: "", after: "It is accurate to 2%" } },
		});

		const [entry] = useHistoryStore.getState().undoStack;
		expect(entry?.commands[0]).toMatchObject({
			before: {
				description: "",
				isPlaceholder: true,
				placeholderHint: "Say what the claim asserts",
			},
			after: { description: "It is accurate to 2%", isPlaceholder: false },
		});
		// The redraw of the case is still in flight; let it land inside this test.
		await vi.waitFor(() =>
			expect(useStore.getState().assuranceCase).toMatchObject({ name: "Fresh" })
		);
	});

	it("refuses and saves nothing when the element was reworded after the suggestion", async () => {
		const server = serve({
			"GET /api/elements/p1": () =>
				json(element({ description: "Someone else reworded this" })),
		});

		const result = await applySuggestion(CASE_ID, EDIT);

		expect(result).toEqual({ status: "changed" });
		expect(server.requests).toEqual(["GET /api/elements/p1"]);
		expect(useHistoryStore.getState().undoStack).toEqual([]);
	});

	it("compares after trimming, and reads a missing value as empty", async () => {
		const server = serve({
			"GET /api/elements/p1": () =>
				json(
					element({
						description: "  The model is accurate\n",
						assumption: null,
					})
				),
			"PUT /api/elements/p1": () => json(element()),
			[`GET /api/cases/${CASE_ID}`]: () => json(FRESH_CASE),
		});

		const result = await applySuggestion(CASE_ID, {
			...EDIT,
			changes: {
				...EDIT.changes,
				assumption: { before: "", after: "Test data is representative" },
			},
		});

		expect(result).toEqual({ status: "applied" });
		expect(server.bodyOf("PUT", "/api/elements/p1")).toEqual({
			description: "It is accurate to 2%",
			assumption: "Test data is representative",
		});
	});

	it("treats an element that is gone, or in another case, as changed", async () => {
		serve({ "GET /api/elements/p1": () => json({ error: "Not found" }, 404) });
		expect(await applySuggestion(CASE_ID, EDIT)).toEqual({ status: "changed" });

		serve({
			"GET /api/elements/p1": () =>
				json(element({ assuranceCaseId: "case-2" })),
		});
		expect(await applySuggestion(CASE_ID, EDIT)).toEqual({ status: "changed" });
	});

	it("treats a response that does not say which case the element is in as unreadable, and saves nothing", async () => {
		const { assuranceCaseId: _omitted, ...withoutCase } = element();
		const server = serve({
			"GET /api/elements/p1": () => json(withoutCase),
		});

		for (const suggestion of [EDIT, NEW_EVIDENCE]) {
			expect(await applySuggestion(CASE_ID, suggestion)).toMatchObject({
				status: "failed",
				message: expect.stringContaining("could not be read"),
			});
		}

		expect(new Set(server.requests)).toEqual(new Set(["GET /api/elements/p1"]));
		expect(useHistoryStore.getState().undoStack).toEqual([]);
	});

	it("compares a context list entry by entry", async () => {
		serve({
			"GET /api/elements/p1": () =>
				json(
					element({
						context: ["Hospital A", { id: "k3f9x2m7qa", name: "w", text: "t" }],
					})
				),
		});

		const result = await applySuggestion(CASE_ID, {
			...EDIT,
			changes: {
				context: { before: ["Hospital A", "t"], after: ["Hospital A"] },
			},
		});

		expect(result).toEqual({ status: "changed" });
	});

	it("reports a failed read or save with the server's reason, saves nothing it could not, and keeps the history clean", async () => {
		serve({ "GET /api/elements/p1": () => json({ error: "Boom" }, 500) });
		expect(await applySuggestion(CASE_ID, EDIT)).toMatchObject({
			status: "failed",
			message: expect.stringContaining("could not be read"),
		});

		serve({
			"GET /api/elements/p1": () => json(element()),
			"PUT /api/elements/p1": () =>
				json({ error: "Description must be less than 5000 characters" }, 400),
		});
		expect(await applySuggestion(CASE_ID, EDIT)).toEqual({
			status: "failed",
			message: "Description must be less than 5000 characters",
		});
		expect(useHistoryStore.getState().undoStack).toEqual([]);
	});
});

describe("applying a new element", () => {
	it("creates it beneath the parent without a label, records the creation for Undo, and redraws the case", async () => {
		const server = serve({
			"GET /api/elements/p1": () => json(element()),
			[`POST /api/cases/${CASE_ID}/elements`]: () =>
				json(
					{
						id: "e9",
						type: "evidence",
						name: "E3",
						description: "Quarterly test report",
					},
					201
				),
			[`GET /api/cases/${CASE_ID}`]: () => json(FRESH_CASE),
		});

		const result = await applySuggestion(CASE_ID, NEW_EVIDENCE);

		expect(result).toEqual({ status: "applied" });
		expect(server.bodyOf("POST", `/api/cases/${CASE_ID}/elements`)).toEqual({
			description: "Quarterly test report",
			parentId: "p1",
			type: "evidence",
		});
		const [entry] = useHistoryStore.getState().undoStack;
		expect(entry?.commands[0]).toMatchObject({
			type: "create",
			elementId: "e9",
			elementType: "evidence",
			after: { name: "E3" },
		});
		await vi.waitFor(() =>
			expect(useStore.getState().assuranceCase).toMatchObject({ name: "Fresh" })
		);
	});

	it("refuses and creates nothing when the parent no longer accepts that child", async () => {
		const server = serve({
			"GET /api/elements/p1": () => json(element({ type: "evidence" })),
		});

		const result = await applySuggestion(CASE_ID, NEW_EVIDENCE);

		expect(result).toEqual({ status: "changed" });
		expect(server.requests).toEqual(["GET /api/elements/p1"]);
	});

	it("refuses when the parent has been deleted", async () => {
		serve({ "GET /api/elements/p1": () => json({ error: "Not found" }, 404) });

		expect(await applySuggestion(CASE_ID, NEW_EVIDENCE)).toEqual({
			status: "changed",
		});
	});

	it("reports the server's reason when the creation is refused", async () => {
		serve({
			"GET /api/elements/p1": () => json(element()),
			[`POST /api/cases/${CASE_ID}/elements`]: () =>
				json({ error: "Permission denied" }, 403),
		});

		expect(await applySuggestion(CASE_ID, NEW_EVIDENCE)).toEqual({
			status: "failed",
			message: "Permission denied",
		});
		expect(useHistoryStore.getState().undoStack).toEqual([]);
	});
});

interface RecordedCommand {
	after: Record<string, unknown>;
	before: Record<string, unknown>;
}

/** Applies an edit to the element and returns what the first Undo entry recorded. */
async function applyAndRecord(
	overrides: Record<string, unknown>,
	changes: EditSuggestion["changes"]
): Promise<RecordedCommand> {
	serve({
		"GET /api/elements/p1": () => json(element(overrides)),
		"PUT /api/elements/p1": () => json(element()),
		[`GET /api/cases/${CASE_ID}`]: () => json(FRESH_CASE),
	});
	await applySuggestion(CASE_ID, { ...EDIT, changes });
	await vi.waitFor(() => {
		if (useStore.getState().assuranceCase?.name !== "Fresh") {
			throw new Error("The case has not been redrawn yet");
		}
	});
	return useHistoryStore.getState().undoStack[0]
		?.commands[0] as unknown as RecordedCommand;
}

describe("what the Undo entry records for text the element has not got", () => {
	it.each([
		["assumption", "missing", {}, ""],
		["assumption", "null", { assumption: null }, ""],
		[
			"assumption",
			"filled",
			{ assumption: "Old assumption" },
			"Old assumption",
		],
		["justification", "missing", {}, ""],
		["justification", "null", { justification: null }, ""],
		["justification", "filled", { justification: "Old reason" }, "Old reason"],
	] as const)("spells the %s out when it is %s", async (field, _state, overrides, stored) => {
		const recorded = await applyAndRecord(overrides, {
			[field]: { before: stored, after: "New text" },
		});

		expect(recorded.before[field]).toBe(stored);
		expect(recorded.after[field]).toBe("New text");
	});

	it("leaves out the fields the suggestion does not change", async () => {
		const recorded = await applyAndRecord(
			{},
			{ description: EDIT.changes.description }
		);

		expect(recorded.before.assumption).toBeUndefined();
		expect(recorded.before.justification).toBeUndefined();
		expect(recorded.before.context).toBeUndefined();
	});
});

describe("when the read or the save does not go through", () => {
	it("treats an answer that is not OK as unreadable even when its body is an element, and saves nothing", async () => {
		const server = serve({
			"GET /api/elements/p1": () => json(element(), 500),
		});

		expect(await applySuggestion(CASE_ID, EDIT)).toMatchObject({
			status: "failed",
			message: expect.stringContaining("could not be read"),
		});
		expect(server.requests).toEqual(["GET /api/elements/p1"]);
	});

	it("treats a read that cannot be made as unreadable", async () => {
		serve({
			"GET /api/elements/p1": () => {
				throw new Error("offline");
			},
		});

		expect(await applySuggestion(CASE_ID, NEW_EVIDENCE)).toMatchObject({
			status: "failed",
			message: expect.stringContaining("could not be read"),
		});
	});

	it.each([
		["an error object", new Error("offline")],
		["nothing at all", undefined],
	])("reports a new element whose creation could not be sent, when the cause is %s", async (_name, cause) => {
		serve({
			"GET /api/elements/p1": () => json(element()),
			[`POST /api/cases/${CASE_ID}/elements`]: () => {
				throw cause;
			},
		});

		const result = await applySuggestion(CASE_ID, NEW_EVIDENCE);

		expect(result).toMatchObject({ status: "failed" });
		const message = "message" in result ? result.message : undefined;
		expect(typeof message).toBe("string");
		expect(message).not.toBe("");
		expect(useHistoryStore.getState().undoStack).toEqual([]);
	});
});

describe("redrawing the case after a save", () => {
	it("does not report a failure to read the case when the canvas shows no case", async () => {
		const logging = await import("@/lib/logger");
		const entries: { level: string }[] = [];
		vi.stubEnv("LOG_LEVEL", "debug");
		logging.setLogSink((entry) => entries.push(entry));
		let caseRead = false;
		serve({
			"GET /api/elements/p1": () => json(element()),
			"PUT /api/elements/p1": () => json(element()),
			[`GET /api/cases/${CASE_ID}`]: () => {
				caseRead = true;
				return json(FRESH_CASE);
			},
		});
		useStore.setState({ assuranceCase: null });

		try {
			expect(await applySuggestion(CASE_ID, EDIT)).toEqual({
				status: "applied",
			});
			await vi.waitFor(() => expect(caseRead).toBe(true));
			await vi.waitFor(() =>
				expect(useStore.getState().assuranceCase).toBeNull()
			);
			for (let turn = 0; turn < 50; turn += 1) {
				await Promise.resolve();
			}

			expect(entries.filter((entry) => entry.level === "warn")).toEqual([]);
			expect(useStore.getState().assuranceCase).toBeNull();
		} finally {
			logging.resetLogSink();
			vi.unstubAllEnvs();
		}
	});
});
