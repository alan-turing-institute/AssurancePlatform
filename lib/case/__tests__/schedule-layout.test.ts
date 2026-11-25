import type { Edge, Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import { createLayoutScheduler, type LayoutRequest } from "../schedule-layout";

function setup() {
	const frames: Array<() => void> = [];
	const resolvers: Array<() => void> = [];
	let active = 0;
	let maxActive = 0;
	const layoutNodes = vi.fn(
		() =>
			new Promise<void>((resolve) => {
				active += 1;
				maxActive = Math.max(maxActive, active);
				resolvers.push(() => {
					active -= 1;
					resolve();
				});
			})
	);
	const fitView = vi.fn();
	const request: LayoutRequest = {
		fitView,
		getEdges: () => [],
		getNodes: () => [],
		layoutNodes,
	};
	const schedule = createLayoutScheduler((cb) => {
		frames.push(cb);
	});
	const flushFrame = () => {
		for (const cb of frames.splice(0)) {
			cb();
		}
	};
	const finishLayout = async () => {
		resolvers.shift()?.();
		await Promise.resolve();
		await Promise.resolve();
	};
	return {
		fitView,
		flushFrame,
		finishLayout,
		frames,
		layoutNodes,
		maxActive: () => maxActive,
		request,
		schedule,
	};
}

describe("createLayoutScheduler", () => {
	it("runs one layout for many calls made before the frame", async () => {
		const t = setup();
		for (let i = 0; i < 20; i++) {
			t.schedule(t.request);
		}
		expect(t.frames).toHaveLength(1);
		t.flushFrame();
		await t.finishLayout();

		expect(t.layoutNodes).toHaveBeenCalledTimes(1);
		expect(t.fitView).toHaveBeenCalledTimes(1);
		expect(t.frames).toHaveLength(0);
	});

	it("runs exactly one more layout for calls made during a run, never two at once", async () => {
		const t = setup();
		t.schedule(t.request);
		t.flushFrame();
		t.schedule(t.request);
		t.schedule(t.request);
		await t.finishLayout();

		t.flushFrame();
		await t.finishLayout();
		t.flushFrame();

		expect(t.layoutNodes).toHaveBeenCalledTimes(2);
		expect(t.maxActive()).toBe(1);
		expect(t.frames).toHaveLength(0);
	});

	it("runs no layout and no fitView when the only requester has left", async () => {
		const t = setup();
		t.schedule({ ...t.request, isActive: () => false });
		t.flushFrame();
		await t.finishLayout();

		expect(t.layoutNodes).not.toHaveBeenCalled();
		expect(t.fitView).not.toHaveBeenCalled();
	});

	it("still lays out, and fits with the active requester, when a later requester has left", async () => {
		const t = setup();
		const fitA = vi.fn();
		t.schedule({ ...t.request, fitView: fitA });
		t.schedule({ ...t.request, isActive: () => false });
		t.flushFrame();
		await t.finishLayout();

		expect(t.layoutNodes).toHaveBeenCalledTimes(1);
		expect(fitA).toHaveBeenCalledTimes(1);
		expect(t.fitView).not.toHaveBeenCalled();
	});

	it("runs nothing when no call is made", () => {
		const t = setup();
		t.flushFrame();
		expect(t.layoutNodes).not.toHaveBeenCalled();
	});
});

describe("createLayoutScheduler timing and failures", () => {
	const entries: LogEntry[] = [];
	beforeEach(() => {
		entries.length = 0;
		vi.stubEnv("LOG_LEVEL", "debug");
		setLogSink((entry) => {
			entries.push(entry);
		});
	});
	afterEach(() => {
		resetLogSink();
		vi.unstubAllEnvs();
	});

	const warnings = () => entries.filter((entry) => entry.level === "warn");

	it("raises no warning when the only requester has left", async () => {
		const t = setup();
		t.schedule({ ...t.request, isActive: () => false });
		t.flushFrame();
		await t.finishLayout();

		expect(warnings()).toHaveLength(0);
	});

	it("raises no warning and skips fitView when every requester leaves during the layout", async () => {
		const t = setup();
		let active = true;
		t.schedule({ ...t.request, isActive: () => active });
		t.flushFrame();
		active = false;
		await t.finishLayout();

		expect(t.layoutNodes).toHaveBeenCalledTimes(1);
		expect(t.fitView).not.toHaveBeenCalled();
		expect(warnings()).toHaveLength(0);
	});

	it("passes the nodes and edges read at run time to the layout", () => {
		const t = setup();
		let nodes: Node[] = [];
		const edges: Edge[] = [];
		t.schedule({ ...t.request, getNodes: () => nodes, getEdges: () => edges });
		nodes = [{ id: "n1", position: { x: 0, y: 0 }, data: {} }];
		t.flushFrame();

		expect(t.layoutNodes).toHaveBeenCalledWith(nodes, edges);
	});

	it("logs a warning, skips fitView and keeps working when a layout fails", async () => {
		const t = setup();
		const failure = new Error("boom");
		t.layoutNodes.mockRejectedValueOnce(failure);
		t.schedule(t.request);
		t.flushFrame();
		await vi.waitFor(() => expect(warnings()).toHaveLength(1));

		expect(t.fitView).not.toHaveBeenCalled();
		const [entry] = warnings();
		expect(entry?.msg).toBe("Layout failed");
		expect(entry?.component).toBe("schedule-layout");
		expect(JSON.stringify(entry)).toContain("boom");

		t.schedule(t.request);
		expect(t.frames).toHaveLength(1);
		t.flushFrame();
		await t.finishLayout();
		expect(t.layoutNodes).toHaveBeenCalledTimes(2);
		expect(t.fitView).toHaveBeenCalledTimes(1);
	});

	it("schedules no frame during a run and starts no second layout until it ends", async () => {
		const t = setup();
		t.schedule(t.request);
		t.flushFrame();
		t.schedule(t.request);

		expect(t.frames).toHaveLength(0);
		t.flushFrame();
		expect(t.layoutNodes).toHaveBeenCalledTimes(1);

		await t.finishLayout();
		expect(t.frames).toHaveLength(1);
	});

	it("schedules the follow-up layout once, even when called again before its frame", async () => {
		const t = setup();
		t.schedule(t.request);
		t.flushFrame();
		t.schedule(t.request);
		await t.finishLayout();
		t.schedule(t.request);

		expect(t.frames).toHaveLength(1);
		t.flushFrame();
		await t.finishLayout();
		expect(t.layoutNodes).toHaveBeenCalledTimes(2);
		expect(t.frames).toHaveLength(0);
	});

	it("runs no follow-up layout when the only call made during a run came from a requester that left", async () => {
		const t = setup();
		t.schedule(t.request);
		t.flushFrame();
		t.schedule({ ...t.request, isActive: () => false });
		await t.finishLayout();

		expect(t.frames).toHaveLength(0);
		expect(warnings()).toHaveLength(0);
	});

	it("lays out with the request made during the run in the follow-up", async () => {
		const t = setup();
		const laterLayout = vi.fn(() => Promise.resolve());
		t.schedule(t.request);
		t.flushFrame();
		t.schedule({ ...t.request, layoutNodes: laterLayout });
		await t.finishLayout();
		t.flushFrame();

		expect(laterLayout).toHaveBeenCalledTimes(1);
	});

	it("does not repeat a follow-up for calls that were already served", async () => {
		const t = setup();
		t.schedule(t.request);
		t.flushFrame();
		t.schedule(t.request);
		await t.finishLayout();
		t.flushFrame();
		await t.finishLayout();

		expect(t.frames).toHaveLength(0);
		t.schedule(t.request);
		t.flushFrame();
		await t.finishLayout();
		expect(t.frames).toHaveLength(0);
		expect(t.layoutNodes).toHaveBeenCalledTimes(3);
	});
});
