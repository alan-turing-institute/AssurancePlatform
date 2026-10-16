import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	acceptWithNode,
	eventTypes,
	evidenceIn,
	nodeWorld,
	numericSettings,
	postNode,
	retire,
	save,
} from "../utils/live-node-kit";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return { ...actual, emitSSEEvent: vi.fn() };
});

// The status recomputation after a change can be made to fail on demand.
const failure = vi.hoisted(() => ({ on: false }));

vi.mock("@/lib/services/health-status-service", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/health-status-service")
		>();
	return {
		...actual,
		computeHealthStatus: vi.fn(
			(...args: Parameters<typeof actual.computeHealthStatus>) => {
				if (failure.on) {
					throw new Error("status recomputation failed");
				}
				return actual.computeHealthStatus(...args);
			}
		),
	};
});

beforeEach(async () => {
	await mockNoAuth();
	failure.on = false;
	vi.mocked(emitSSEEvent).mockClear();
});

describe("the case reloads even when the health announcement fails", () => {
	it("accepting with a node: the element event is out before the status recomputation fails", async () => {
		const world = await nodeWorld();
		failure.on = true;

		const result = await save(world, world.claim.id, {
			add_evidence_node: true,
		});

		failure.on = false;
		expect(result.status).toBeGreaterThanOrEqual(500);
		expect(await evidenceIn(world.kase.id)).toHaveLength(1);
		expect(eventTypes()).toContain("element:created");
		expect(eventTypes()).not.toContain("tea.health/state-changed");
	});

	it("rewriting the text: the element event is out before the status recomputation fails", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		vi.mocked(emitSSEEvent).mockClear();
		failure.on = true;

		const result = await save(
			world,
			world.claim.id,
			{ update_evidence_node_text: true },
			numericSettings()
		);

		failure.on = false;
		expect(result.status).toBeGreaterThanOrEqual(500);
		expect(eventTypes()).toContain("element:updated");
	});

	it("retiring with remove: the element event is out before the status recomputation fails", async () => {
		const world = await nodeWorld();
		await acceptWithNode(world);
		vi.mocked(emitSSEEvent).mockClear();
		failure.on = true;

		const result = await retire(world.claim.id, {
			reason: "x",
			evidence_node: "remove",
		});

		failure.on = false;
		expect(result.status).toBeGreaterThanOrEqual(500);
		expect(eventTypes()).toContain("element:deleted");
	});

	it("adding a node afterwards: the element event is out before the status recomputation fails", async () => {
		const world = await nodeWorld();
		await save(world, world.claim.id);
		vi.mocked(emitSSEEvent).mockClear();
		failure.on = true;

		const result = await postNode(world.claim.id);

		failure.on = false;
		expect(result.status).toBeGreaterThanOrEqual(500);
		expect(eventTypes()).toContain("element:created");
	});
});
