import { describe, expect, it, vi } from "vitest";
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
		canvas: {},
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

	it("runs nothing when no call is made", () => {
		const t = setup();
		t.flushFrame();
		expect(t.layoutNodes).not.toHaveBeenCalled();
	});
});
