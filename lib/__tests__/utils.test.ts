import { describe, expect, it } from "vitest";
import { cn } from "../utils";

describe("cn", () => {
	it("combines multiple string classes", () => {
		expect(cn("flex", "justify-center", "items-center")).toBe(
			"flex justify-center items-center"
		);
	});

	it("handles conditional classes with objects", () => {
		const result = cn("base", {
			"conditional-true": true,
			"conditional-false": false,
		});
		expect(result).toContain("base");
		expect(result).toContain("conditional-true");
		expect(result).not.toContain("conditional-false");
	});

	it("resolves conflicting Tailwind classes (last wins)", () => {
		expect(cn("p-4", "text-center", "p-2")).toBe("text-center p-2");
	});

	it("handles empty inputs", () => {
		expect(cn()).toBe("");
	});

	it("filters out null and undefined", () => {
		expect(cn(null, undefined, "valid-class")).toBe("valid-class");
	});

	it("handles arrays of classes", () => {
		expect(cn(["class1", "class2"], "class3")).toBe("class1 class2 class3");
	});

	it("handles mixed input types", () => {
		const result = cn(
			"base",
			["array1", "array2"],
			{ "obj-true": true, "obj-false": false },
			"final"
		);
		expect(result).toContain("base");
		expect(result).toContain("array1");
		expect(result).toContain("array2");
		expect(result).toContain("obj-true");
		expect(result).toContain("final");
		expect(result).not.toContain("obj-false");
	});

	it("deduplicates conflicting Tailwind classes", () => {
		// tailwind-merge deduplicates Tailwind utility conflicts, not arbitrary class names
		const result = cn("text-red-500", "other", "text-blue-500");
		expect(result).toContain("text-blue-500");
		expect(result).not.toContain("text-red-500");
		expect(result).toContain("other");
	});

	it("preserves order for non-conflicting classes", () => {
		const result = cn("first", "second", "third");
		const parts = result.split(" ");
		expect(parts.indexOf("first")).toBeLessThan(parts.indexOf("second"));
		expect(parts.indexOf("second")).toBeLessThan(parts.indexOf("third"));
	});

	it("handles empty strings", () => {
		expect(cn("", "valid-class", "")).toBe("valid-class");
	});

	it("works with component variants pattern", () => {
		const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 py-2" } as const;
		const variants = {
			default: "bg-primary text-primary-foreground",
			outline: "border border-input bg-background",
		} as const;

		const result = cn(
			"inline-flex items-center justify-center",
			sizes.md,
			variants.default,
			"disabled:opacity-50"
		);

		expect(result).toContain("inline-flex");
		expect(result).toContain("h-10");
		expect(result).toContain("bg-primary");
		expect(result).toContain("disabled:opacity-50");
	});

	it("resolves conflicting responsive variants", () => {
		// Simulates className override: component default + user override
		const result = cn("bg-primary px-4 py-2", "bg-secondary");
		expect(result).toContain("px-4");
		expect(result).toContain("py-2");
		expect(result).toContain("bg-secondary");
		expect(result).not.toContain("bg-primary");
	});
});
