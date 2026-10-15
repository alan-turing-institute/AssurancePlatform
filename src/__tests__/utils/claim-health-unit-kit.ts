import type { CaseExportNested } from "@/lib/schemas/case-export";

export const NOW = new Date("2026-10-15T12:00:00.000Z");

export interface NodeInput {
	children?: NodeInput[];
	description?: string;
	id: string;
	name?: string | null;
	type?: string;
}

export function claim(
	id: string,
	name: string | null = id,
	description = `Text of ${id}`,
	children: NodeInput[] = []
): NodeInput {
	return { id, type: "PROPERTY_CLAIM", name, description, children };
}

export function goal(children: NodeInput[], id = "goal-1"): NodeInput {
	return {
		id,
		type: "GOAL",
		name: "G1",
		description: "Top goal",
		children,
	};
}

export function exportOf(
	tree: NodeInput
): () => Promise<CaseExportNested | null> {
	return () =>
		Promise.resolve({
			version: "1.0",
			exportedAt: NOW.toISOString(),
			case: { name: "Case", description: "A case" },
			tree,
		} as unknown as CaseExportNested);
}

export function status(overrides: Record<string, unknown> = {}) {
	return {
		bound_check: "Sensor Range Checker",
		expires_at: null,
		mismatch: null,
		record_id: "record-id-do-not-leak",
		rejected_since_last_accept: 0,
		stale: false,
		stale_reason: null,
		stale_since: null,
		timestamp: "2026-10-15T11:00:00.000Z",
		verdict: "pass",
		...overrides,
	};
}

export const statusFor = (
	claimRef: string,
	overrides: Record<string, unknown> = {}
) => ({
	claim_ref: claimRef,
	status: status(overrides),
});
