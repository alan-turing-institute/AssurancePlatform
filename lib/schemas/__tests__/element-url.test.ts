import { describe, expect, it } from "vitest";
import { lenientUrlSchema, optionalUrlSchema } from "../base";
import { createElementSchema, updateElementSchema } from "../element";

const SCHEME_MESSAGE = "Enter a web address, such as example.com/report.pdf";

describe("lenientUrlSchema", () => {
	it("accepts a bare domain and normalises it to https://", () => {
		const result = lenientUrlSchema.safeParse("example.com");
		expect(result.success).toBe(true);
		expect(result.success && result.data).toBe("https://example.com");
	});

	it("accepts a bare domain with a path and normalises it", () => {
		const result = lenientUrlSchema.safeParse("example.com/report.pdf");
		expect(result.success).toBe(true);
		expect(result.success && result.data).toBe(
			"https://example.com/report.pdf"
		);
	});

	it("passes an existing https:// value through byte-unchanged", () => {
		const result = lenientUrlSchema.safeParse("https://example.com/report.pdf");
		expect(result.success).toBe(true);
		expect(result.success && result.data).toBe(
			"https://example.com/report.pdf"
		);
	});

	it("passes an existing http:// value through byte-unchanged", () => {
		const result = lenientUrlSchema.safeParse("http://example.com/report.pdf");
		expect(result.success).toBe(true);
		expect(result.success && result.data).toBe("http://example.com/report.pdf");
	});

	it("trims surrounding whitespace before validating", () => {
		const result = lenientUrlSchema.safeParse("  example.com  ");
		expect(result.success).toBe(true);
		expect(result.success && result.data).toBe("https://example.com");
	});

	it("rejects genuinely invalid input with the plain-English message", () => {
		const result = lenientUrlSchema.safeParse("not a url at all");
		expect(result.success).toBe(false);
		expect(result.success || result.error.issues[0]?.message).toBe(
			SCHEME_MESSAGE
		);
	});

	it("rejects a space breaking the host (spaces mid-string)", () => {
		const result = lenientUrlSchema.safeParse("exa mple.com");
		expect(result.success).toBe(false);
		expect(result.success || result.error.issues[0]?.message).toBe(
			SCHEME_MESSAGE
		);
	});

	it("rejects an empty string", () => {
		expect(lenientUrlSchema.safeParse("").success).toBe(false);
	});

	it("rejects a mailto: address rather than mangling it", () => {
		const result = lenientUrlSchema.safeParse("mailto:x@y.z");
		expect(result.success).toBe(false);
		expect(result.success || result.error.issues[0]?.message).toBe(
			SCHEME_MESSAGE
		);
	});

	it("rejects a javascript: address (colon, no slashes)", () => {
		const result = lenientUrlSchema.safeParse("javascript:alert(1)");
		expect(result.success).toBe(false);
		expect(result.success || result.error.issues[0]?.message).toBe(
			SCHEME_MESSAGE
		);
	});

	it("rejects a data: address (colon, no slashes)", () => {
		const result = lenientUrlSchema.safeParse(
			"data:text/plain;base64,SGVsbG8="
		);
		expect(result.success).toBe(false);
		expect(result.success || result.error.issues[0]?.message).toBe(
			SCHEME_MESSAGE
		);
	});

	it("rejects a javascript:// address (scheme with slashes, not http/https)", () => {
		const result = lenientUrlSchema.safeParse("javascript://alert(1)");
		expect(result.success).toBe(false);
		expect(result.success || result.error.issues[0]?.message).toBe(
			SCHEME_MESSAGE
		);
	});

	it("accepts a protocol-relative address and stores it as https://", () => {
		const result = lenientUrlSchema.safeParse("//example.com");
		expect(result.success).toBe(true);
		expect(result.success && result.data).toBe("https://example.com");
	});

	it("passes an uppercase HTTPS:// value through byte-unchanged", () => {
		const result = lenientUrlSchema.safeParse("HTTPS://example.com");
		expect(result.success).toBe(true);
		expect(result.success && result.data).toBe("HTTPS://example.com");
	});
});

describe("optionalUrlSchema", () => {
	it("treats undefined, null, and empty/whitespace strings as absent", () => {
		expect(optionalUrlSchema.safeParse(undefined)).toMatchObject({
			success: true,
			data: undefined,
		});
		expect(optionalUrlSchema.safeParse(null)).toMatchObject({
			success: true,
			data: undefined,
		});
		expect(optionalUrlSchema.safeParse("")).toMatchObject({
			success: true,
			data: undefined,
		});
		expect(optionalUrlSchema.safeParse("   ")).toMatchObject({
			success: true,
			data: undefined,
		});
	});

	it("normalises a bare domain when present", () => {
		const result = optionalUrlSchema.safeParse("example.com");
		expect(result.success).toBe(true);
		expect(result.success && result.data).toBe("https://example.com");
	});

	it("rejects a genuinely invalid value with the plain-English message", () => {
		const result = optionalUrlSchema.safeParse("not a url at all");
		expect(result.success).toBe(false);
		expect(result.success || result.error.issues[0]?.message).toBe(
			SCHEME_MESSAGE
		);
	});
});

describe("createElementSchema — evidence urls field", () => {
	it("accepts a bare domain in the urls array and normalises it", () => {
		const result = createElementSchema.safeParse({
			type: "evidence",
			urls: ["example.com/report.pdf"],
		});
		expect(result.success).toBe(true);
		expect(result.success && result.data.urls).toEqual([
			"https://example.com/report.pdf",
		]);
	});

	it("rejects an invalid entry in the urls array with the plain-English message", () => {
		const result = createElementSchema.safeParse({
			type: "evidence",
			urls: ["not a url at all"],
		});
		expect(result.success).toBe(false);
		expect(result.success || result.error.issues[0]?.message).toBe(
			SCHEME_MESSAGE
		);
	});

	it("accepts a bare domain in the legacy url field and normalises it", () => {
		const result = createElementSchema.safeParse({
			type: "evidence",
			url: "example.com",
		});
		expect(result.success).toBe(true);
		expect(result.success && result.data.url).toBe("https://example.com");
	});

	it("accepts a bare domain in the legacy URL field and normalises it", () => {
		const result = createElementSchema.safeParse({
			type: "evidence",
			URL: "example.com",
		});
		expect(result.success).toBe(true);
		expect(result.success && result.data.URL).toBe("https://example.com");
	});

	it("still allows omitting urls entirely", () => {
		const result = createElementSchema.safeParse({ type: "goal" });
		expect(result.success).toBe(true);
	});
});

describe("updateElementSchema — evidence urls field", () => {
	it("accepts a bare domain in the urls array and normalises it", () => {
		const result = updateElementSchema.safeParse({
			urls: ["example.com/report.pdf"],
		});
		expect(result.success).toBe(true);
		expect(result.success && result.data.urls).toEqual([
			"https://example.com/report.pdf",
		]);
	});

	it("passes an existing https:// value through byte-unchanged", () => {
		const result = updateElementSchema.safeParse({
			urls: ["https://example.com/report.pdf"],
		});
		expect(result.success).toBe(true);
		expect(result.success && result.data.urls).toEqual([
			"https://example.com/report.pdf",
		]);
	});

	it("rejects an invalid entry in the urls array with the plain-English message", () => {
		const result = updateElementSchema.safeParse({
			urls: ["not a url at all"],
		});
		expect(result.success).toBe(false);
		expect(result.success || result.error.issues[0]?.message).toBe(
			SCHEME_MESSAGE
		);
	});

	it("rejects an entry with a space breaking the host", () => {
		const result = updateElementSchema.safeParse({
			urls: ["exa mple.com"],
		});
		expect(result.success).toBe(false);
	});

	it("accepts a bare domain in the legacy URL field and normalises it", () => {
		const result = updateElementSchema.safeParse({ URL: "example.com" });
		expect(result.success).toBe(true);
		expect(result.success && result.data.URL).toBe("https://example.com");
	});
});
