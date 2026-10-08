import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	resolveSelectedElement,
	selectionPrompt,
} from "@/lib/plugins/assistant/selected-element";
import { exportCase } from "@/lib/services/case-export-service";

vi.mock("@/lib/services/case-export-service", () => ({
	exportCase: vi.fn(),
}));

const tree = {
	id: "g1",
	type: "GOAL",
	name: "G1",
	description: "top",
	children: [
		{
			id: "p1",
			type: "PROPERTY_CLAIM",
			name: "P1",
			description: "The model is robust to noise",
			children: [],
		},
	],
};

beforeEach(() => {
	vi.mocked(exportCase).mockResolvedValue({
		data: { case: { name: "C", description: "d" }, tree },
	} as never);
});

describe("selected element in the prompt", () => {
	it("puts the label, type and text of a valid id in the prompt", async () => {
		const selection = await resolveSelectedElement("u", "c", "p1");

		expect(exportCase).toHaveBeenCalledWith("u", "c", {
			includeComments: false,
		});
		const prompt = selectionPrompt(selection);
		expect(prompt).toContain(
			"P1 (PROPERTY_CLAIM): The model is robust to noise"
		);
		expect(prompt).toContain("the selected element");
	});

	it("adds nothing for an id that is not in the case", async () => {
		const selection = await resolveSelectedElement("u", "c", "foreign");

		expect(selection).toBeNull();
		expect(selectionPrompt(selection)).toBe("");
	});
});
