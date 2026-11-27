import { describe, expect, it } from "vitest";
import { PUBLISHABLE_ITEM_TYPE_LABELS } from "@/lib/publishable-item-labels";
import { publishableItemTypeSchema } from "@/lib/schemas/publishable-item";

describe("PUBLISHABLE_ITEM_TYPE_LABELS", () => {
	it("has a label for exactly the publishable item types", () => {
		expect(Object.keys(PUBLISHABLE_ITEM_TYPE_LABELS).sort()).toStrictEqual(
			[...publishableItemTypeSchema.options].sort()
		);
	});

	it.each(
		publishableItemTypeSchema.options
	)("gives %s a non-empty label", (type) => {
		expect(PUBLISHABLE_ITEM_TYPE_LABELS[type].trim().length).toBeGreaterThan(0);
	});

	it("gives each type a different label", () => {
		const labels = Object.values(PUBLISHABLE_ITEM_TYPE_LABELS);
		expect(new Set(labels).size).toBe(labels.length);
	});
});
