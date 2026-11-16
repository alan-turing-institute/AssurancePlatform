import type { Edge, Node } from "reactflow";
import { logger } from "@/lib/logger";

const log = logger.child({ component: "schedule-layout" });

export interface LayoutRequest {
	fitView: () => unknown;
	getEdges: () => Edge[];
	getNodes: () => Node[];
	/** Returns false once the requester has left the page; the layout is then skipped. */
	isActive?: () => boolean;
	layoutNodes: (nodes: Node[], edges: Edge[]) => Promise<void>;
}

type FrameScheduler = (callback: () => void) => void;

const nextTwoFrames: FrameScheduler = (callback) => {
	window.requestAnimationFrame(() => {
		window.requestAnimationFrame(callback);
	});
};

/**
 * Coalesces layout requests. At most one request is pending and at most one
 * layout is in flight. The first call schedules a layout two animation frames
 * later; calls that arrive while one is pending are folded into it; a call
 * that arrives during a run causes exactly one more run afterwards. Nodes and
 * edges are read when the layout runs, so it sees the sizes measured by then.
 */
export function createLayoutScheduler(
	schedule: FrameScheduler = nextTwoFrames
) {
	let latest: LayoutRequest | null = null;
	let pending = false;
	let running = false;
	let again = false;

	const run = async () => {
		pending = false;
		running = true;
		const request = latest;
		latest = null;
		if (request && request.isActive?.() !== false) {
			try {
				await request.layoutNodes(request.getNodes(), request.getEdges());
				if (request.isActive?.() !== false) {
					request.fitView();
				}
			} catch (error) {
				// The layout did not complete; the canvas keeps its current
				// positions.
				log.warn("Layout failed", { error });
			}
		}
		running = false;
		if (again && latest) {
			again = false;
			pending = true;
			schedule(run);
		}
		again = false;
	};

	return (request: LayoutRequest) => {
		latest = request;
		if (running) {
			again = true;
			return;
		}
		if (pending) {
			return;
		}
		pending = true;
		schedule(run);
	};
}

const schedulers = new WeakMap<
	object,
	ReturnType<typeof createLayoutScheduler>
>();

/**
 * Asks for a layout of the canvas. Requests that share a layout function (one
 * per canvas store) share one scheduler.
 */
export function scheduleLayout(request: LayoutRequest) {
	let scheduler = schedulers.get(request.layoutNodes);
	if (!scheduler) {
		scheduler = createLayoutScheduler();
		schedulers.set(request.layoutNodes, scheduler);
	}
	scheduler(request);
}
