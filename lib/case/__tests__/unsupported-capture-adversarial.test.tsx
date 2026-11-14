import { render, renderHook, screen } from "@testing-library/react";
import { toPng, toSvg } from "html-to-image";
import type React from "react";
import type { Edge, Node, NodeProps } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PropertyNode from "@/components/cases/property-node";
import { useAutoScreenshot } from "@/hooks/use-auto-screenshot";
import useStore from "@/store/store";
import { convertAssuranceCase } from "../convert-case";
import { exportDocument } from "../document-export";
import {
	exportDiagramImage,
	exportFilteredDiagramImage,
} from "../image-export";

vi.mock("@/hooks/use-plugin-enablement", () => ({
	useEnabledPluginIds: () => ({ enabledPluginIds: new Set(), loading: false }),
}));
vi.mock("html-to-image", () => ({ toPng: vi.fn(), toSvg: vi.fn() }));
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));
vi.mock("@/lib/export", () => ({
	createTemplateFromPreset: vi.fn(() => ({ render: vi.fn(async () => ({})) })),
	exporterRegistry: {
		get: vi.fn(() => ({
			export: vi.fn(async () => ({
				success: true,
				blob: new Blob(["x"]),
				filename: "report.pdf",
			})),
		})),
	},
}));
vi.mock("../layout-helper", () => ({
	getLayoutedElements: vi.fn(async (nodes: Node[], edges: Edge[]) => ({
		nodes,
		edges,
	})),
}));
vi.mock("reactflow", async () => {
	const actual = await vi.importActual<typeof import("reactflow")>("reactflow");
	const ReactLib: typeof React = require("react");
	return {
		...actual,
		useNodes: () => [],
		useEdges: () => [],
		useReactFlow: () => ({
			fitView: vi.fn(),
			getNodes: vi.fn(() => []),
			getEdges: vi.fn(() => []),
		}),
		Handle: ({ id }: { id?: string }) =>
			ReactLib.createElement("div", { "data-handle": id }),
	};
});

const DATA_URL = "data:image/png;base64,AAAA";
const SVG_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>')}`;
const CLAIM_NODE_ID = "property-p1";

const CASE = {
	id: "case-1",
	goals: [
		{
			id: "g1",
			name: "G1",
			type: "TopLevelNormativeGoal",
			propertyClaims: [{ id: "p1", name: "P1", type: "PropertyClaim" }],
		},
	],
} as never;

const CLAIM_PROPS = {
	id: CLAIM_NODE_ID,
	data: {
		id: "p1",
		name: "P1",
		description: "A claim with nothing beneath it",
	},
	type: "property",
	selected: false,
	zIndex: 0,
	isConnectable: true,
	xPos: 0,
	yPos: 0,
	dragging: false,
} as unknown as NodeProps;

/** What the picture-taking library would copy: an element the filter refuses takes its children with it. */
function textCopied(
	root: Element,
	filter: ((node: HTMLElement) => boolean) | undefined
): string {
	const found: string[] = [];
	const walk = (element: Element) => {
		if (filter && !filter(element as HTMLElement)) {
			return;
		}
		for (const child of element.childNodes) {
			if (child.nodeType === Node.TEXT_NODE) {
				found.push(child.textContent ?? "");
			} else if (child.nodeType === Node.ELEMENT_NODE) {
				walk(child as Element);
			}
		}
	};
	walk(root);
	return found.join("|");
}

let copied: string[];
let nodes: Node[];
let edges: Edge[];

beforeEach(() => {
	copied = [];
	const converted = convertAssuranceCase(CASE);
	nodes = converted.caseNodes.map((node) => ({
		...node,
		width: 288,
		height: 64,
	}));
	edges = converted.caseEdges;
	useStore.setState({
		nodes: converted.caseNodes,
		readOnlyCanvas: false,
		showUnsupportedMarkers: true,
		// A card re-lays the diagram out when its animation ends, from the nodes
		// the stand-in canvas reports (none); this keeps that from emptying the store.
		layoutNodes: vi.fn(async () => undefined),
	});
	vi.mocked(toPng).mockImplementation((root, options) => {
		copied.push(
			textCopied(root, options?.filter as (n: HTMLElement) => boolean)
		);
		return Promise.resolve(DATA_URL);
	});
	vi.mocked(toSvg).mockImplementation((root, options) => {
		copied.push(
			textCopied(root, options?.filter as (n: HTMLElement) => boolean)
		);
		return Promise.resolve(SVG_DATA_URL);
	});
	Object.defineProperty(navigator, "sendBeacon", {
		configurable: true,
		value: vi.fn(() => true),
	});
	render(
		<div id="ReactFlow">
			<div className="react-flow__viewport">
				<PropertyNode {...CLAIM_PROPS} />
			</div>
		</div>
	);
});

afterEach(() => {
	vi.clearAllMocks();
	useStore.setState({ nodes: [], showUnsupportedMarkers: null });
});

const EXPORT_BASE = {
	caseName: "Case",
	nodes: [] as Node[],
	scale: 1 as const,
};

const WAYS: [string, () => Promise<void>][] = [
	[
		"a PNG image of the case",
		() => exportDiagramImage({ ...EXPORT_BASE, nodes, format: "png" }),
	],
	[
		"an SVG image of the case",
		() => exportDiagramImage({ ...EXPORT_BASE, nodes, format: "svg" }),
	],
	[
		"a depth-limited image of the case",
		() =>
			exportFilteredDiagramImage({
				...EXPORT_BASE,
				nodes,
				format: "png",
				edges,
				layoutDirection: "TB",
				maxDepth: 5,
				applyLayout: vi.fn(),
				restoreLayout: vi.fn(),
			}),
	],
	[
		"a report diagram",
		() =>
			exportDocument({
				applyLayout: vi.fn(),
				restoreLayout: vi.fn(),
				caseData: {} as never,
				caseName: "Case",
				edges,
				format: "pdf" as never,
				includeDiagram: true,
				layoutDirection: "TB",
				nodes,
				template: "standard" as never,
			}),
	],
	[
		"the dashboard thumbnail",
		async () => {
			const { result } = renderHook(() =>
				useAutoScreenshot({ caseId: "case-1", canEdit: true })
			);
			await result.current.captureScreenshot();
		},
	],
];

describe.each(
	WAYS
)("taking %s of a case with an unsupported claim", (_name, takePicture) => {
	it("has the marker on the screen to begin with", () => {
		expect(screen.getByText("Unsupported")).toBeInTheDocument();
	});

	it("leaves the marker out of the picture and keeps the card's own words", async () => {
		await takePicture();

		expect(copied.length).toBeGreaterThan(0);
		for (const text of copied) {
			expect(text).toContain("P1");
			expect(text).not.toContain("Unsupported");
		}
	});

	it("leaves the marker on the screen afterwards", async () => {
		await takePicture();

		expect(screen.getByText("Unsupported")).toBeInTheDocument();
	});
});
