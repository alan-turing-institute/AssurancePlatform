import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import { exportCase } from "@/lib/services/case-export-service";

vi.mock("@/lib/services/case-export-service", () => ({
	exportCase: vi.fn(),
}));

const TREE = {
	id: "g1",
	type: "GOAL",
	name: "G1",
	description: "top",
	children: [
		{
			id: "p1",
			type: "PROPERTY_CLAIM",
			name: "P1",
			description: "claim",
			children: [
				{
					id: "e1",
					type: "EVIDENCE",
					name: "E1",
					description: "ev",
					children: [],
				},
			],
		},
	],
};

const options = { toolCallId: "t", messages: [] };

beforeEach(() => {
	vi.mocked(exportCase).mockResolvedValue({
		data: {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			case: { name: "Case", description: "d" },
			tree,
		},
	});
});

const tree = TREE as never;

describe("assistant tools", () => {
	it("asks the export for no comments", async () => {
		await createCaseTools("u", "c").read_case.execute?.({}, options);

		expect(exportCase).toHaveBeenCalledWith("u", "c", {
			includeComments: false,
		});
	});

	it("finds a nested element and returns one level of children", async () => {
		const result = await createCaseTools("u", "c").read_element.execute?.(
			{ elementId: "p1" },
			options
		);

		expect(result).toMatchObject({
			found: true,
			element: { id: "p1", children: [{ id: "e1", childCount: 0 }] },
		});
	});

	it("accepts an element's label when no id matches, as a model often passes the name it sees", async () => {
		const result = await createCaseTools("u", "c").read_element.execute?.(
			{ elementId: " p1 " },
			options
		);

		expect(result).toMatchObject({
			found: true,
			element: { id: "p1", children: [{ id: "e1" }] },
		});
	});

	it("prefers an id to a label, and does not guess when two elements share a label", async () => {
		const twin = {
			...TREE,
			children: [
				{ id: "p1", type: "PROPERTY_CLAIM", name: "P2", children: [] },
				{ id: "p2", type: "PROPERTY_CLAIM", name: "P1", children: [] },
				{ id: "p3", type: "PROPERTY_CLAIM", name: "P1", children: [] },
			],
		};
		vi.mocked(exportCase).mockResolvedValue({
			data: {
				version: "1.0",
				exportedAt: new Date().toISOString(),
				case: { name: "Case", description: "d" },
				tree: twin as never,
			},
		});
		const tools = createCaseTools("u", "c");

		expect(
			await tools.read_element.execute?.({ elementId: "p2" }, options)
		).toMatchObject({ found: true, element: { id: "p2" } });
		expect(
			await tools.read_element.execute?.({ elementId: "P1" }, options)
		).toMatchObject({ found: false });
	});

	it("reports an unknown id as not found", async () => {
		const result = await createCaseTools("u", "c").read_element.execute?.(
			{ elementId: "elsewhere" },
			options
		);

		expect(result).toMatchObject({ found: false });
	});

	it("reports not found when the export is refused", async () => {
		vi.mocked(exportCase).mockResolvedValue({ error: "Permission denied" });

		const result = await createCaseTools("u", "c").read_case.execute?.(
			{},
			options
		);

		expect(result).toMatchObject({ found: false });
	});
});
