import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useJsonValidation } from "@/hooks/use-json-validation";

const ROOT_ID = "11111111-1111-4111-8111-111111111111";

function buildExport(exportedAt: string): string {
	return JSON.stringify({
		version: "1.0",
		exportedAt,
		case: { name: "Test Case", description: "A case" },
		tree: {
			id: ROOT_ID,
			type: "GOAL",
			name: "G1",
			description: "Root goal",
			inSandbox: false,
			children: [],
		},
	});
}

describe("useJsonValidation", () => {
	it("accepts a well-formed export", async () => {
		const { result } = renderHook(() =>
			useJsonValidation(buildExport("2026-09-14T10:00:00.000Z"), {
				debounceMs: 0,
			})
		);

		await waitFor(() => expect(result.current.isValid).toBe(true));
		expect(result.current.errors).toHaveLength(0);
		expect(result.current.parsedData).not.toBeNull();
	});

	// JSON Schema's `format: "date-time"` keyword is an annotation, not an
	// assertion, per the JSON Schema spec — a schema-driven inline linter
	// (codemirror-json-schema) isn't expected to reject this. Zod's
	// z.string().datetime() enforces strict RFC 3339 (a literal "T"
	// separator and a "Z"/offset suffix), so the value below is shaped like
	// a valid export but still fails the check that actually gates Apply.
	// This is the real, present-day stand-in for the "refine JSON Schema
	// can't express" case described in the issue — CaseExportNestedSchema
	// has no .refine() today, so this exercises the same class of gap via
	// an existing built-in Zod check instead of a hypothetical one.
	it("still blocks on a Zod-only violation a lenient schema check would let through", async () => {
		const { result } = renderHook(() =>
			useJsonValidation(buildExport("2026-09-14 10:00:00"), {
				debounceMs: 0,
			})
		);

		// The hook's initial state is already `isValid: false` before the
		// debounced validation runs, so waiting on `errors` (only populated
		// once validate() actually completes) is what proves this ran.
		await waitFor(() =>
			expect(result.current.errors.length).toBeGreaterThan(0)
		);
		expect(result.current.isValid).toBe(false);
		expect(result.current.parsedData).toBeNull();
	});

	it("rejects invalid JSON syntax", async () => {
		const { result } = renderHook(() =>
			useJsonValidation("{ not valid json", { debounceMs: 0 })
		);

		await waitFor(() =>
			expect(result.current.diagnostics.length).toBeGreaterThan(0)
		);
		expect(result.current.isValid).toBe(false);
	});
});
