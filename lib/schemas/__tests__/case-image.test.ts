import { describe, expect, it } from "vitest";
import { caseImageUploadSchema } from "../case-image";

describe("caseImageUploadSchema", () => {
	it("keeps the image it is given", () => {
		expect(caseImageUploadSchema.parse({ image: "iVBORw0KGgo=" })).toEqual({
			image: "iVBORw0KGgo=",
		});
	});

	it.each([
		["a one character image", { image: "x" }, true],
		["an empty image", { image: "" }, false],
		["no image", {}, false],
		["an extra key", { image: "x", other: 1 }, false],
	])("handles %s", (_label, body, ok) => {
		expect(caseImageUploadSchema.safeParse(body).success).toBe(ok);
	});
});
