import { describe, expect, it } from "vitest";
import { FALLBACK_IMAGE, resolveFeatureImageSrc } from "../discover-image";

/**
 * `""` is the case this exists to pin, not an edge case — see the function's
 * own doc comment: `CaseInformationSection`'s form defaults `featureImageUrl`
 * to `""`, and the case-information schema keeps `""` distinct from `null`,
 * so any published case whose author never touched the image field stores
 * `""` rather than `null`.
 */
describe("resolveFeatureImageSrc", () => {
	it("falls back to the placeholder for an empty string", () => {
		expect(resolveFeatureImageSrc("")).toBe(FALLBACK_IMAGE);
	});

	it("falls back to the placeholder for null", () => {
		expect(resolveFeatureImageSrc(null)).toBe(FALLBACK_IMAGE);
	});

	it("passes a real URL through unchanged", () => {
		expect(
			resolveFeatureImageSrc("/uploads/cases/1/case-information/a.png")
		).toBe("/uploads/cases/1/case-information/a.png");
	});
});
