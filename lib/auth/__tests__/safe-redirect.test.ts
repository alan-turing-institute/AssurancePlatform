import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "../safe-redirect";

const FALLBACK = "/dashboard";

describe("safeRedirectPath", () => {
	it.each([
		["/dashboard", "/dashboard"],
		["/", "/"],
		["/cases/42", "/cases/42"],
		["/discover/some-pattern?use=1", "/discover/some-pattern?use=1"],
		["/cases/42?tab=notes&x=1#section", "/cases/42?tab=notes&x=1#section"],
		[
			"/invites/0b0c58c3-6a6f-4f2b-9c63-0d2f3a1f6b11",
			"/invites/0b0c58c3-6a6f-4f2b-9c63-0d2f3a1f6b11",
		],
	])("follows the same-site path %s", (raw, expected) => {
		expect(safeRedirectPath(raw)).toBe(expected);
	});

	it.each([
		["an absolute https URL", "https://evil.example"],
		["an absolute http URL with a path", "http://evil.example/x"],
		["a protocol-relative URL", "//evil.example/x"],
		["a triple-slash URL", "///evil.example"],
		["a slash then a backslash", "/\\evil.example"],
		["two backslashes", "\\\\evil.example"],
		["a backslash after a slash pair", "/\\/evil.example"],
		["an encoded protocol-relative URL", "%2F%2Fevil.example"],
		["an encoded backslash pair", "%5C%5Cevil.example"],
		["a javascript: URL", "javascript:alert(1)"],
		["a data: URL", "data:text/html,<p>x</p>"],
		["a leading space", " /dashboard"],
		["a leading tab", "\t/dashboard"],
		["a tab between the slashes", "/\t/evil.example"],
		["a newline between the slashes", "/\n/evil.example"],
		["a carriage return in the path", "/dash\rboard"],
		["a null byte", "/dash\u0000board"],
		["a dot segment that collapses to a protocol-relative path", "/.//host"],
		[
			"a parent segment that collapses to a protocol-relative path",
			"/a/..//host",
		],
		["a bare word", "dashboard"],
		["an empty string", ""],
	])("falls back for %s", (_label, raw) => {
		expect(safeRedirectPath(raw)).toBe(FALLBACK);
	});

	it("keeps an encoded slash or backslash after the first slash on this site", () => {
		for (const raw of ["/%2F%2Fevil.example", "/%5Cevil.example"]) {
			const result = safeRedirectPath(raw);

			expect(result).toBe(raw);
			expect(new URL(result, "https://app.example").origin).toBe(
				"https://app.example"
			);
		}
	});

	it("uses the first value when several are given", () => {
		expect(safeRedirectPath(["/cases/1", "//evil.example"])).toBe("/cases/1");
		expect(safeRedirectPath(["//evil.example", "/cases/1"])).toBe(FALLBACK);
		expect(safeRedirectPath([])).toBe(FALLBACK);
	});

	it("falls back when no value is given", () => {
		expect(safeRedirectPath(undefined)).toBe(FALLBACK);
		expect(safeRedirectPath(null)).toBe(FALLBACK);
	});

	it("falls back to the supplied fallback", () => {
		expect(safeRedirectPath("//evil.example", "/home")).toBe("/home");
		expect(safeRedirectPath(undefined, "/home")).toBe("/home");
		expect(safeRedirectPath("/cases/1", "/home")).toBe("/cases/1");
	});
});
