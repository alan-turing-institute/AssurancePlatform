import { describe, expect, it } from "vitest";
import {
	caseFeatureImageMediaRoute,
	caseScreenshotMediaRoute,
	isAcceptableFeatureImageValue,
	isOwnCaseFeatureImageAddress,
	publicDiscoverImageRoute,
	resolveCaseFeatureImageAddress,
	resolvePublicFeatureImageAddress,
} from "@/lib/media-routes";

const OWN_ROUTE = "/api/cases/case-1/media/feature";
const BLOB_ADDRESS =
	"https://teastorageaccount.blob.core.windows.net/media/cases/case-1/case-information/a.png";

describe("route address builders", () => {
	it("builds the screenshot address, with and without a version token", () => {
		expect(caseScreenshotMediaRoute("case-1")).toBe(
			"/api/cases/case-1/media/screenshot"
		);
		expect(caseScreenshotMediaRoute("case-1", "abc")).toBe(
			"/api/cases/case-1/media/screenshot?v=abc"
		);
		expect(caseScreenshotMediaRoute("case-1", "")).toBe(
			"/api/cases/case-1/media/screenshot"
		);
	});

	it("builds the feature-image address, with and without a version token", () => {
		expect(caseFeatureImageMediaRoute("case-1")).toBe(OWN_ROUTE);
		expect(caseFeatureImageMediaRoute("case-1", "abc")).toBe(
			`${OWN_ROUTE}?v=abc`
		);
	});

	it("builds the public address from the slug and version", () => {
		expect(publicDiscoverImageRoute("a-slug", "v-1")).toBe(
			"/api/public/discover/a-slug/image/v-1"
		);
	});
});

describe("isOwnCaseFeatureImageAddress", () => {
	it("accepts the case's own address, with or without a version query", () => {
		expect(isOwnCaseFeatureImageAddress("case-1", OWN_ROUTE)).toBe(true);
		expect(isOwnCaseFeatureImageAddress("case-1", `${OWN_ROUTE}?v=abc`)).toBe(
			true
		);
	});

	it.each([
		["another case's address", "/api/cases/case-2/media/feature"],
		["a longer path", `${OWN_ROUTE}/extra`],
		["a longer last segment", `${OWN_ROUTE}2`],
		["a different query", `${OWN_ROUTE}?x=1`],
		["the screenshot address", "/api/cases/case-1/media/screenshot"],
		["an address on another host", `https://example.com${OWN_ROUTE}`],
		["an empty value", ""],
	])("refuses %s", (_name, value) => {
		expect(isOwnCaseFeatureImageAddress("case-1", value)).toBe(false);
	});
});

describe("isAcceptableFeatureImageValue", () => {
	it.each([
		["an empty value", ""],
		["the case's own address", OWN_ROUTE],
		["the case's own address with a query", `${OWN_ROUTE}?v=abc`],
		["an external https address", "https://example.com/image.png"],
	])("accepts %s", (_name, value) => {
		expect(isAcceptableFeatureImageValue("case-1", value)).toBe(true);
	});

	it.each([
		["a bare storage key", "cases/case-1/case-information/a.png"],
		["a legacy uploads path", "/uploads/cases/case-1/case-information/a.png"],
		["a legacy blob address", BLOB_ADDRESS],
		["another case's address", "/api/cases/case-2/media/feature"],
		["an external http address", "http://example.com/image.png"],
		["a scheme-less address", "//example.com/image.png"],
		["a script address", "javascript:alert(1)"],
	])("refuses %s", (_name, value) => {
		expect(isAcceptableFeatureImageValue("case-1", value)).toBe(false);
	});
});

describe("resolveCaseFeatureImageAddress", () => {
	it("returns null and the empty string unchanged", () => {
		expect(resolveCaseFeatureImageAddress("case-1", null)).toBeNull();
		expect(resolveCaseFeatureImageAddress("case-1", "")).toBe("");
	});

	it("returns an external address unchanged, http or https", () => {
		for (const address of [
			"https://example.com/a.png",
			"http://example.com/a.png",
		]) {
			expect(resolveCaseFeatureImageAddress("case-1", address, "abc")).toBe(
				address
			);
		}
	});

	it.each([
		["a bare key", "cases/case-1/case-information/a.png"],
		["a legacy uploads path", "/uploads/cases/case-1/case-information/a.png"],
		["a legacy blob address", BLOB_ADDRESS],
	])("gives the case's own route for %s", (_name, stored) => {
		expect(resolveCaseFeatureImageAddress("case-1", stored)).toBe(OWN_ROUTE);
		expect(resolveCaseFeatureImageAddress("case-1", stored, "abc")).toBe(
			`${OWN_ROUTE}?v=abc`
		);
	});
});

describe("resolvePublicFeatureImageAddress", () => {
	it("returns null and the empty string unchanged", () => {
		expect(resolvePublicFeatureImageAddress("s", "v-1", null)).toBeNull();
		expect(resolvePublicFeatureImageAddress("s", "v-1", "")).toBe("");
	});

	it("returns an external address unchanged", () => {
		expect(
			resolvePublicFeatureImageAddress("s", "v-1", "https://example.com/a.png")
		).toBe("https://example.com/a.png");
	});

	it.each([
		["a bare key", "published/abc/feature.png"],
		["a legacy uploads path", "/uploads/cases/case-1/case-information/a.png"],
		["a legacy blob address", BLOB_ADDRESS],
	])("gives the version-scoped public route for %s", (_name, stored) => {
		expect(resolvePublicFeatureImageAddress("s", "v-1", stored)).toBe(
			"/api/public/discover/s/image/v-1"
		);
	});
});
