import { saveAs } from "file-saver";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import type { Edge, Node } from "reactflow";
import { getNodesBounds } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportFormat, TemplatePreset } from "@/lib/export";
import type { PlainCase } from "../defined-terms";
import {
	BRANCH_DIAGRAM_THRESHOLD,
	type DiagramMode,
	exportDocument,
	layoutForExport,
} from "../document-export";

// The shared test setup replaces the whole canvas package; the bounds helpers are plain functions, so the real ones run here.
vi.mock("reactflow", async () => await vi.importActual("reactflow"));
vi.mock("html-to-image", async (importOriginal) => ({
	...(await importOriginal<typeof import("html-to-image")>()),
	toPng: vi.fn(),
}));
vi.mock("file-saver", async (importOriginal) => ({
	...(await importOriginal<typeof import("file-saver")>()),
	saveAs: vi.fn(),
}));

const DATED_DOCX_NAME = /^flow-case-\d{4}-\d{2}-\d{2}\.docx$/;
const DATED_ZIP_NAME = /^flow-case-\d{4}-\d{2}-\d{2}\.zip$/;
const TRANSFORM_STYLE = /^translate\(-?[\d.]+px, -?[\d.]+px\) scale\([\d.]+\)$/;
const LOGO_URL = "/images/logos/tea-logo-full-light.png";
const TINY_PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const caseData: PlainCase = {
	version: "1.0",
	exportedAt: "2024-01-15T10:00:00Z",
	case: { name: "Flow Case", description: "A case used to test exports" },
	tree: {
		id: "g1",
		type: "GOAL",
		name: "G1",
		description: "Top goal",
		inSandbox: false,
		children: [],
	},
};

function canvasNode(id: string, name: string): Node {
	return {
		id,
		type: "property",
		position: { x: 0, y: 0 },
		width: 100,
		height: 100,
		data: { name },
	};
}

/** G1 with two branches; each branch has one child. */
function diagram(): { nodes: Node[]; edges: Edge[] } {
	return {
		nodes: [
			canvasNode("g", "G1"),
			canvasNode("s1", "(Data)  Ethics!"),
			canvasNode("s2", "Fairness v2"),
			canvasNode("c1", "C1"),
			canvasNode("c2", "C2"),
		],
		edges: [
			{ id: "e1", source: "g", target: "s1" },
			{ id: "e2", source: "g", target: "s2" },
			{ id: "e3", source: "s1", target: "c1" },
			{ id: "e4", source: "s2", target: "c2" },
		],
	};
}

const mockedToPng = vi.mocked(toPng);
const mockedSaveAs = vi.mocked(saveAs);

/** The picture each capture returns: a different payload each time, so the order can be read from the file. */
function pictureNumber(call: number): string {
	return `iVBORw0KGgo${"ABCDEFGH"[call]}`;
}

function putCanvasInPage() {
	document.body.innerHTML = `<div class="react-flow__viewport"><svg>
		<path id="styled" class="react-flow__edge-path" stroke="red" stroke-width="5" d="M0"></path>
		<path id="plain" class="react-flow__edge-path" d="M1"></path>
	</svg></div>`;
}

interface Run {
	applyLayout: ReturnType<typeof vi.fn>;
	restoreLayout: ReturnType<typeof vi.fn>;
}

async function run(
	overrides: {
		diagramMode?: DiagramMode;
		format?: ExportFormat;
		includeDiagram?: boolean;
		maxDiagramDepth?: number | null;
		nodes?: Node[];
		edges?: Edge[];
		sectionOverrides?: Record<string, boolean>;
		template?: TemplatePreset;
		caseName?: string;
		layoutDirection?: "TB" | "LR";
		data?: PlainCase;
	} = {}
): Promise<Run> {
	const base = diagram();
	const applyLayout = vi.fn();
	const restoreLayout = vi.fn();
	await exportDocument({
		applyLayout,
		restoreLayout,
		caseData: overrides.data ?? caseData,
		caseName: overrides.caseName ?? "Flow Case",
		format: overrides.format ?? "markdown",
		template: overrides.template ?? "full-report",
		includeDiagram: overrides.includeDiagram ?? true,
		nodes: overrides.nodes ?? base.nodes,
		edges: overrides.edges ?? base.edges,
		layoutDirection: overrides.layoutDirection ?? "TB",
		diagramMode: overrides.diagramMode,
		maxDiagramDepth: overrides.maxDiagramDepth,
		sectionOverrides: overrides.sectionOverrides,
	});
	return { applyLayout, restoreLayout };
}

function readBlob(
	blob: Blob,
	as: "text" | "buffer"
): Promise<string | ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string | ArrayBuffer);
		reader.onerror = () => reject(reader.error);
		if (as === "text") {
			reader.readAsText(blob);
		} else {
			reader.readAsArrayBuffer(blob);
		}
	});
}

async function savedText(): Promise<string> {
	return (await readBlob(savedBlob(), "text")) as string;
}

function savedBlob(): Blob {
	return mockedSaveAs.mock.calls[0]![0] as Blob;
}

function savedName(): string {
	return mockedSaveAs.mock.calls[0]![1] as string;
}

async function savedZip(): Promise<JSZip> {
	return await JSZip.loadAsync(
		(await readBlob(savedBlob(), "buffer")) as ArrayBuffer
	);
}

async function zipText(zip: JSZip, name: string): Promise<string> {
	return await zip.file(name)!.async("string");
}

function pngBytes(payload: string): number[] {
	return Array.from(Buffer.from(payload, "base64"));
}

function logoResponse(ok: boolean) {
	return {
		ok,
		blob: () => Promise.resolve(new Blob([Buffer.from(TINY_PNG, "base64")])),
	};
}

beforeEach(() => {
	let call = 0;
	mockedToPng.mockImplementation(() => {
		const url = `data:image/png;base64,${pictureNumber(call)}`;
		call++;
		return Promise.resolve(url);
	});
	mockedSaveAs.mockReset();
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(logoResponse(false)));
	putCanvasInPage();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	document.body.innerHTML = "";
	mockedToPng.mockReset();
});

describe("exported thresholds", () => {
	it("suggests branch diagrams from fifteen nodes", () => {
		expect(BRANCH_DIAGRAM_THRESHOLD).toBe(15);
	});
});

describe("exportDocument without a diagram", () => {
	it("saves the markdown text with its type and a dated file name", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-03-04T12:00:00Z"));

		const { applyLayout, restoreLayout } = await run({
			includeDiagram: false,
			caseName: "My  Case: v2!",
		});

		expect(mockedSaveAs).toHaveBeenCalledTimes(1);
		expect(savedBlob().type).toBe("text/markdown");
		expect(savedName()).toBe("my-case-v2-2026-03-04.md");
		expect(await savedText()).toContain("Flow Case");
		expect(mockedToPng).not.toHaveBeenCalled();
		expect(applyLayout).not.toHaveBeenCalled();
		expect(restoreLayout).not.toHaveBeenCalled();
	});

	it("saves a Word document as the exporter's own file", async () => {
		await run({ includeDiagram: false, format: "docx" });

		expect(mockedSaveAs).toHaveBeenCalledTimes(1);
		expect(savedBlob()).toBeInstanceOf(Blob);
		expect(savedName()).toMatch(DATED_DOCX_NAME);
	});

	it("refuses a format that has no exporter", async () => {
		await expect(
			run({ includeDiagram: false, format: "rtf" as ExportFormat })
		).rejects.toThrow("No exporter available for format: rtf");
		expect(mockedSaveAs).not.toHaveBeenCalled();
	});

	it("reports the exporter's own failure and saves nothing", async () => {
		const broken = {
			...caseData,
			case: { ...caseData.case, name: 42 as unknown as string },
		};

		await expect(run({ includeDiagram: false, data: broken })).rejects.toThrow(
			"Markdown export failed"
		);
		expect(mockedSaveAs).not.toHaveBeenCalled();
	});

	it("puts the platform's name and footer in the document", async () => {
		await run({ includeDiagram: false, template: "evidence-list" });

		const text = await savedText();
		expect(text).toContain('organisation: "TEA Platform"');
		expect(text).toContain("Generated by TEA Platform");
	});

	it("asks for the platform logo from its fixed address", async () => {
		await run({ includeDiagram: false });

		expect(fetch).toHaveBeenCalledWith(LOGO_URL);
	});

	it("carries on without a logo when the logo cannot be fetched", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

		await run({ includeDiagram: false, format: "docx" });

		expect(mockedSaveAs).toHaveBeenCalledTimes(1);
	});
});

describe("exportDocument word branding", () => {
	async function docxFiles(): Promise<{ names: string[]; zip: JSZip }> {
		const zip = await savedZip();
		return { zip, names: Object.keys(zip.files) };
	}

	async function allXml(zip: JSZip, names: string[]): Promise<string> {
		const parts = await Promise.all(
			names
				.filter((n) => n.endsWith(".xml"))
				.map((n) => zip.file(n)!.async("string"))
		);
		return parts.join("\n");
	}

	it("uses the platform colour for headings", async () => {
		await run({ includeDiagram: false, format: "docx" });

		const { zip, names } = await docxFiles();
		expect((await allXml(zip, names)).toLowerCase()).toContain("1e3a5f");
	});

	it("embeds the logo when it can be fetched", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(logoResponse(true)));

		await run({ includeDiagram: false, format: "docx" });

		const { names } = await docxFiles();
		expect(names.some((n) => n.startsWith("word/media/"))).toBe(true);
	});

	it("shows the footer text and no logo when the logo request is refused", async () => {
		await run({ includeDiagram: false, format: "docx" });

		const { zip, names } = await docxFiles();
		expect(names.some((n) => n.startsWith("word/media/"))).toBe(false);
		expect(await allXml(zip, names)).toContain("Generated by TEA Platform");
	});
});

describe("exportDocument with a diagram", () => {
	it("lays the diagram out, captures it once and restores the canvas", async () => {
		const { applyLayout, restoreLayout } = await run();

		expect(applyLayout).toHaveBeenCalledTimes(1);
		const [laidOut, , direction] = applyLayout.mock.calls[0]!;
		expect(laidOut.map((n: Node) => n.id).sort()).toEqual([
			"c1",
			"c2",
			"g",
			"s1",
			"s2",
		]);
		expect(direction).toBe("TB");
		expect(mockedToPng).toHaveBeenCalledTimes(1);
		expect(restoreLayout).toHaveBeenCalledTimes(1);
	});

	it("hands the laid-out edges to the canvas", async () => {
		const { applyLayout } = await run();

		const edges = applyLayout.mock.calls[0]![1] as Edge[];
		expect(edges.map((e) => [e.id, e.source, e.target]).sort()).toStrictEqual([
			["e1", "g", "s1"],
			["e2", "g", "s2"],
			["e3", "s1", "c1"],
			["e4", "s2", "c2"],
		]);
	});

	it("leaves the nodes and edges it was given as they were", async () => {
		const given = diagram();
		const before = JSON.stringify(given);

		await run({ nodes: given.nodes, edges: given.edges });

		expect(JSON.stringify(given)).toBe(before);
	});

	it("passes the wide-diagram direction to the canvas", async () => {
		const wide = diagram();
		wide.nodes = wide.nodes.map((n, i) => ({
			...n,
			position: { x: i * 1000, y: 0 },
		}));

		const { applyLayout } = await run({ ...wide });

		expect(applyLayout.mock.calls[0]![2]).toBe("LR");
	});

	it("lays the diagram out with more room than the compact export layout", async () => {
		const { nodes, edges } = diagram();
		const compact = await layoutForExport(nodes, edges, "TB");

		const { applyLayout } = await run({ nodes, edges });

		const used = applyLayout.mock.calls[0]![0] as Node[];
		const sideGap = (list: Node[]) =>
			list.find((n) => n.id === "s2")!.position.x -
			list.find((n) => n.id === "s1")!.position.x;
		const layerGap = (list: Node[]) =>
			list.find((n) => n.id === "s1")!.position.y -
			list.find((n) => n.id === "g")!.position.y;
		expect(sideGap(used)).toBeGreaterThan(sideGap(compact.nodes));
		expect(layerGap(used)).toBeGreaterThan(layerGap(compact.nodes));
	});

	it("takes the picture after the layout is applied and restores afterwards", async () => {
		const order: string[] = [];
		mockedToPng.mockImplementationOnce(() => {
			order.push("picture");
			return Promise.resolve(`data:image/png;base64,${pictureNumber(0)}`);
		});
		const applyLayout = vi.fn(() => order.push("apply"));
		const restoreLayout = vi.fn(() => order.push("restore"));
		const { nodes, edges } = diagram();

		await exportDocument({
			applyLayout,
			restoreLayout,
			caseData,
			caseName: "Flow Case",
			format: "markdown",
			template: "full-report",
			includeDiagram: true,
			nodes,
			edges,
			layoutDirection: "TB",
		});

		expect(order).toEqual(["apply", "picture", "restore"]);
	});

	it("captures nothing when the canvas is not on the page", async () => {
		document.body.innerHTML = "";

		await run();

		expect(mockedToPng).not.toHaveBeenCalled();
		expect(mockedSaveAs).toHaveBeenCalledTimes(1);
		expect(savedName().endsWith(".md")).toBe(true);
		expect(savedBlob().type).toBe("text/markdown");
	});

	it("captures nothing when there are no nodes", async () => {
		await run({ nodes: [], edges: [] });

		expect(mockedToPng).not.toHaveBeenCalled();
		expect(savedName().endsWith(".md")).toBe(true);
	});

	it("captures nothing when every node is hidden", async () => {
		const { nodes, edges } = diagram();

		await run({ nodes: nodes.map((n) => ({ ...n, hidden: true })), edges });

		expect(mockedToPng).not.toHaveBeenCalled();
		expect(savedName().endsWith(".md")).toBe(true);
	});
});

describe("exportDocument depth limit", () => {
	it.each([
		[0, ["g"]],
		[1, ["g", "s1", "s2"]],
		[5, ["c1", "c2", "g", "s1", "s2"]],
	])("keeps only what is within depth %i", async (depth, expected) => {
		const { applyLayout } = await run({ maxDiagramDepth: depth });

		const used = applyLayout.mock.calls[0]![0] as Node[];
		expect(used.map((n) => n.id).sort()).toEqual(expected);
	});

	it("keeps every node when no depth limit is given", async () => {
		const { applyLayout } = await run({ maxDiagramDepth: null });

		expect(applyLayout.mock.calls[0]![0]).toHaveLength(5);
	});
});

describe("the picture asked of the drawing package", () => {
	it("is taken of the canvas viewport with the export options", async () => {
		const { applyLayout } = await run();

		const [element, options] = mockedToPng.mock.calls[0]!;
		expect(element).toBe(document.querySelector(".react-flow__viewport"));
		const used = applyLayout.mock.calls[0]![0] as Node[];
		const bounds = getNodesBounds(used);
		expect(options).toMatchObject({
			backgroundColor: "#ffffff",
			cacheBust: true,
			pixelRatio: 2,
		});
		expect(options!.width).toBeGreaterThan(bounds.width);
		expect(options!.height).toBeGreaterThan(bounds.height);
		expect(options!.width! - bounds.width).toBe(
			options!.height! - bounds.height
		);
		expect(options!.style).toStrictEqual({
			width: `${options!.width}px`,
			height: `${options!.height}px`,
			transform: expect.stringMatching(TRANSFORM_STYLE),
		});
	});

	it("sizes a branch picture from the branch's visible nodes only", async () => {
		const { applyLayout } = await run({ diagramMode: "branches" });

		const branchNodes = applyLayout.mock.calls[1]![0] as Node[];
		const bounds = getNodesBounds(branchNodes.filter((n) => !n.hidden));
		const overview = getNodesBounds(applyLayout.mock.calls[0]![0] as Node[]);
		const options = mockedToPng.mock.calls[1]![1]!;
		expect(options.width! - bounds.width).toBe(
			mockedToPng.mock.calls[0]![1]!.width! - overview.width
		);
	});

	it("sets edge lines for the picture and puts the originals back afterwards", async () => {
		const seen: Array<Array<string | null>> = [];
		mockedToPng.mockImplementationOnce(() => {
			for (const id of ["styled", "plain"]) {
				const path = document.getElementById(id)!;
				seen.push([
					path.getAttribute("stroke"),
					path.getAttribute("stroke-width"),
				]);
			}
			return Promise.resolve(`data:image/png;base64,${pictureNumber(0)}`);
		});

		await run();

		expect(seen).toEqual([
			["#666666", "2"],
			["#666666", "2"],
		]);
		const styled = document.getElementById("styled")!;
		expect(styled.getAttribute("stroke")).toBe("red");
		expect(styled.getAttribute("stroke-width")).toBe("5");
		const plain = document.getElementById("plain")!;
		expect(plain.hasAttribute("stroke")).toBe(false);
		expect(plain.hasAttribute("stroke-width")).toBe(false);
	});

	it("puts the edge lines back and passes the error on when the picture fails", async () => {
		mockedToPng.mockReset();
		mockedToPng.mockRejectedValue(new Error("no picture"));

		await expect(run()).rejects.toThrow("no picture");

		expect(document.getElementById("styled")!.getAttribute("stroke")).toBe(
			"red"
		);
		expect(document.getElementById("plain")!.hasAttribute("stroke")).toBe(
			false
		);
		expect(mockedSaveAs).not.toHaveBeenCalled();
	});
});

describe("the filter given to the drawing package", () => {
	async function captureFilter(): Promise<(node: HTMLElement) => boolean> {
		await run();
		return mockedToPng.mock.calls[0]![1]!.filter as (
			node: HTMLElement
		) => boolean;
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

	it.each([
		["a plain element", () => withClass("react-flow__node")],
		[
			"a text node",
			() => document.createTextNode("x") as unknown as HTMLElement,
		],
	])("keeps %s", async (_label, make) => {
		const filter = await captureFilter();

		expect(filter(make())).toBe(true);
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

describe("markdown with a diagram", () => {
	it("saves a zip holding the report and the overview picture", async () => {
		await run({ caseName: "Flow Case" });

		expect(mockedSaveAs).toHaveBeenCalledTimes(1);
		expect(savedBlob()).toBeInstanceOf(Blob);
		expect(savedName()).toMatch(DATED_ZIP_NAME);
		const zip = await savedZip();
		const names = Object.keys(zip.files).sort();
		const report = names.find((n) => n.endsWith(".md"))!;
		expect(names).toEqual([report, "diagram.png"].sort());
		expect(report).toBe(`${savedName().slice(0, -".zip".length)}.md`);
		const text = await zipText(zip, report);
		expect(text).toContain("./diagram.png");
		expect(text).toContain("Flow Case");
		const bytes = await zip.file("diagram.png")!.async("uint8array");
		expect(Array.from(bytes)).toEqual(pngBytes(pictureNumber(0)));
	});

	it("leaves the picture out of the report when its section is switched off", async () => {
		await run({ sectionOverrides: { diagram: false } });

		const zip = await savedZip();
		const report = Object.keys(zip.files).find((n) => n.endsWith(".md"))!;
		expect(await zipText(zip, report)).not.toContain("./diagram.png");
	});

	it("saves plain markdown for a single diagram mode with no picture taken", async () => {
		document.body.innerHTML = "";

		await run({ diagramMode: "single" });

		expect(savedBlob().type).toBe("text/markdown");
	});

	it("does not capture branches unless asked", async () => {
		await run({ diagramMode: "single" });

		expect(mockedToPng).toHaveBeenCalledTimes(1);
		const zip = await savedZip();
		expect(Object.keys(zip.files).some((n) => n.startsWith("branch-"))).toBe(
			false
		);
	});

	it("does not capture branches by default", async () => {
		await run();

		expect(mockedToPng).toHaveBeenCalledTimes(1);
	});

	it("does not zip a Word document that has a diagram", async () => {
		await run({ format: "docx" });

		expect(savedName().endsWith(".docx")).toBe(true);
	});
});

describe("branch diagrams", () => {
	it("captures one picture per branch after the overview", async () => {
		await run({ diagramMode: "branches" });

		expect(mockedToPng).toHaveBeenCalledTimes(3);
	});

	it("hides what is outside each branch while laying it out", async () => {
		const { applyLayout } = await run({ diagramMode: "branches" });

		expect(applyLayout).toHaveBeenCalledTimes(3);
		const hiddenIds = (call: number) =>
			(applyLayout.mock.calls[call]![0] as Node[])
				.filter((n) => n.hidden)
				.map((n) => n.id)
				.sort();
		expect(hiddenIds(1)).toEqual(["c2", "s2"]);
		expect(hiddenIds(2)).toEqual(["c1", "s1"]);
	});

	it("hides edges unless both ends are in the branch", async () => {
		const { applyLayout } = await run({ diagramMode: "branches" });

		const visibleEdges = (call: number) =>
			(applyLayout.mock.calls[call]![1] as Edge[])
				.filter((e) => !e.hidden)
				.map((e) => e.id)
				.sort();
		expect(visibleEdges(1)).toEqual(["e1", "e3"]);
		expect(visibleEdges(2)).toEqual(["e2", "e4"]);
	});

	it("gives branch layouts more room than the compact export layout", async () => {
		const { nodes, edges } = diagram();
		const { applyLayout } = await run({
			diagramMode: "branches",
			nodes,
			edges,
		});

		const branchOne = applyLayout.mock.calls[1]![0] as Node[];
		const compact = await layoutForExport(
			nodes.map((n) => ({ ...n, hidden: ["s2", "c2"].includes(n.id) })),
			edges.map((e) => ({ ...e, hidden: !["e1", "e3"].includes(e.id) })),
			"TB"
		);
		const layerGap = (list: Node[]) =>
			list.find((n) => n.id === "s1")!.position.y -
			list.find((n) => n.id === "g")!.position.y;
		expect(layerGap(branchOne)).toBeGreaterThan(layerGap(compact.nodes));
	});

	it("restores the canvas after the overview and after the branches", async () => {
		const { restoreLayout } = await run({ diagramMode: "branches" });

		expect(restoreLayout).toHaveBeenCalledTimes(2);
	});

	it("restores the canvas when a branch picture fails", async () => {
		mockedToPng.mockReset();
		mockedToPng
			.mockResolvedValueOnce(`data:image/png;base64,${pictureNumber(0)}`)
			.mockRejectedValue(new Error("branch failed"));

		const applyLayout = vi.fn();
		const restoreLayout = vi.fn();
		const { nodes, edges } = diagram();
		await expect(
			exportDocument({
				applyLayout,
				restoreLayout,
				caseData,
				caseName: "Flow Case",
				format: "markdown",
				template: "full-report",
				includeDiagram: true,
				nodes,
				edges,
				layoutDirection: "TB",
				diagramMode: "branches",
			})
		).rejects.toThrow("branch failed");

		expect(restoreLayout).toHaveBeenCalledTimes(2);
		expect(mockedSaveAs).not.toHaveBeenCalled();
	});

	it("saves each branch picture in the zip under a numbered, tidied title", async () => {
		await run({ diagramMode: "branches" });

		const zip = await savedZip();
		const names = Object.keys(zip.files).filter((n) => n.startsWith("branch-"));
		expect(names.sort()).toEqual([
			"branch-1-data-ethics.png",
			"branch-2-fairness-v2.png",
		]);
		const first = await zip.file(names[0]!)!.async("uint8array");
		const second = await zip.file(names[1]!)!.async("uint8array");
		expect(Array.from(first)).toEqual(pngBytes(pictureNumber(1)));
		expect(Array.from(second)).toEqual(pngBytes(pictureNumber(2)));
	});

	it("writes a diagram with no branches as a lone overview", async () => {
		const lone = { nodes: [canvasNode("g", "G1")], edges: [] };

		const { restoreLayout } = await run({ diagramMode: "branches", ...lone });

		expect(mockedToPng).toHaveBeenCalledTimes(1);
		expect(restoreLayout).toHaveBeenCalledTimes(1);
		const zip = await savedZip();
		expect(Object.keys(zip.files).some((n) => n.startsWith("branch-"))).toBe(
			false
		);
	});

	it("leaves out a branch whose picture cannot be taken", async () => {
		let calls = 0;
		const applyLayout = vi.fn(() => {
			calls++;
			if (calls > 1) {
				document.body.innerHTML = "";
			}
		});
		const { nodes, edges } = diagram();

		await exportDocument({
			applyLayout,
			restoreLayout: vi.fn(),
			caseData,
			caseName: "Flow Case",
			format: "markdown",
			template: "full-report",
			includeDiagram: true,
			nodes,
			edges,
			layoutDirection: "TB",
			diagramMode: "branches",
		});

		const zip = await savedZip();
		expect(Object.keys(zip.files).some((n) => n.startsWith("branch-"))).toBe(
			false
		);
	});
});
