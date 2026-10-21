import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoScreenshot } from "../use-auto-screenshot";

vi.mock("html-to-image", () => ({ toPng: vi.fn() }));

import { toPng } from "html-to-image";

const EDGE_STYLE = "stroke: var(--success); stroke-width: 3;";

interface Seen {
	badgeKept: boolean;
	derivedKept: boolean;
	edgeStyle: string;
	fillKept: boolean;
}

let target: HTMLDivElement;
let edge: SVGPathElement;
let badge: HTMLElement;
let derived: HTMLElement;
let fill: HTMLElement;
let seen: Seen | undefined;

beforeEach(() => {
	target = document.createElement("div");
	target.id = "screenshot-target";
	badge = document.createElement("div");
	badge.setAttribute("data-plugin-display", "");
	derived = document.createElement("div");
	derived.setAttribute("data-derived-display", "");
	fill = document.createElement("span");
	fill.setAttribute("data-plugin-display", "");
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	edge = document.createElementNS("http://www.w3.org/2000/svg", "path");
	edge.setAttribute("class", "react-flow__edge-path");
	edge.setAttribute("data-appearance", "positive");
	edge.setAttribute("style", EDGE_STYLE);
	svg.append(edge);
	target.append(badge, derived, fill, svg);
	document.body.append(target);

	seen = undefined;
	vi.spyOn(global, "fetch").mockResolvedValue(new Response(null));
	vi.mocked(toPng).mockImplementation((_node, options) => {
		const keep = options?.filter ?? (() => true);
		seen = {
			badgeKept: keep(badge),
			derivedKept: keep(derived),
			fillKept: keep(fill),
			edgeStyle: edge.getAttribute("style") ?? "",
		};
		return Promise.resolve("data:image/png;base64,AAAAAAAAAAAAAAAA");
	});
});

afterEach(() => {
	target.remove();
	vi.mocked(toPng).mockReset();
	vi.restoreAllMocks();
});

describe("the dashboard thumbnail", () => {
	it("is taken without the live look, badges and dots, which are put back afterwards", async () => {
		const { result } = renderHook(() =>
			useAutoScreenshot({
				caseId: "case-1",
				canEdit: true,
				selector: "#screenshot-target",
			})
		);

		await result.current.captureScreenshot();

		expect(seen).toEqual({
			badgeKept: false,
			derivedKept: false,
			fillKept: false,
			edgeStyle: "",
		});
		expect(edge.getAttribute("style")).toBe(EDGE_STYLE);
	});

	it("puts the edge colours back when the capture fails", async () => {
		vi.mocked(toPng).mockRejectedValueOnce(new Error("capture failed"));
		const { result } = renderHook(() =>
			useAutoScreenshot({
				caseId: "case-1",
				canEdit: true,
				selector: "#screenshot-target",
			})
		);

		await result.current.captureScreenshot();

		expect(edge.getAttribute("style")).toBe(EDGE_STYLE);
	});
});
