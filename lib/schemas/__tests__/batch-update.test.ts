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

	it("says how to split a batch that is too large", () => {
		const changes = Array.from({ length: 1001 }, makeDelete);
		const result = batchUpdateRequestSchema.safeParse({ changes });
		expect(result.error?.issues[0]?.message).toBe(
			"Batch is too large - split into batches of 1000 changes or fewer."
		);
	});
});

describe("batchUpdateRequestSchema — each kind of change", () => {
	const id = () => crypto.randomUUID();
	const createChange = (dataExtra: Record<string, unknown> = {}) => ({
		type: "create" as const,
		elementId: id(),
		parentId: null,
		data: {
			id: id(),
			type: "GOAL",
			name: "G1",
			description: "text",
			inSandbox: false,
			...dataExtra,
		},
	});

	it.each([
		["create", createChange()],
		["update", { type: "update", elementId: id(), data: { name: "N" } }],
		["delete", { type: "delete", elementId: id() }],
		[
			"link_evidence",
			{ type: "link_evidence", evidenceId: id(), claimId: id() },
		],
		[
			"unlink_evidence",
			{ type: "unlink_evidence", evidenceId: id(), claimId: id() },
		],
	])("accepts a %s change and keeps it as given", (_type, change) => {
		const result = batchUpdateRequestSchema.safeParse({ changes: [change] });
		expect(result.success).toBe(true);
		expect(result.data?.changes[0]).toMatchObject(change);
	});

	it.each([
		["a change type that is not known", { type: "move", elementId: id() }],
		["a create with no data", { ...createChange(), data: undefined }],
		["a create with a data key it does not know", createChange({ other: 1 })],
		[
			"an update with a data key it does not know",
			{ type: "update", elementId: id(), data: { other: 1 } },
		],
		["a link with no claim", { type: "link_evidence", evidenceId: id() }],
		["an unlink with no claim", { type: "unlink_evidence", evidenceId: id() }],
	])("refuses %s", (_label, change) => {
		const result = batchUpdateRequestSchema.safeParse({ changes: [change] });
		expect(result.success).toBe(false);
	});

	it("accepts pattern markers on a create and drops them", () => {
		const result = batchUpdateRequestSchema.safeParse({
			changes: [
				createChange({ fromPattern: true, modifiedFromPattern: false }),
			],
		});
		const change = result.data?.changes[0];
		expect(result.success).toBe(true);
		const data = change?.type === "create" ? change.data : undefined;
		expect(data).toBeDefined();
		expect(data?.fromPattern).toBeUndefined();
		expect(data?.modifiedFromPattern).toBeUndefined();
	});

	it("accepts pattern markers on an update and drops them", () => {
		const result = batchUpdateRequestSchema.safeParse({
			changes: [
				{
					type: "update",
					elementId: id(),
					data: { fromPattern: true, modifiedFromPattern: true },
				},
			],
		});
		const change = result.data?.changes[0];
		expect(result.success).toBe(true);
		const data = change?.type === "update" ? change.data : undefined;
		expect(data).toBeDefined();
		expect(data?.fromPattern).toBeUndefined();
		expect(data?.modifiedFromPattern).toBeUndefined();
	});
});
