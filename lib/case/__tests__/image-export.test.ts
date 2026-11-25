import { saveAs } from "file-saver";
import { toPng, toSvg } from "html-to-image";
import type { Edge, Node } from "reactflow";
import { getNodesBounds, getViewportForBounds } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import { layoutForExport } from "../document-export";
import {
	exportDiagramImage,
	exportFilteredDiagramImage,
	type FilteredImageExportOptions,
	type ImageExportOptions,
	type ImageFormat,
	type ImageScale,
} from "../image-export";

// The shared test setup replaces the whole canvas package; the bounds helpers are plain functions, so the real ones run here.
vi.mock("reactflow", async () => await vi.importActual("reactflow"));
vi.mock("html-to-image", async (importOriginal) => ({
	...(await importOriginal<typeof import("html-to-image")>()),
	toPng: vi.fn(),
	toSvg: vi.fn(),
}));
vi.mock("file-saver", async (importOriginal) => ({
	...(await importOriginal<typeof import("file-saver")>()),
	saveAs: vi.fn(),
}));

const mockedToPng = vi.mocked(toPng);
const mockedToSvg = vi.mocked(toSvg);
const mockedSaveAs = vi.mocked(saveAs);

const PNG_URL = "data:image/png;base64,AAAA";
const SVG_HEAD = "data:image/svg+xml;charset=utf-8,";
const SAVED_BLOB = new Blob(["picture"], { type: "image/test" });
const NOT_PREPARED = "The SVG image could not be prepared";

function svgUrl(markup: string): string {
	return `${SVG_HEAD}${encodeURIComponent(markup)}`;
}

function box(id: string, x: number, y: number, w = 100, h = 100): Node {
	return {
		id,
		type: "property",
		position: { x, y },
		width: w,
		height: h,
		data: {},
	};
}

function link(id: string, source: string, target: string): Edge {
	return { id, source, target };
}

/** A root with two children, one of which has a child of its own. */
function tree(): { nodes: Node[]; edges: Edge[] } {
	return {
		nodes: [
			box("root", 0, 0),
			box("left", 0, 200),
			box("right", 300, 200),
			box("leaf", 0, 400),
		],
		edges: [
			link("e1", "root", "left"),
			link("e2", "root", "right"),
			link("e3", "left", "leaf"),
		],
	};
}

function putCanvasInPage() {
	document.body.innerHTML = `<div class="react-flow__viewport"><svg>
		<path id="coloured" class="react-flow__edge-path" stroke="teal" stroke-width="7" d="M0"></path>
		<path id="bare" class="react-flow__edge-path" d="M1"></path>
	</svg></div>`;
}

function viewportElement(): Element {
	return document.querySelector(".react-flow__viewport")!;
}

/** Lets the export's waits run on the fake clock, then reports how it ended. */
async function settle(
	promise: Promise<void>
): Promise<PromiseSettledResult<void>> {
	let outcome: PromiseSettledResult<void> | undefined;
	promise.then(
		() => {
			outcome = { status: "fulfilled", value: undefined };
		},
		(reason) => {
			outcome = { status: "rejected", reason };
		}
	);
	for (let i = 0; i < 200 && !outcome; i++) {
		await vi.advanceTimersByTimeAsync(100);
		await new Promise((resolve) => setImmediate(resolve));
	}
	return outcome!;
}

async function failureOf(promise: Promise<void>): Promise<Error> {
	const outcome = await settle(promise);
	if (outcome.status !== "rejected") {
		throw new Error("the export was expected to fail");
	}
	return outcome.reason as Error;
}

function plain(
	overrides: Partial<ImageExportOptions> = {}
): ImageExportOptions {
	return {
		caseName: "Case",
		format: "png",
		nodes: tree().nodes,
		...overrides,
	};
}

function filtered(
	overrides: Partial<FilteredImageExportOptions> = {}
): FilteredImageExportOptions {
	const { nodes, edges } = tree();
	return {
		caseName: "Case",
		format: "png",
		nodes,
		edges,
		layoutDirection: "TB",
		applyLayout: vi.fn(),
		restoreLayout: vi.fn(),
		maxDepth: 1,
		...overrides,
	};
}

function savedName(): string {
	return mockedSaveAs.mock.calls[0]![1] as string;
}

function pictureOptions() {
	return mockedToPng.mock.calls[0]![1]!;
}

function at(year: number, month: number, day: number, h: number, m: number) {
	vi.setSystemTime(new Date(year, month - 1, day, h, m));
}

beforeEach(() => {
	vi.useFakeTimers({
		toFake: [
			"Date",
			"setTimeout",
			"clearTimeout",
			"requestAnimationFrame",
			"cancelAnimationFrame",
		],
	});
	vi.setSystemTime(new Date(2026, 2, 4, 5, 7));
	mockedToPng.mockReset().mockResolvedValue(PNG_URL);
	mockedToSvg.mockReset().mockResolvedValue(svgUrl("<svg></svg>"));
	mockedSaveAs.mockReset();
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({ blob: () => Promise.resolve(SAVED_BLOB) })
	);
	putCanvasInPage();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	resetLogSink();
	document.body.innerHTML = "";
});

describe("the saved file's name", () => {
	it.each([
		["My  Case: v2!", "my-case-v2"],
		["a  b", "a-b"],
		["---Edge---", "edge"],
		["x (y) z", "x-y-z"],
		["UPPER lower", "upper-lower"],
		["!!!", "diagram"],
		["", "diagram"],
	])("turns the case name %j into %j", async (caseName, expected) => {
		await exportDiagramImage(plain({ caseName }));

		expect(savedName()).toBe(`${expected}-2026-03-04T05-07.png`);
	});

	it("pads single-digit date and time parts and counts months from one", async () => {
		at(2026, 1, 2, 3, 4);
		await exportDiagramImage(plain());
		at(2026, 12, 25, 13, 45);
		await exportDiagramImage(plain());

		expect(mockedSaveAs.mock.calls.map((c) => c[1])).toStrictEqual([
			"case-2026-01-02T03-04.png",
			"case-2026-12-25T13-45.png",
		]);
	});

	it.each([
		[undefined, ""],
		[1, ""],
		[2, "@2x"],
		[3, "@3x"],
	] as const)("names a scale of %s with %j", async (scale, suffix) => {
		await exportDiagramImage(plain({ scale }));

		expect(savedName()).toBe(`case-2026-03-04T05-07${suffix}.png`);
	});

	it("ends the name with the chosen format", async () => {
		await exportDiagramImage(plain({ format: "svg" }));

		expect(savedName()).toBe("case-2026-03-04T05-07.svg");
	});
});

describe("which picture is asked for and what is saved", () => {
	it("asks for a PNG of the canvas viewport and saves what comes back", async () => {
		await exportDiagramImage(plain());

		expect(mockedToSvg).not.toHaveBeenCalled();
		expect(mockedToPng).toHaveBeenCalledTimes(1);
		expect(mockedToPng.mock.calls[0]![0]).toBe(viewportElement());
		expect(fetch).toHaveBeenCalledWith(PNG_URL);
		expect(mockedSaveAs).toHaveBeenCalledTimes(1);
		expect(mockedSaveAs.mock.calls[0]![0]).toBe(SAVED_BLOB);
	});

	it("asks for an SVG of the canvas viewport and saves the cleaned markup", async () => {
		mockedToSvg.mockResolvedValue(
			svgUrl(
				'<svg xmlns="http://www.w3.org/2000/svg" data-capturing=""><g data-faded="x" id="kept"/></svg>'
			)
		);

		await exportDiagramImage(plain({ format: "svg" }));

		expect(mockedToPng).not.toHaveBeenCalled();
		expect(mockedToSvg).toHaveBeenCalledTimes(1);
		expect(mockedToSvg.mock.calls[0]![0]).toBe(viewportElement());
		const url = vi.mocked(fetch).mock.calls[0]![0] as string;
		expect(url.startsWith(SVG_HEAD)).toBe(true);
		const markup = decodeURIComponent(url.slice(SVG_HEAD.length));
		expect(markup).toContain('id="kept"');
		expect(markup).not.toContain("data-faded");
		expect(markup).not.toContain("data-capturing");
		expect(mockedSaveAs.mock.calls[0]![0]).toBe(SAVED_BLOB);
	});

	it("saves no SVG whose markup cannot be cleaned", async () => {
		mockedToSvg.mockResolvedValue("data:image/png;base64,AAAA");

		const failure = await failureOf(
			exportDiagramImage(plain({ format: "svg" }))
		);

		expect(failure.message).toContain(NOT_PREPARED);
		expect(mockedSaveAs).not.toHaveBeenCalled();
	});

	it.each<ImageFormat>([
		"png",
		"svg",
	])("takes one picture for %s", async (format) => {
		await exportDiagramImage(plain({ format }));

		expect(mockedToPng.mock.calls.length + mockedToSvg.mock.calls.length).toBe(
			1
		);
		expect(mockedSaveAs).toHaveBeenCalledTimes(1);
	});
});

describe("the options given to the drawing package", () => {
	it("sets the background, cache and size from the visible nodes with room around them", async () => {
		const visible = [box("a", 0, 0, 100, 60), box("b", 400, 150, 80, 90)];
		const hidden = { ...box("c", 2000, 2000, 500, 500), hidden: true };

		await exportDiagramImage(plain({ nodes: [...visible, hidden] }));

		const bounds = getNodesBounds(visible);
		const options = pictureOptions();
		expect(options.backgroundColor).toBe("#ffffff");
		expect(options.cacheBust).toBe(true);
		expect(options.width).toBe(bounds.width + 200);
		expect(options.height).toBe(bounds.height + 200);
		const view = getViewportForBounds(
			bounds,
			bounds.width + 200,
			bounds.height + 200,
			0.5,
			2
		);
		expect(options.style).toStrictEqual({
			width: `${bounds.width + 200}px`,
			height: `${bounds.height + 200}px`,
			transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
		});
	});

	it.each([
		[undefined, 2],
		[1, 1],
		[2, 2],
		[3, 3],
	] as const)("uses a pixel ratio for scale %s of %s", async (scale, ratio) => {
		await exportDiagramImage(plain({ scale: scale as ImageScale | undefined }));

		expect(pictureOptions().pixelRatio).toBe(ratio);
	});
});

describe("the filter given to the drawing package", () => {
	async function captureFilter(): Promise<(node: HTMLElement) => boolean> {
		await exportDiagramImage(plain());
		return pictureOptions().filter as (node: HTMLElement) => boolean;
	}

	function withClass(name: string): HTMLElement {
		const el = document.createElement("div");
		el.classList.add(name);
		return el;
	}

	it.each([
		"react-flow__minimap",
		"react-flow__controls",
		"react-flow__panel",
		"react-flow__attribution",
	])("leaves out an element with class %s", async (name) => {
		const filter = await captureFilter();

		expect(filter(withClass(name))).toBe(false);
	});

	it("keeps nodes, edges and other elements", async () => {
		const filter = await captureFilter();

		expect(filter(withClass("react-flow__node"))).toBe(true);
		expect(filter(withClass("react-flow__edge"))).toBe(true);
	});

	it("keeps a text node", async () => {
		const filter = await captureFilter();

		expect(filter(document.createTextNode("x") as unknown as HTMLElement)).toBe(
			true
		);
	});

	it.each([
		"data-plugin-display",
		"data-derived-display",
	])("leaves out an element marked %s", async (attribute) => {
		const filter = await captureFilter();
		const el = document.createElement("div");
		el.setAttribute(attribute, "");

		expect(filter(el)).toBe(false);
	});
});

describe("refusals", () => {
	it("refuses when the canvas is not on the page", async () => {
		document.body.innerHTML = "";

		const failure = await failureOf(exportDiagramImage(plain()));

		expect(failure.message).toBe(
			"Diagram viewport not found. Please ensure the case is loaded."
		);
		expect(mockedToPng).not.toHaveBeenCalled();
		expect(mockedSaveAs).not.toHaveBeenCalled();
	});

	it("refuses when there are no nodes", async () => {
		const failure = await failureOf(exportDiagramImage(plain({ nodes: [] })));

		expect(failure.message).toBe(
			"No nodes to export. The diagram appears to be empty."
		);
		expect(mockedToPng).not.toHaveBeenCalled();
	});

	it("refuses when every node is hidden", async () => {
		const nodes = tree().nodes.map((n) => ({ ...n, hidden: true }));

		const failure = await failureOf(exportDiagramImage(plain({ nodes })));

		expect(failure.message).toBe("No visible nodes to export.");
		expect(mockedToPng).not.toHaveBeenCalled();
		expect(mockedSaveAs).not.toHaveBeenCalled();
	});
});

describe("the edge lines while the picture is taken", () => {
	function lineOf(id: string): Array<string | null> {
		const path = document.getElementById(id)!;
		return [path.getAttribute("stroke"), path.getAttribute("stroke-width")];
	}

	it("sets the export lines for the picture and puts the originals back", async () => {
		const seen: Array<Array<string | null>> = [];
		mockedToPng.mockImplementationOnce(() => {
			seen.push(lineOf("coloured"), lineOf("bare"));
			return Promise.resolve(PNG_URL);
		});

		await exportDiagramImage(plain());

		expect(seen).toStrictEqual([
			["#666666", "2"],
			["#666666", "2"],
		]);
		expect(lineOf("coloured")).toStrictEqual(["teal", "7"]);
		expect(lineOf("bare")).toStrictEqual([null, null]);
	});

	it("puts the originals back and passes the error on when the picture fails", async () => {
		mockedToPng.mockRejectedValue(new Error("no picture"));

		const failure = await failureOf(exportDiagramImage(plain()));

		expect(failure.message).toBe("no picture");
		expect(lineOf("coloured")).toStrictEqual(["teal", "7"]);
		expect(lineOf("bare")).toStrictEqual([null, null]);
		expect(mockedSaveAs).not.toHaveBeenCalled();
	});

	it("takes the plugin colour off an edge for the picture and gives it back", async () => {
		const path = document.getElementById("coloured")!;
		path.setAttribute("data-appearance", "warm");
		path.style.setProperty("stroke", "orange");
		let during = "unset";
		mockedToPng.mockImplementationOnce(() => {
			during = path.style.getPropertyValue("stroke");
			return Promise.resolve(PNG_URL);
		});

		await exportDiagramImage(plain());

		expect(during).toBe("");
		expect(path.style.getPropertyValue("stroke")).toBe("orange");
		expect(viewportElement().hasAttribute("data-capturing")).toBe(false);
	});
});

describe("the failure record", () => {
	it("logs the failure with its error before passing it on", async () => {
		vi.stubEnv("LOG_LEVEL", "error");
		const entries: LogEntry[] = [];
		setLogSink((entry) => entries.push(entry));
		mockedToPng.mockRejectedValue(new Error("no picture"));

		await failureOf(exportDiagramImage(plain()));

		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			level: "error",
			msg: "Export failed",
			component: "image-export",
		});
		expect(JSON.stringify(entries[0]!.error)).toContain("no picture");
	});
});

describe("exportFilteredDiagramImage without a depth", () => {
	it.each([
		["null", null],
		["missing", undefined],
	])("captures the canvas as it is when the depth is %s", async (_label, maxDepth) => {
		const options = filtered({ maxDepth, scale: 3 });

		await settle(exportFilteredDiagramImage(options));

		expect(options.applyLayout).not.toHaveBeenCalled();
		expect(options.restoreLayout).not.toHaveBeenCalled();
		expect(mockedToPng).toHaveBeenCalledTimes(1);
		const bounds = getNodesBounds(tree().nodes);
		expect(pictureOptions().width).toBe(bounds.width + 200);
		expect(pictureOptions().pixelRatio).toBe(3);
		expect(savedName()).toBe("case-2026-03-04T05-07@3x.png");
	});
});

describe("exportFilteredDiagramImage with a depth", () => {
	function applied(options: FilteredImageExportOptions) {
		const [nodes, edges, direction] = vi.mocked(options.applyLayout).mock
			.calls[0]!;
		return { nodes, edges, direction };
	}

	it.each([
		[0, ["root"], []],
		[1, ["left", "right", "root"], ["e1", "e2"]],
		[5, ["leaf", "left", "right", "root"], ["e1", "e2", "e3"]],
	])("keeps what is within depth %i", async (maxDepth, nodeIds, edgeIds) => {
		const options = filtered({ maxDepth });

		const outcome = await settle(exportFilteredDiagramImage(options));

		expect(outcome.status).toBe("fulfilled");
		const used = applied(options);
		expect(used.nodes.map((n: Node) => n.id).sort()).toStrictEqual(nodeIds);
		expect(used.edges.map((e: Edge) => e.id).sort()).toStrictEqual(edgeIds);
	});

	it("leaves the nodes and edges it was given as they were", async () => {
		const options = filtered({ maxDepth: 1 });
		const before = JSON.stringify([options.nodes, options.edges]);

		await settle(exportFilteredDiagramImage(options));

		expect(JSON.stringify([options.nodes, options.edges])).toBe(before);
	});

	it("lays out with room for edges and hands the layout and direction to the canvas", async () => {
		const options = filtered({ maxDepth: 5, layoutDirection: "LR" });
		const { nodes, edges } = tree();

		await settle(exportFilteredDiagramImage(options));

		const used = applied(options);
		vi.useRealTimers();
		const expected = await layoutForExport(nodes, edges, "LR", {
			nodeSpacing: 40,
			layerSpacing: 60,
		});
		const compact = await layoutForExport(nodes, edges, "LR");
		const positions = (list: Node[]) =>
			list.map((n) => [n.id, n.position.x, n.position.y]).sort();
		expect(used.direction).toBe(expected.direction);
		expect(positions(used.nodes)).toStrictEqual(positions(expected.nodes));
		expect(positions(used.nodes)).not.toStrictEqual(positions(compact.nodes));
	});

	it("takes the picture of the laid-out nodes after applying and restores afterwards", async () => {
		const order: string[] = [];
		const options = filtered({
			scale: 2,
			applyLayout: vi.fn(() => order.push("apply")),
			restoreLayout: vi.fn(() => order.push("restore")),
		});
		mockedToPng.mockImplementationOnce(() => {
			order.push("picture");
			return Promise.resolve(PNG_URL);
		});

		await settle(exportFilteredDiagramImage(options));

		expect(order).toStrictEqual(["apply", "picture", "restore"]);
		const bounds = getNodesBounds(applied(options).nodes);
		expect(pictureOptions().width).toBe(bounds.width + 200);
		expect(pictureOptions().pixelRatio).toBe(2);
		expect(savedName()).toBe("case-2026-03-04T05-07@2x.png");
	});

	it("uses a pixel ratio of two when no scale is given", async () => {
		await settle(exportFilteredDiagramImage(filtered()));

		expect(pictureOptions().pixelRatio).toBe(2);
	});

	it("saves an SVG when asked for one", async () => {
		await settle(exportFilteredDiagramImage(filtered({ format: "svg" })));

		expect(mockedToSvg).toHaveBeenCalledTimes(1);
		expect(mockedToPng).not.toHaveBeenCalled();
		expect(savedName()).toBe("case-2026-03-04T05-07.svg");
	});

	it("restores the canvas and passes the error on when the picture fails", async () => {
		mockedToPng.mockRejectedValue(new Error("no picture"));
		const options = filtered();

		const failure = await failureOf(exportFilteredDiagramImage(options));

		expect(failure.message).toBe("no picture");
		expect(options.restoreLayout).toHaveBeenCalledTimes(1);
		expect(mockedSaveAs).not.toHaveBeenCalled();
	});

	it("restores the canvas once after a successful picture", async () => {
		const options = filtered();

		await settle(exportFilteredDiagramImage(options));

		expect(options.restoreLayout).toHaveBeenCalledTimes(1);
		expect(options.applyLayout).toHaveBeenCalledTimes(1);
	});
});
