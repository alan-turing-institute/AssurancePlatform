import { describe, expect, it } from "vitest";
import { slugify } from "../slug-service";

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------
// Pure-function unit tests — no database required. Kept in lockstep with the
// equivalent backfill expression in this feature's migration
// (`prisma/migrations/20260716000000_publishing_schema_and_state_model`).

describe("slugify", () => {
	it("falls back to 'item' for an empty string", () => {
		expect(slugify("")).toBe("item");
	});

	it("falls back to 'item' for whitespace-only input", () => {
		expect(slugify("   ")).toBe("item");
	});

	it("falls back to 'item' for punctuation-only input", () => {
		expect(slugify("!!!___$$$")).toBe("item");
	});

	it("falls back to 'item' when every character is stripped as non-alphanumeric (e.g. non-Latin scripts)", () => {
		expect(slugify("日本語")).toBe("item");
	});

	it("replaces accented/unicode letters rather than transliterating them", () => {
		// Accented letters are outside [a-z0-9] and are collapsed like any
		// other non-alphanumeric run — not transliterated to their ASCII
		// equivalent. This pins the current (deliberately simple) behaviour.
		expect(slugify("Café Münster")).toBe("caf-m-nster");
	});

	it("collapses a run of multiple hyphens into one", () => {
		expect(slugify("Hello---World")).toBe("hello-world");
	});

	it("collapses mixed punctuation/whitespace runs into a single hyphen", () => {
		expect(slugify("Hello,   World!")).toBe("hello-world");
	});

	it("trims leading and trailing hyphens produced by leading/trailing punctuation", () => {
		expect(slugify("--Hello World--")).toBe("hello-world");
	});

	it("lowercases mixed-case input", () => {
		expect(slugify("My Great Case")).toBe("my-great-case");
	});
});
