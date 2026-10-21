import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import type { Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useStore from "@/store/store";
import { useUnsupportedMarker } from "../use-unsupported-marker";

function node(
	id: string,
	type: string,
	parentId: string | null,
	data: Record<string, unknown> = {}
): Node {
	return { id, type, position: { x: 0, y: 0 }, data: { parentId, ...data } };
}

const RENDER_LOOP_MESSAGE = /Maximum update depth|getSnapshot|infinite loop/i;

const TOP_GOAL = node("goal-g", "goal", null);
const LONE_CLAIM: Node[] = [TOP_GOAL, node("property-p", "property", "goal-g")];
const SUPPORTED_CLAIM: Node[] = [
	...LONE_CLAIM,
	node("evidence-e", "evidence", "property-p"),
];

function set(state: Partial<ReturnType<typeof useStore.getState>>) {
	act(() => {
		useStore.setState(state);
	});
}

beforeEach(() => {
	useStore.setState({
		nodes: [],
		readOnlyCanvas: false,
		showUnsupportedMarkers: true,
	});
});

afterEach(() => {
	useStore.setState({
		assuranceCase: null,
		nodes: [],
		readOnlyCanvas: false,
		showUnsupportedMarkers: useStore.getInitialState().showUnsupportedMarkers,
	});
	vi.restoreAllMocks();
});

describe("useUnsupportedMarker", () => {
	describe("as the page changes", () => {
		it("appears when the setting finishes loading as on", () => {
			useStore.setState({ nodes: LONE_CLAIM, showUnsupportedMarkers: null });
			const { result } = renderHook(() => useUnsupportedMarker("property-p"));
			expect(result.current).toBe(false);

			set({ showUnsupportedMarkers: true });

			expect(result.current).toBe(true);
		});

		it("never appears when the setting finishes loading as off", () => {
			useStore.setState({ nodes: LONE_CLAIM, showUnsupportedMarkers: null });
			const seen: boolean[] = [];
			renderHook(() => {
				const value = useUnsupportedMarker("property-p");
				seen.push(value);
				return value;
			});

			set({ showUnsupportedMarkers: false });

			expect(seen.every((value) => value === false)).toBe(true);
		});

		it("goes and comes back as the viewer switches it off and on", () => {
			useStore.setState({ nodes: LONE_CLAIM });
			const { result } = renderHook(() => useUnsupportedMarker("property-p"));
			expect(result.current).toBe(true);

			set({ showUnsupportedMarkers: false });
			expect(result.current).toBe(false);

			set({ showUnsupportedMarkers: true });
			expect(result.current).toBe(true);
		});

		it("goes when the read-only canvas is entered and comes back when it is left", () => {
			useStore.setState({ nodes: LONE_CLAIM });
			const { result } = renderHook(() => useUnsupportedMarker("property-p"));
			expect(result.current).toBe(true);

			set({ readOnlyCanvas: true });
			expect(result.current).toBe(false);

			set({ readOnlyCanvas: false });
			expect(result.current).toBe(true);
		});

		it("goes when something is added beneath the claim and comes back when it is removed", () => {
			useStore.setState({ nodes: LONE_CLAIM });
			const { result } = renderHook(() => useUnsupportedMarker("property-p"));
			expect(result.current).toBe(true);

			set({ nodes: SUPPORTED_CLAIM });
			expect(result.current).toBe(false);

			set({ nodes: LONE_CLAIM });
			expect(result.current).toBe(true);
		});

		it("is not put off by a defeater being added beneath the claim", () => {
			useStore.setState({ nodes: LONE_CLAIM });
			const { result } = renderHook(() => useUnsupportedMarker("property-p"));

			set({
				nodes: [
					...LONE_CLAIM,
					node("property-d", "property", "property-p", { isDefeater: true }),
				],
			});

			expect(result.current).toBe(true);
		});

		it("goes when the author sets a status that explains the gap", () => {
			useStore.setState({ nodes: LONE_CLAIM });
			const { result } = renderHook(() => useUnsupportedMarker("property-p"));
			expect(result.current).toBe(true);

			set({
				nodes: [
					TOP_GOAL,
					node("property-p", "property", "goal-g", {
						assertionStatus: "NEEDS_SUPPORT",
					}),
				],
			});

			expect(result.current).toBe(false);
		});

		it("answers for the new node when the card is reused for another id", () => {
			useStore.setState({
				nodes: [...SUPPORTED_CLAIM, node("property-q", "property", "goal-g")],
			});
			const { result, rerender } = renderHook(
				({ id }) => useUnsupportedMarker(id),
				{ initialProps: { id: "property-p" } }
			);
			expect(result.current).toBe(false);

			rerender({ id: "property-q" });

			expect(result.current).toBe(true);
		});

		it("lets two cards on the same diagram answer differently", () => {
			useStore.setState({
				nodes: [...SUPPORTED_CLAIM, node("property-q", "property", "goal-g")],
			});

			const supported = renderHook(() => useUnsupportedMarker("property-p"));
			const open = renderHook(() => useUnsupportedMarker("property-q"));

			expect([supported.result.current, open.result.current]).toEqual([
				false,
				true,
			]);
		});
	});

	describe("without looping", () => {
		it("draws a bounded number of times and logs no render-loop error, even under StrictMode", () => {
			const errors = vi.spyOn(console, "error").mockImplementation(() => {
				// The assertions below read what was logged.
			});
			useStore.setState({ nodes: LONE_CLAIM });
			let renders = 0;

			renderHook(
				() => {
					renders += 1;
					return useUnsupportedMarker("property-p");
				},
				{ wrapper: StrictMode }
			);
			for (let i = 0; i < 25; i += 1) {
				set({ nodes: i % 2 ? LONE_CLAIM : SUPPORTED_CLAIM });
			}

			expect(renders).toBeLessThan(120);
			expect(
				errors.mock.calls.filter((call) =>
					RENDER_LOOP_MESSAGE.test(String(call[0]))
				)
			).toEqual([]);
		});

		it("does not draw a card again for a change elsewhere on the diagram", () => {
			useStore.setState({
				nodes: [...SUPPORTED_CLAIM, node("property-q", "property", "goal-g")],
			});
			let renders = 0;
			renderHook(() => {
				renders += 1;
				return useUnsupportedMarker("property-p");
			});
			const before = renders;

			set({
				nodes: [
					...SUPPORTED_CLAIM,
					node("property-q", "property", "goal-g"),
					node("property-r", "property", "goal-g"),
					node("evidence-r", "evidence", "property-r"),
				],
			});
			set({
				nodes: [
					...SUPPORTED_CLAIM,
					node("property-q", "property", "goal-g", { name: "renamed" }),
				],
			});

			expect(renders).toBe(before);
		});

		it("answers for a thousand cards on one diagram without drawing any of them again for an unrelated edit", () => {
			const claims: Node[] = [node("goal-g", "goal", null)];
			for (let i = 0; i < 1000; i += 1) {
				claims.push(node(`property-${i}`, "property", "goal-g"));
				claims.push(node(`evidence-${i}`, "evidence", `property-${i}`));
			}
			useStore.setState({ nodes: claims });
			let renders = 0;
			const hooks = Array.from({ length: 50 }, (_, i) =>
				renderHook(() => {
					renders += 1;
					return useUnsupportedMarker(`property-${i * 20}`);
				})
			);
			const before = renders;

			set({ nodes: [...claims, node("property-new", "property", "goal-g")] });

			expect(renders).toBe(before);
			expect(hooks.every((hook) => hook.result.current === false)).toBe(true);
		});
	});
});
