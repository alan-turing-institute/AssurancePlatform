// biome-ignore-all lint/performance/useTopLevelRegex: inline patterns keep each assertion readable
import { beforeEach, describe, expect, it, vi } from "vitest";

const exportCase = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/case-export-service", () => ({ exportCase }));

import { resolveSelectedElement, selectionPrompt } from "../selected-element";

const TREE = {
	id: "root",
	type: "GOAL",
	name: "G1",
	description: "Root text",
	children: [
		{
			id: "mid",
			type: "STRATEGY",
			name: "S1",
			description: "Mid text",
			children: [
				{
					id: "deep",
					type: "PROPERTY_CLAIM",
					name: "P1",
					description: "Deep text",
				},
				{ id: "nodesc", type: "EVIDENCE", name: null, description: null },
			],
		},
	],
};

beforeEach(() => {
	exportCase.mockReset();
	exportCase.mockResolvedValue({ data: { case: {}, tree: TREE } });
});

describe("resolveSelectedElement", () => {
	it("looks inside the permission-checked export without comments", async () => {
		await resolveSelectedElement("u1", "c1", "deep");
		expect(exportCase).toHaveBeenCalledWith("u1", "c1", {
			includeComments: false,
		});
	});

	it("finds a nested element and returns its label, type and text", async () => {
		expect(await resolveSelectedElement("u1", "c1", "deep")).toEqual({
			label: "P1",
			type: "PROPERTY_CLAIM",
			text: "Deep text",
		});
	});

	it("gives null, without exporting, when no id is given", async () => {
		expect(await resolveSelectedElement("u1", "c1", undefined)).toBeNull();
		expect(exportCase).not.toHaveBeenCalled();
	});

	it("gives null for an id that is not in the case", async () => {
		expect(await resolveSelectedElement("u1", "c1", "elsewhere")).toBeNull();
	});

	it("gives null when the export is refused", async () => {
		exportCase.mockResolvedValue({ error: "Forbidden" });
		expect(await resolveSelectedElement("u1", "c1", "deep")).toBeNull();
	});

	it("never turns a missing name or description into the word null or undefined", async () => {
		const selection = await resolveSelectedElement("u1", "c1", "nodesc");
		const prompt = selectionPrompt(selection);
		expect(prompt).not.toMatch(/null|undefined/);
		expect(prompt).toContain("The user has selected an element (EVIDENCE): .");
	});
});

describe("selectionPrompt", () => {
	it("is empty without a selection", () => {
		expect(selectionPrompt(null)).toBe("");
	});

	it("states what the user has selected and what 'this claim' means", () => {
		const prompt = selectionPrompt({
			label: "P1",
			type: "PROPERTY_CLAIM",
			text: "Deep text",
		});
		expect(prompt).toContain(
			'The user has selected P1 (PROPERTY_CLAIM): Deep text. "This claim", "this element" and "the selected element" mean it.'
		);
	});
});
