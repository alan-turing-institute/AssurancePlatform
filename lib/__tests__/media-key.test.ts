import { describe, expect, it } from "vitest";
import {
	isAcceptableExternalMediaUrl,
	isCaseFeatureImageKey,
	isExternalMediaUrl,
	isLegacyBlobUrl,
	isValidMediaKey,
	toMediaKey,
} from "../media-key";

const BLOB_HOST = "https://teastorageaccount.blob.core.windows.net/media";

describe("blob address anchoring", () => {
	it("refuses a blob address that follows other text, and leaves it as it is", () => {
		const embedded = `https://example.com/?u=${BLOB_HOST}/a.png`;
		expect(isLegacyBlobUrl(embedded)).toBe(false);
		expect(toMediaKey(embedded)).toBe(embedded);
		expect(isLegacyBlobUrl(`see ${BLOB_HOST}/a.png`)).toBe(false);
	});

	it("refuses a blob address whose key runs onto a second line", () => {
		expect(isLegacyBlobUrl(`${BLOB_HOST}/a.png\nb`)).toBe(false);
		expect(toMediaKey(`${BLOB_HOST}/a.png\nb`)).toBe(`${BLOB_HOST}/a.png\nb`);
	});
});

describe("external address schemes", () => {
	it("treats an http address as external and a scheme in the middle as not", () => {
		expect(isExternalMediaUrl("http://example.com/a.png")).toBe(true);
		expect(isExternalMediaUrl("cases/1/https://example.com/a.png")).toBe(false);
		expect(isExternalMediaUrl("/uploads/https://example.com/a.png")).toBe(
			false
		);
	});
});

describe("isAcceptableExternalMediaUrl", () => {
	it("accepts an https address that is not this app's blob storage", () => {
		expect(isAcceptableExternalMediaUrl("https://example.com/a.png")).toBe(
			true
		);
		expect(
			isAcceptableExternalMediaUrl(
				"https://example.com/?u=https://acct.blob.core.windows.net/media/a"
			)
		).toBe(true);
	});

	it.each([
		["a legacy blob address", `${BLOB_HOST}/images/a.png`],
		["an http address", "http://example.com/a.png"],
		["a bare key", "cases/1/case-information/a.png"],
		["a legacy uploads path", "/uploads/cases/1/a.png"],
		["a scheme in the middle", "/uploads/https://example.com/a.png"],
		["a prefix before the scheme", "x-https://example.com/a.png"],
		["an empty value", ""],
	])("refuses %s", (_name, value) => {
		expect(isAcceptableExternalMediaUrl(value)).toBe(false);
	});
});

describe("isValidMediaKey", () => {
	it("accepts a normal key and a key with dots inside a segment", () => {
		expect(isValidMediaKey("cases/1/case-information/a.png")).toBe(true);
		expect(isValidMediaKey("a..b/c.d")).toBe(true);
	});

	it.each([
		["an empty key", ""],
		["a leading slash", "/cases/1/a.png"],
		["a backslash", "cases\\1\\a.png"],
		["a NUL byte", "cases/1/a\0.png"],
		["a parent-folder step", "cases/../other/a.png"],
		["a leading parent-folder step", "../a.png"],
		["a current-folder step", "cases/./a.png"],
		["an empty segment", "cases//a.png"],
		["a trailing slash", "cases/1/"],
	])("refuses %s", (_name, key) => {
		expect(isValidMediaKey(key)).toBe(false);
	});
});

describe("isCaseFeatureImageKey", () => {
	it("accepts a key under the case's own folder", () => {
		expect(isCaseFeatureImageKey("1", "cases/1/case-information/a.png")).toBe(
			true
		);
	});

	it.each([
		["another case's key", "cases/2/case-information/a.png"],
		["a case whose id starts with the same digits", "cases/12/a.png"],
		["a key without the folder prefix", "1/case-information/a.png"],
		["a key that only contains the folder", "x/cases/1/a.png"],
		["an uploads path", "/uploads/cases/1/a.png"],
		["an empty key", ""],
	])("refuses %s", (_name, key) => {
		expect(isCaseFeatureImageKey("1", key)).toBe(false);
	});
});

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

describe("isLegacyBlobUrl", () => {
	it("accepts a real legacy blob URL", () => {
		expect(
			isLegacyBlobUrl(
				"https://teastorageaccount.blob.core.windows.net/media/images/a.png"
			)
		).toBe(true);
	});

	it("refuses a blob host that appears in a path", () => {
		expect(
			isLegacyBlobUrl(
				"https://example.com/x/blob.core.windows.net/media/images/a.png"
			)
		).toBe(false);
	});

	it("refuses a blob host that appears in a query string", () => {
		expect(
			isLegacyBlobUrl(
				"https://example.com/a.png?next=teastorageaccount.blob.core.windows.net/media/a.png"
			)
		).toBe(false);
	});

	it("refuses a value whose host is cut short by a query or fragment marker", () => {
		expect(
			isLegacyBlobUrl(
				"https://example.com?.blob.core.windows.net/media/cases/2/a.png"
			)
		).toBe(false);
		expect(
			isLegacyBlobUrl(
				"https://example.com#.blob.core.windows.net/media/cases/2/a.png"
			)
		).toBe(false);
	});

	it("refuses a bare key and a plain http address", () => {
		expect(isLegacyBlobUrl("cases/1/a.png")).toBe(false);
		expect(
			isLegacyBlobUrl("http://acct.blob.core.windows.net/media/a.png")
		).toBe(false);
	});
});
