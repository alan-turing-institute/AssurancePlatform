import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseSuggestionResult } from "@/lib/plugins/assistant/suggestion";
import {
	buildSystemPrompt,
	createCaseTools,
} from "@/lib/plugins/assistant/tools";
import { exportCase } from "@/lib/services/case-export-service";

vi.mock("@/lib/services/case-export-service", () => ({
	exportCase: vi.fn(),
}));
vi.mock("@/lib/services/health-status-service", () => ({
	readHealthStatusesForCase: vi.fn(),
}));

const SELECT_THE_ELEMENT = /select/i;
const TERM = "{window#k3f9x2m7qa}";
const NAMED = { id: "k3f9x2m7qa", name: "window", text: "five minutes" };
const READ_ONLY_LIST = /read-only tools: ([^.]*)\./;
const options = { toolCallId: "t", messages: [] };

function el(
	id: string,
	type: string,
	name: string,
	extra: Record<string, unknown> = {},
	children: unknown[] = []
) {
	return {
		id,
		type,
		name,
		description: `${name} text`,
		inSandbox: false,
		children,
		...extra,
	};
}

const SHARED_EVIDENCE = el("ev-1", "EVIDENCE", "E1");

function caseTree() {
	return el("g-1", "GOAL", "G1", {}, [
		el("p-1", "PROPERTY_CLAIM", "P1", {
			description: `Operators must close the ${TERM} promptly`,
		}),
		el("p-2", "PROPERTY_CLAIM", "P2", { context: [NAMED, "Another"] }),
		el("p-3", "PROPERTY_CLAIM", "P3", { assumption: "Stays dry" }, [
			SHARED_EVIDENCE,
		]),
		el("p-4", "PROPERTY_CLAIM", "P4", {}, [SHARED_EVIDENCE]),
		el("p-5", "PROPERTY_CLAIM", "P5"),
		el("p-6", "PROPERTY_CLAIM", "P5"),
		el("ag-1", "AWAY_GOAL", "AG1"),
		el("mod-1", "MODULE", "M1"),
	]);
}

function exported(tree = caseTree()) {
	return {
		data: {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			case: { name: "Case", description: "d" },
			tree,
		},
	} as never;
}

beforeEach(() => {
	vi.mocked(exportCase).mockReset();
	vi.mocked(exportCase).mockResolvedValue(exported());
});

function tools() {
	const all = createCaseTools("u", "c", { suggestions: true });
	if (!(all.suggest_edit && all.suggest_new_element)) {
		throw new Error("The suggestion tools were not registered");
	}
	return {
		...all,
		suggest_edit: all.suggest_edit,
		suggest_new_element: all.suggest_new_element,
	};
}

async function edit(input: Record<string, unknown>) {
	return await tools().suggest_edit.execute?.(input as never, options);
}

async function add(input: Record<string, unknown>) {
	return await tools().suggest_new_element.execute?.(input as never, options);
}

describe("suggest_edit reads the case as it is stored", () => {
	it.each([
		[
			"a description that refers to a defined term",
			"p-1",
			{ description: "Reworded" },
		],
		["a context list that defines a term", "p-2", { context: ["Replaced"] }],
	])("refuses to reword %s, though the model reads it as plain text", async (_what, id, change) => {
		const read = await createCaseTools("u", "c").read_element.execute?.(
			{ elementId: id },
			options
		);
		const result = await edit({ elementId: id, ...change });

		expect(JSON.stringify(read)).not.toContain("k3f9x2m7qa");
		expect(result).toMatchObject({ suggested: false });
	});
});

describe("suggest_edit and suggest_new_element find the element", () => {
	it("refuses a label that two different elements share, and asks the user to select the element", async () => {
		const result = await edit({ elementId: "P5", description: "New" });

		expect(result).toMatchObject({ suggested: false });
		expect(JSON.stringify(result)).toMatch(SELECT_THE_ELEMENT);
	});

	it("refuses a parent label that two elements share for a new element too", async () => {
		const result = await add({
			parentId: "P5",
			type: "evidence",
			description: "A report",
		});

		expect(result).toMatchObject({ suggested: false });
	});

	it.each([
		["suggest_edit", { elementId: "nope", description: "New" }],
		[
			"suggest_new_element",
			{ parentId: "nope", type: "strategy", description: "New" },
		],
	])("answers %s about an unknown element with a refusal the card can show", async (name, input) => {
		const result = await (name === "suggest_edit" ? edit(input) : add(input));

		expect(parseSuggestionResult(result)).toMatchObject({ suggested: false });
	});

	it.each([
		["an away goal", "ag-1"],
		["a module", "mod-1"],
	])("refuses to reword %s", async (_what, id) => {
		expect(await edit({ elementId: id, description: "New" })).toMatchObject({
			suggested: false,
		});
	});

	it.each([
		["an away goal", "ag-1"],
		["a module", "mod-1"],
		["evidence", "ev-1"],
	])("refuses to put anything beneath %s", async (_what, id) => {
		expect(
			await add({ parentId: id, type: "property_claim", description: "New" })
		).toMatchObject({ suggested: false });
	});

	it("refuses evidence directly beneath a goal", async () => {
		expect(
			await add({ parentId: "g-1", type: "evidence", description: "New" })
		).toMatchObject({ suggested: false });
	});
});

describe("the suggestion tools change nothing and read once", () => {
	it("leaves the case export as it was and reads it once for any number of calls", async () => {
		const before = JSON.stringify(caseTree());
		const all = tools();
		const stored = (await exportCase("u", "c")) as unknown as {
			data: { tree: unknown };
		};
		vi.mocked(exportCase).mockClear();

		await all.read_case.execute?.({}, options);
		await all.suggest_edit.execute?.(
			{ elementId: "p-3", assumption: "Changed" } as never,
			options
		);
		await all.suggest_new_element.execute?.(
			{ parentId: "p-3", type: "strategy", description: "New" } as never,
			options
		);

		expect(exportCase).toHaveBeenCalledTimes(1);
		expect(exportCase).toHaveBeenCalledWith("u", "c", {
			includeComments: false,
		});
		expect(JSON.stringify(stored.data.tree)).toBe(before);
	});

	it("never carries a label or a status in what it returns, even if asked for one", async () => {
		const result = await edit({
			elementId: "p-3",
			description: "New wording",
			name: "P99",
			assertionStatus: "ASSUMED",
		});

		expect(JSON.stringify(result)).not.toContain("P99");
		expect(JSON.stringify(result)).not.toContain("ASSUMED");
	});
});

describe("the suggestion tools when the case cannot be read", () => {
	it("does not hand the model the message of an error the export throws", async () => {
		vi.mocked(exportCase).mockRejectedValue(
			new Error("connect ECONNREFUSED db.internal.example:5432")
		);

		const results = [
			await edit({ elementId: "p-3", description: "x" }),
			await add({ parentId: "p-3", type: "strategy", description: "x" }),
		];

		expect(JSON.stringify(results)).not.toContain("internal.example");
		for (const result of results) {
			expect(parseSuggestionResult(result)?.suggested).not.toBe(true);
		}
	});
});

describe("the system prompt with the suggestion tools", () => {
	it("lists the read tools, including suggest_techniques, and not the suggestion tools, as read-only", () => {
		const prompt = buildSystemPrompt([
			"read_case",
			"read_element",
			"lint_case",
			"suggest_techniques",
			"suggest_edit",
			"suggest_new_element",
		]);
		const listed = READ_ONLY_LIST.exec(prompt)?.[1] ?? "";

		expect(listed).toBe(
			"read_case, read_element, lint_case, suggest_techniques"
		);
	});

	it("keeps the read-only wording, and names no suggestion tool, when only the techniques tool is added", () => {
		const prompt = buildSystemPrompt([
			"read_case",
			"read_element",
			"lint_case",
			"suggest_techniques",
		]);

		expect(prompt).toContain("You cannot change the case.");
		expect(prompt).not.toContain("suggest_edit");
		expect(prompt).not.toContain("suggest_new_element");
		expect(READ_ONLY_LIST.exec(prompt)?.[1]).toContain("suggest_techniques");
	});
});
