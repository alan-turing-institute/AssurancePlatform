import { render, renderHook, screen } from "@testing-library/react";
import { toPng, toSvg } from "html-to-image";
import type React from "react";
import type { Edge, EdgeProps, Node, NodeProps } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EvidenceNode from "@/components/cases/evidence-node";
import SupportEdge from "@/components/cases/support-edge";
import BaseNode from "@/components/shared/nodes/base-node";
import { useAutoScreenshot } from "@/hooks/use-auto-screenshot";
import { useNodeTopRightActions } from "@/hooks/use-node-top-right-actions";
import {
	type CanvasWorld,
	CLAIM_ID,
	enablePlugins,
	installCanvasWorld,
	NODE_ID,
	registerHealthOnly,
	removeCanvasWorld,
	settle,
} from "@/src/__tests__/utils/live-node-canvas-kit";
import {
	healthStatus,
	judgedWithOtherSettings,
	liveNodeItem,
} from "@/src/__tests__/utils/live-node-ui-kit";
import useStore from "@/store/store";
import { convertAssuranceCase } from "../convert-case";
import { exportDocument } from "../document-export";
import {
	exportDiagramImage,
	exportFilteredDiagramImage,
} from "../image-export";

vi.mock("@/hooks/use-plugin-enablement", () => ({
	useEnabledPluginIds: vi.fn(),
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
const CLAIM_NODE_ID = "property-claim-42";

/** G1 supports P1 (element id `claim-42`), which holds the evidence node. */
const CASE = {
	id: "case-1",
	goals: [
		{
			id: "goal-1",
			name: "G1",
			type: "TopLevelNormativeGoal",
			propertyClaims: [
				{
					id: CLAIM_ID,
					name: "P1",
					type: "PropertyClaim",
					propertyClaims: [],
					evidence: [{ id: NODE_ID, name: "E1", type: "Evidence" }],
				},
			],
		},
	],
} as never;

/** What one call to the picture-taking library saw. */
interface Capture {
	/** The structure and words of everything the picture would contain. */
	contents: string[];
	/** The colour a plugin gave each edge's connector, as the library would copy it. */
	edgeColours: { opacity: string; stroke: string; width: string }[];
}

let captures: Capture[];

function ownText(element: Element) {
	return [...element.childNodes]
		.filter((child) => child.nodeType === Node.TEXT_NODE)
		.map((child) => child.textContent?.trim() ?? "")
		.join("");
}

/** The elements the library would copy into the picture: an element the filter refuses takes its children with it. */
function contentsOf(
	root: Element,
	filter: ((node: HTMLElement) => boolean) | undefined
) {
	const found: string[] = [];
	const walk = (element: Element, depth: number) => {
		if (filter && !filter(element as HTMLElement)) {
			return;
		}
		found.push(`${depth}:${element.tagName.toLowerCase()}:${ownText(element)}`);
		for (const child of element.children) {
			walk(child, depth + 1);
		}
	};
	walk(root, 0);
	return found;
}

function recordCapture(root: Element, filter: unknown): Capture {
	const accepts = filter as ((node: HTMLElement) => boolean) | undefined;
	return {
		contents: contentsOf(root, accepts),
		edgeColours: [
			...root.querySelectorAll<SVGElement>(".react-flow__edge-path"),
		].map((path) => ({
			stroke: path.style.getPropertyValue("stroke"),
			width: path.style.getPropertyValue("stroke-width"),
			opacity: path.style.getPropertyValue("stroke-opacity"),
		})),
	};
}

function claimCard() {
	function ClaimCard() {
		const corner = useNodeTopRightActions(
			{ id: CLAIM_ID },
			"property",
			CLAIM_NODE_ID
		);
		return (
			<BaseNode
				description="The claim"
				name="P1"
				nodeType="property"
				topRightActions={corner}
			/>
		);
	}
	return <ClaimCard />;
}

const EVIDENCE_PROPS = {
	id: `evidence-${NODE_ID}`,
	data: { id: NODE_ID, name: "E1", description: "Results from the check" },
	type: "evidence",
	selected: false,
	zIndex: 0,
	isConnectable: true,
	xPos: 0,
	yPos: 0,
	dragging: false,
} as unknown as NodeProps;

const EDGE_PROPS = {
	id: "e1",
	sourceX: 0,
	sourceY: 0,
	targetX: 0,
	targetY: 100,
	sourcePosition: "bottom",
	targetPosition: "top",
	source: CLAIM_NODE_ID,
	target: EVIDENCE_PROPS.id,
	data: { sourceElementId: CLAIM_ID, targetElementId: NODE_ID },
} as unknown as EdgeProps;

function Canvas() {
	return (
		<div id="ReactFlow">
			<div className="react-flow__viewport">
				{claimCard()}
				<EvidenceNode {...EVIDENCE_PROPS} />
				{/* biome-ignore lint/a11y/noSvgWithoutTitle: test fixture, not UI */}
				<svg>
					<SupportEdge {...EDGE_PROPS} />
				</svg>
			</div>
		</div>
	);
}

let world: CanvasWorld;
let nodes: Node[];
let edges: Edge[];

beforeEach(() => {
	captures = [];
	world = installCanvasWorld();
	enablePlugins(["tea.health"]);
	registerHealthOnly();
	const converted = convertAssuranceCase(CASE);
	nodes = converted.caseNodes.map((node) => ({
		...node,
		width: 288,
		height: 64,
	}));
	edges = converted.caseEdges;
	vi.mocked(toPng).mockImplementation((root, options) => {
		captures.push(recordCapture(root, options?.filter));
		return Promise.resolve(DATA_URL);
	});
	vi.mocked(toSvg).mockImplementation((root, options) => {
		captures.push(recordCapture(root, options?.filter));
		return Promise.resolve(SVG_DATA_URL);
	});
	Object.defineProperty(navigator, "sendBeacon", {
		configurable: true,
		value: vi.fn(() => true),
	});
});

afterEach(() => {
	removeCanvasWorld();
	vi.clearAllMocks();
});

/** A canvas with the claim collapsed and its node live: every kind of plugin display is on it. */
async function drawLiveCanvas() {
	const status = judgedWithOtherSettings(healthStatus({ verdict: "fail" }));
	world.list = [
		liveNodeItem({ id: NODE_ID, claim_id: CLAIM_ID, claim_name: "P1", status }),
	];
	world.statuses[CLAIM_ID] = status;
	useStore.setState({
		nodes: [
			{
				id: `evidence-${NODE_ID}`,
				position: { x: 0, y: 0 },
				data: { parentId: CLAIM_NODE_ID },
				hidden: true,
			},
		],
	});
	const view = render(<Canvas />);
	await settle();
	return view;
}

/** The same canvas with nothing live: what the authored case looks like. */
async function drawPlainCanvas() {
	world.list = [];
	world.statuses = {};
	useStore.setState({
		nodes: [
			{
				id: `evidence-${NODE_ID}`,
				position: { x: 0, y: 0 },
				data: { parentId: CLAIM_NODE_ID },
				hidden: true,
			},
		],
	});
	const view = render(<Canvas />);
	await settle();
	return view;
}

function edgePath() {
	const path = document.querySelector<SVGElement>(".react-flow__edge-path");
	if (!path) {
		throw new Error("no edge path");
	}
	return path;
}

const EXPORT_BASE = {
	caseName: "Case",
	nodes: [] as Node[],
	scale: 1 as const,
};

/** Each way a picture of the canvas is taken. */
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
		"the branch diagrams of a report",
		() =>
			exportDocument({
				applyLayout: vi.fn(),
				restoreLayout: vi.fn(),
				caseData: {} as never,
				caseName: "Case",
				diagramMode: "branches",
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

describe.each(WAYS)("taking %s", (_name, takePicture) => {
	it("has everything a plugin drew on the canvas on the screen to begin with", async () => {
		const view = await drawLiveCanvas();

		expect(screen.queryByTestId("health-badge-dot")).not.toBeNull();
		expect(screen.queryByTestId("live-node-badge")).not.toBeNull();
		expect(screen.queryByTestId("health-badge-mismatch-mark")).not.toBeNull();
		expect(screen.queryByTestId("live-node-mismatch-mark")).not.toBeNull();
		expect(edgePath().style.getPropertyValue("stroke")).not.toBe("");
		expect(
			view.container.querySelector('[aria-hidden="true"][data-plugin-display]')
		).not.toBeNull();
	});

	it("contains only what was authored: the same elements and words as a canvas with nothing live", async () => {
		const plain = await drawPlainCanvas();
		await takePicture();
		const authored = captures;
		plain.unmount();
		captures = [];

		await drawLiveCanvas();
		await takePicture();

		expect(authored.length).toBeGreaterThan(0);
		expect(captures.map((capture) => capture.contents)).toEqual(
			authored.map((capture) => capture.contents)
		);
	});

	it("carries no plugin colour on any edge while the picture is taken", async () => {
		await drawLiveCanvas();

		await takePicture();

		expect(captures.length).toBeGreaterThan(0);
		for (const capture of captures) {
			expect(capture.edgeColours.length).toBeGreaterThan(0);
			for (const colours of capture.edgeColours) {
				expect(colours).toEqual({ stroke: "", width: "", opacity: "" });
			}
		}
	});

	it("puts the colour back on the screen once the picture is taken", async () => {
		await drawLiveCanvas();
		const before = edgePath().style.cssText;
		expect(before).not.toBe("");

		await takePicture();

		expect(edgePath().style.cssText).toBe(before);
	});

	it("puts the colour back on the screen when the picture cannot be taken", async () => {
		await drawLiveCanvas();
		const before = edgePath().style.cssText;
		vi.mocked(toPng).mockRejectedValue(new Error("not drawn"));
		vi.mocked(toSvg).mockRejectedValue(new Error("not drawn"));

		await takePicture().catch(() => undefined);

		expect(edgePath().style.cssText).toBe(before);
	});
});

describe("the thumbnail taken when the page is left", () => {
	/** Leaves the page with unsaved changes and returns what each picture taken on the way out saw. */
	async function leaveThePage() {
		vi.mocked(navigator.sendBeacon).mockClear();
		captures = [];
		const hook = renderHook(() =>
			useAutoScreenshot({ caseId: "case-1", canEdit: true })
		);
		hook.result.current.markChanged();
		window.dispatchEvent(new Event("beforeunload"));
		await vi.waitFor(() => {
			if (vi.mocked(navigator.sendBeacon).mock.calls.length === 0) {
				throw new Error("the thumbnail has not been sent yet");
			}
		});
		const seen = [...captures];
		hook.unmount();
		return seen;
	}

	it("is also taken without the plugin displays", async () => {
		const plain = await drawPlainCanvas();
		const authored = await leaveThePage();
		plain.unmount();

		await drawLiveCanvas();
		const leaving = await leaveThePage();

		expect(authored.length).toBeGreaterThan(0);
		expect(leaving.map((capture) => capture.contents)).toEqual(
			authored.map((capture) => capture.contents)
		);
		for (const capture of leaving) {
			for (const colours of capture.edgeColours) {
				expect(colours.stroke).toBe("");
			}
		}
	});
});
