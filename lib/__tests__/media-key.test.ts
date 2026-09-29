import { describe, expect, it } from "vitest";
import { isExternalMediaUrl, toMediaKey } from "../media-key";

describe("toMediaKey", () => {
	it("returns a bare key unchanged", () => {
		expect(toMediaKey("cases/1/case-information/a.png")).toBe(
			"cases/1/case-information/a.png"
		);
	});

	it("strips a legacy /uploads/ prefix", () => {
		expect(toMediaKey("/uploads/cases/1/case-information/a.png")).toBe(
			"cases/1/case-information/a.png"
		);
	});

	it("extracts the key from a legacy Azure blob URL", () => {
		expect(
			toMediaKey(
				"https://teastorageaccount.blob.core.windows.net/media/images/a.png"
			)
		).toBe("images/a.png");
	});

	it("returns a genuine external address unchanged", () => {
		expect(toMediaKey("https://example.com/image.png")).toBe(
			"https://example.com/image.png"
		);
	});
});

describe("isExternalMediaUrl", () => {
	it("is false for a bare key", () => {
		expect(isExternalMediaUrl("cases/1/case-information/a.png")).toBe(false);
	});

	it("is false for a legacy /uploads/ path", () => {
		expect(isExternalMediaUrl("/uploads/cases/1/a.png")).toBe(false);
	});

	it("is false for a legacy Azure blob URL", () => {
		expect(
			isExternalMediaUrl(
				"https://teastorageaccount.blob.core.windows.net/media/images/a.png"
			)
		).toBe(false);
	});

	it("is true for a genuine external address", () => {
		expect(isExternalMediaUrl("https://example.com/image.png")).toBe(true);
	});
});
