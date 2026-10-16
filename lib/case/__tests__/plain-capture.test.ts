import type { Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	isAuthoredContent,
	stripPluginAppearance,
} from "../plugin-display-capture";

const { toPngMock, toSvgMock } = vi.hoisted(() => ({
	toPngMock: vi.fn(),
	toSvgMock: vi.fn(),
}));

vi.mock("html-to-image", () => ({ toPng: toPngMock, toSvg: toSvgMock }));
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));
vi.mock("reactflow", async (importOriginal) => ({
	...(await importOriginal<typeof import("reactflow")>()),
}));
vi.mock("@/lib/export", () => ({
	createTemplateFromPreset: () => ({
		render: (input: unknown) => Promise.resolve(input),
	}),
	exporterRegistry: {
		get: () => ({
			export: () =>
				Promise.resolve({
					success: true,
					blob: new Blob(["report"]),
					filename: "report.pdf",
				}),
		}),
	},
}));

const { exportDiagramImage } = await import("../image-export");
const { exportDocument } = await import("../document-export");

const EDGE_STYLE =
	"stroke: var(--destructive); stroke-width: 3; stroke-opacity: 0.35;";

/** What a capture saw while it ran: the filter it was given, and the canvas at that moment. */
interface Seen {
	badgeKept: boolean;
	cardKept: boolean;
	controlsKept: boolean;
	edgeStyle: string;
	fillKept: boolean;
	plainEdgeStyle: string;
}

let seen: Seen | undefined;
let canvas: {
	badge: HTMLElement;
	card: HTMLElement;
	controls: HTMLElement;
	edge: SVGPathElement;
	fill: HTMLElement;
	plainEdge: SVGPathElement;
	viewport: HTMLElement;
};

function element(
	tag: string,
	attributes: Record<string, string> = {}
): HTMLElement {
	const created = document.createElement(tag);
	for (const [name, value] of Object.entries(attributes)) {
		created.setAttribute(name, value);
	}
	return created;
}

function edgePath(attributes: Record<string, string>): SVGPathElement {
	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("class", "react-flow__edge-path");
	for (const [name, value] of Object.entries(attributes)) {
		path.setAttribute(name, value);
	}
	return path;
}

beforeEach(() => {
	document.body.replaceChildren();
	const viewport = element("div", { class: "react-flow__viewport" });
	const card = element("div", { "data-appearance": "positive" });
	const fill = element("span", { "data-plugin-display": "" });
	const badge = element("div", { "data-plugin-display": "" });
	const controls = element("div", { class: "react-flow__controls" });
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	const edge = edgePath({ "data-appearance": "negative", style: EDGE_STYLE });
	const plainEdge = edgePath({ style: "stroke-width: 2;" });
	svg.append(edge, plainEdge);
	card.append(fill, badge);
	viewport.append(card, svg, controls);
	document.body.append(viewport);
	canvas = { viewport, card, fill, badge, controls, edge, plainEdge };

	seen = undefined;
	const record = (
		_target: HTMLElement,
		options: { filter?: (node: HTMLElement) => boolean }
	) => {
		const keep = options.filter ?? (() => true);
		seen = {
			badgeKept: keep(canvas.badge),
			cardKept: keep(canvas.card),
			controlsKept: keep(canvas.controls),
			edgeStyle: canvas.edge.getAttribute("style") ?? "",
			fillKept: keep(canvas.fill),
			plainEdgeStyle: canvas.plainEdge.getAttribute("style") ?? "",
		};
		return Promise.resolve("data:image/png;base64,AAAA");
	};
	toPngMock.mockImplementation(record);
	toSvgMock.mockImplementation(record);
});

afterEach(() => {
	document.body.replaceChildren();
	toPngMock.mockReset();
	toSvgMock.mockReset();
});

const NODE: Node = {
	id: "n1",
	position: { x: 0, y: 0 },
	width: 100,
	height: 50,
	data: {},
};

describe("what a capture leaves out", () => {
	it("drops an element that only shows a plugin's display, and keeps the rest", () => {
		expect(isAuthoredContent(canvas.fill)).toBe(false);
		expect(isAuthoredContent(canvas.badge)).toBe(false);
		expect(isAuthoredContent(canvas.card)).toBe(true);
		expect(isAuthoredContent(canvas.edge as unknown as HTMLElement)).toBe(true);
	});

	it("removes a plugin's colour from its edges, and only theirs, until restored", () => {
		const restore = stripPluginAppearance(canvas.viewport);

		expect(canvas.edge.style.stroke).toBe("");
		expect(canvas.edge.style.strokeWidth).toBe("");
		expect(canvas.edge.style.getPropertyValue("stroke-opacity")).toBe("");
		expect(canvas.plainEdge.style.strokeWidth).toBe("2");

		restore();

		expect(canvas.edge.getAttribute("style")).toBe(EDGE_STYLE);
	});

	it("leaves a colour the canvas set while the picture was taken, and puts back the rest", () => {
		const restore = stripPluginAppearance(canvas.viewport);
		canvas.edge.style.stroke = "var(--success)";

		restore();

		expect(canvas.edge.style.stroke).toBe("var(--success)");
		expect(canvas.edge.style.strokeWidth).toBe("3");
		expect(canvas.edge.style.getPropertyValue("stroke-opacity")).toBe("0.35");
	});

	it("removes the fade from a line that has no tone, and puts it back", () => {
		const fadedOnly = edgePath({
			"data-appearance": "plain",
			style: "stroke-opacity: 0.35;",
		});
		canvas.viewport.append(fadedOnly);

		const restore = stripPluginAppearance(canvas.viewport);

		expect(fadedOnly.style.getPropertyValue("stroke-opacity")).toBe("");

		restore();

		expect(fadedOnly.getAttribute("style")).toBe("stroke-opacity: 0.35;");
	});
});

describe("an image export", () => {
	it.each([
		["png", toPngMock],
		["svg", toSvgMock],
	] as const)("leaves the live look, badges and dots out of a %s", async (format, capture) => {
		await exportDiagramImage({
			caseName: "A case",
			format,
			nodes: [NODE],
		});

		expect(capture).toHaveBeenCalledTimes(1);
		expect(seen).toMatchObject({
			badgeKept: false,
			fillKept: false,
			cardKept: true,
			controlsKept: false,
		});
		expect(seen?.edgeStyle).not.toContain("--destructive");
		expect(seen?.plainEdgeStyle).toBe("stroke-width: 2;");
	});

	it("puts the edge colours back once the image is taken, and when it fails", async () => {
		await exportDiagramImage({
			caseName: "A case",
			format: "png",
			nodes: [NODE],
		});
		expect(canvas.edge.getAttribute("style")).toBe(EDGE_STYLE);

		toPngMock.mockRejectedValueOnce(new Error("capture failed"));
		await expect(
			exportDiagramImage({ caseName: "A case", format: "png", nodes: [NODE] })
		).rejects.toThrow("capture failed");
		expect(canvas.edge.getAttribute("style")).toBe(EDGE_STYLE);
	});
});

describe("a report diagram", () => {
	it("leaves the live look, badges and dots out of the picture", async () => {
		await exportDocument({
			caseData: {} as never,
			caseName: "A case",
			edges: [],
			format: "pdf",
			includeDiagram: true,
			layoutDirection: "TB",
			nodes: [{ ...NODE, type: "goal" }],
			applyLayout: vi.fn(),
			restoreLayout: vi.fn(),
			template: "standard" as never,
		});

		expect(toPngMock).toHaveBeenCalledTimes(1);
		expect(seen).toMatchObject({
			badgeKept: false,
			fillKept: false,
			cardKept: true,
		});
		expect(seen?.edgeStyle).not.toContain("--destructive");
		expect(canvas.edge.getAttribute("style")).toBe(EDGE_STYLE);
	});
});
