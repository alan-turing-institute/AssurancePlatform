import { describe, expect, it } from "vitest";
import { batchUpdateRequestSchema } from "../batch-update";

/**
 * TEA — Batch endpoint does not verify element ownership against the case:
 * uncapped `changes` arrays let a huge batch reach the recursive level
 * resolution in case-batch-update-service.ts, which stack-overflows into a
 * 500 rather than failing cleanly. The route's `safeParse` already turns any
 * schema failure into a 400, so the cap only needs to exist here.
 */
describe("batchUpdateRequestSchema — changes array cap", () => {
	const makeDelete = () => ({
		type: "delete" as const,
		elementId: crypto.randomUUID(),
	});

	it("accepts a batch of exactly 1000 changes", () => {
		const changes = Array.from({ length: 1000 }, makeDelete);
		const result = batchUpdateRequestSchema.safeParse({ changes });
		expect(result.success).toBe(true);
	});

	it("rejects a batch of 1001 changes", () => {
		const changes = Array.from({ length: 1001 }, makeDelete);
		const result = batchUpdateRequestSchema.safeParse({ changes });
		expect(result.success).toBe(false);
	});

	it("still accepts a small, ordinary batch", () => {
		const result = batchUpdateRequestSchema.safeParse({
			changes: [makeDelete()],
		});
		expect(result.success).toBe(true);
	});
});
