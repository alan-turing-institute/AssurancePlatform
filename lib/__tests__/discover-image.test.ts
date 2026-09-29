import { describe, expect, it } from "vitest";
import { FALLBACK_IMAGE, resolveFeatureImageSrc } from "../discover-image";

const SLUG = "a-slug";
const VERSION_ID = "11111111-1111-1111-1111-111111111111";

/**
 * `""` is the case this exists to pin, not an edge case — see the function's
 * own doc comment: `CaseInformationSection`'s form defaults
 * `featureImageUrl` to `""`, and the case-information schema keeps `""`
 * distinct from `null`, so any published case whose author never touched
 * the image field stores `""` rather than `null`.
 */
describe("resolveFeatureImageSrc", () => {
	it("falls back to the placeholder for an empty string", () => {
		expect(resolveFeatureImageSrc("", SLUG, VERSION_ID)).toBe(FALLBACK_IMAGE);
	});

	it("falls back to the placeholder for null", () => {
		expect(resolveFeatureImageSrc(null, SLUG, VERSION_ID)).toBe(FALLBACK_IMAGE);
	});

	it("resolves a stored key to the version-scoped public route", () => {
		expect(
			resolveFeatureImageSrc("published/abc/feature.png", SLUG, VERSION_ID)
		).toBe(`/api/public/discover/${SLUG}/image/${VERSION_ID}`);
	});

	it("resolves a legacy /uploads/ address to the version-scoped public route", () => {
		expect(
			resolveFeatureImageSrc(
				"/uploads/cases/1/case-information/a.png",
				SLUG,
				VERSION_ID
			)
		).toBe(`/api/public/discover/${SLUG}/image/${VERSION_ID}`);
	});

	it("passes a genuine external address through unchanged", () => {
		expect(
			resolveFeatureImageSrc("https://example.com/image.png", SLUG, VERSION_ID)
		).toBe("https://example.com/image.png");
	});
});
