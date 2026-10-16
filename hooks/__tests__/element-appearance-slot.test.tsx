import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type ElementAppearance,
	type ElementAppearanceRegistration,
	elementAppearanceSlot,
} from "@/lib/plugins/slots";
import useStore from "@/store/store";
import {
	useEdgeAppearance,
	useNodeAppearance,
} from "../use-element-appearance";
import { useEnabledPluginIds } from "../use-plugin-enablement";

vi.mock("../use-plugin-enablement", () => ({
	useEnabledPluginIds: vi.fn(),
}));

const POSITIVE: ElementAppearance = { tone: "positive", faded: false };
const NEGATIVE: ElementAppearance = { tone: "negative", faded: true };

function plugin(pluginId: string, answer: ElementAppearance | null) {
	return {
		pluginId,
		useAppearance: vi.fn(() => answer),
	} satisfies ElementAppearanceRegistration;
}

function registered(...entries: ElementAppearanceRegistration[]) {
	vi.spyOn(elementAppearanceSlot, "list").mockReturnValue(entries);
}

function enabled(ids: string[], loading = false) {
	vi.mocked(useEnabledPluginIds).mockReturnValue({
		enabledPluginIds: new Set(ids),
		loading,
	});
}

beforeEach(() => {
	useStore.setState({ assuranceCase: { id: 77 } as never });
});

afterEach(() => {
	vi.restoreAllMocks();
	useStore.setState({ assuranceCase: null });
});

describe("the element-appearance slot: who answers", () => {
	it("takes the first enabled plugin that has an answer", () => {
		const quiet = plugin("a.quiet", null);
		const first = plugin("b.first", POSITIVE);
		const second = plugin("c.second", NEGATIVE);
		registered(quiet, first, second);
		enabled(["a.quiet", "b.first", "c.second"]);

		const { result } = renderHook(() => useNodeAppearance("e1", "evidence"));

		expect(result.current).toEqual(POSITIVE);
	});

	it("ignores a plugin that is off, even if it would answer, and takes the next one", () => {
		const off = plugin("a.off", NEGATIVE);
		const on = plugin("b.on", POSITIVE);
		registered(off, on);
		enabled(["b.on"]);

		const { result } = renderHook(() => useNodeAppearance("e1", "evidence"));

		expect(result.current).toEqual(POSITIVE);
	});

	it("tells a plugin that is off that it is off, and a plugin that is on that it is on", () => {
		const off = plugin("a.off", null);
		const on = plugin("b.on", null);
		registered(off, on);
		enabled(["b.on"]);

		renderHook(() => useNodeAppearance("e1", "evidence"));

		expect(off.useAppearance).toHaveBeenCalledWith(expect.anything(), false);
		expect(on.useAppearance).toHaveBeenCalledWith(expect.anything(), true);
	});

	it("tells every plugin it is off while the list of enabled plugins is still loading, and draws as plain", () => {
		const loading = plugin("a.loading", POSITIVE);
		registered(loading);
		enabled(["a.loading"], true);

		const { result } = renderHook(() => useNodeAppearance("e1", "evidence"));

		expect(loading.useAppearance).toHaveBeenCalledWith(
			expect.anything(),
			false
		);
		expect(result.current).toBeNull();
	});

	it("asks every registered plugin on every render, even after an earlier one has answered", () => {
		const first = plugin("a.first", POSITIVE);
		const second = plugin("b.second", NEGATIVE);
		registered(first, second);
		enabled(["a.first", "b.second"]);

		const { rerender } = renderHook(() => useNodeAppearance("e1", "evidence"));
		rerender();

		expect(first.useAppearance).toHaveBeenCalledTimes(2);
		expect(second.useAppearance).toHaveBeenCalledTimes(2);
	});

	it("answers nothing, for a node or a line, when no plugin is registered", () => {
		registered();
		enabled(["tea.health"]);

		const node = renderHook(() => useNodeAppearance("e1", "evidence"));
		const edge = renderHook(() => useEdgeAppearance("c1", "e1"));

		expect(node.result.current).toBeNull();
		expect(edge.result.current).toBeNull();
	});

	it("answers nothing when every plugin has no opinion", () => {
		registered(plugin("a.quiet", null), plugin("b.quiet", null));
		enabled(["a.quiet", "b.quiet"]);

		const { result } = renderHook(() => useNodeAppearance("e1", "evidence"));

		expect(result.current).toBeNull();
	});
});

describe("the element-appearance slot: what a plugin is asked", () => {
	it("asks about a node by its element id and type, in the canvas's case", () => {
		const asked = plugin("a.asked", null);
		registered(asked);
		enabled(["a.asked"]);

		renderHook(() => useNodeAppearance("element-9", "evidence"));

		expect(asked.useAppearance).toHaveBeenCalledWith(
			{
				kind: "node",
				caseId: "77",
				elementId: "element-9",
				elementType: "evidence",
			},
			true
		);
	});

	it("asks about a line by the ids of the two elements it joins", () => {
		const asked = plugin("a.asked", null);
		registered(asked);
		enabled(["a.asked"]);

		renderHook(() => useEdgeAppearance("claim-1", "evidence-9"));

		expect(asked.useAppearance).toHaveBeenCalledWith(
			{
				kind: "edge",
				caseId: "77",
				sourceElementId: "claim-1",
				targetElementId: "evidence-9",
			},
			true
		);
	});

	it("passes empty ids for a line that does not know its elements, so no plugin can claim it", () => {
		const asked = plugin("a.asked", null);
		registered(asked);
		enabled(["a.asked"]);

		renderHook(() => useEdgeAppearance(undefined, undefined));

		expect(asked.useAppearance).toHaveBeenCalledWith(
			{
				kind: "edge",
				caseId: "77",
				sourceElementId: "",
				targetElementId: "",
			},
			true
		);
	});

	it("gives an empty case id where no case is loaded", () => {
		const asked = plugin("a.asked", null);
		registered(asked);
		enabled(["a.asked"]);
		useStore.setState({ assuranceCase: null });

		renderHook(() => useNodeAppearance("element-9", "evidence"));

		expect(asked.useAppearance).toHaveBeenCalledWith(
			expect.objectContaining({ caseId: "" }),
			true
		);
	});

	it("follows the plugin's answer when it changes between renders", () => {
		let answer: ElementAppearance | null = POSITIVE;
		const changing = {
			pluginId: "a.changing",
			useAppearance: vi.fn(() => answer),
		};
		registered(changing);
		enabled(["a.changing"]);

		const { result, rerender } = renderHook(() =>
			useNodeAppearance("e1", "evidence")
		);
		expect(result.current).toEqual(POSITIVE);
		answer = NEGATIVE;
		rerender();

		expect(result.current).toEqual(NEGATIVE);
	});
});
