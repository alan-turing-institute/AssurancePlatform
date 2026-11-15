import type { Node } from "reactflow";
import { describe, expect, it } from "vitest";
import { keepLiveSelection } from "../keep-live-selection";

const node = (id: string, selected?: boolean): Node => ({
	id,
	position: { x: 0, y: 0 },
	data: {},
	selected,
});

describe("keepLiveSelection", () => {
	it("takes the selection of ids present in both lists from the live node", () => {
		const result = keepLiveSelection(
			[node("a", true), node("b", false)],
			[node("a", false), node("b", true)]
		);
		expect(result.map((n) => n.selected)).toEqual([false, true]);
	});

	it("marks ids only in the new list as not selected", () => {
		const result = keepLiveSelection([node("a", true)], [node("b", true)]);
		expect(result).toHaveLength(1);
		expect(result[0]?.selected).toBe(false);
	});

	it("ignores ids only in the live list", () => {
		const result = keepLiveSelection(
			[node("a")],
			[node("a", true), node("z", true)]
		);
		expect(result.map((n) => n.id)).toEqual(["a"]);
		expect(result[0]?.selected).toBe(true);
	});
});
