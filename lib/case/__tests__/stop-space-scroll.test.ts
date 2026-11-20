// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { stopSpaceScrollOnDiagramItem } from "../stop-space-scroll";

type SpaceEvent = Parameters<typeof stopSpaceScrollOnDiagramItem>[0];

function press(
	target: EventTarget | null,
	init: { key?: string; code?: string } = { key: " ", code: "Space" }
) {
	const preventDefault = vi.fn();
	stopSpaceScrollOnDiagramItem({
		key: init.key ?? "",
		code: init.code ?? "",
		target,
		preventDefault,
	} as unknown as SpaceEvent);
	return preventDefault;
}

function element(className: string, parent?: Element) {
	const el = document.createElement("div");
	el.className = className;
	parent?.appendChild(el);
	return el;
}

describe("stopSpaceScrollOnDiagramItem", () => {
	it("prevents the default scroll for Space on a node", () => {
		expect(press(element("react-flow__node"))).toHaveBeenCalledTimes(1);
	});

	it("prevents the default scroll for Space on an edge", () => {
		expect(press(element("react-flow__edge"))).toHaveBeenCalledTimes(1);
	});

	it("leaves Space on a button inside a node alone", () => {
		const node = element("react-flow__node");
		const button = document.createElement("button");
		node.appendChild(button);
		expect(press(button)).not.toHaveBeenCalled();
	});

	it("leaves Space elsewhere alone", () => {
		expect(press(element("something-else"))).not.toHaveBeenCalled();
		expect(press(null)).not.toHaveBeenCalled();
	});

	it("ignores other keys on a node", () => {
		const node = element("react-flow__node");
		expect(press(node, { key: "Enter", code: "Enter" })).not.toHaveBeenCalled();
	});
});
