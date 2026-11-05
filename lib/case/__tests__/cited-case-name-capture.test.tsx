import { render, renderHook, screen } from "@testing-library/react";
import { toPng, toSvg } from "html-to-image";
import type React from "react";
import type { Edge, Node, NodeProps } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AwayGoalNode from "@/components/cases/away-goal-node";
import ModuleNode from "@/components/cases/module-node";
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

const CITED_CASE = "CapturedCaseName-5d2e90";
const CITED_ELEMENT = "CapturedElement-3b7f18";
const REFERENCED_CASE = "CapturedReferencedCase-8a4c66";
const CITED_LINK = "View cited case";
const REFERENCED_LINK = "View referenced case";

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

function cardProps(type: string, data: Record<string, unknown>): NodeProps {
	return {
		id: `${type}-1`,
		data,
		type,
		selected: false,
		zIndex: 0,
		isConnectable: true,
		xPos: 0,
		yPos: 0,
		dragging: false,
	} as unknown as NodeProps;
}

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
				<AwayGoalNode
					{...cardProps("awayGoal", {
						id: "ag-1",
						name: "AG1",
						description: "An away goal",
						citedCaseName: CITED_CASE,
						citedElementName: CITED_ELEMENT,
						citedCaseAccessible: true,
						moduleReferenceId: "case-2",
						citedElementId: "goal-3",
					})}
				/>
				<ModuleNode
					{...cardProps("module", {
						id: "m-1",
						name: "M1",
						description: "A module",
						moduleCaseName: REFERENCED_CASE,
						moduleCaseAccessible: true,
						moduleReferenceId: "case-3",
					})}
				/>
			</div>
		</div>
	);
});

afterEach(() => {
	vi.clearAllMocks();
	useStore.setState({ nodes: [] });
});

const EXPORT_BASE = {
	caseName: "Case",
	nodes: [] as Node[],
	scale: 1 as const,
};

/** The pictures the capturing user makes for themselves. */
const OWN_IMAGES: [string, () => Promise<void>][] = [
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
];

describe("the cited names on the screen to begin with", () => {
	it("are shown on the cards", () => {
		expect(
			screen.getByText(`${CITED_CASE} — ${CITED_ELEMENT}`)
		).toBeInTheDocument();
		expect(screen.getByText(REFERENCED_CASE)).toBeInTheDocument();
	});
});

describe.each(
	OWN_IMAGES
)("%s the user takes of their own view", (_name, takePicture) => {
	it("keeps the cited case and element names, and the card's own words", async () => {
		await takePicture();

		expect(copied.length).toBeGreaterThan(0);
		for (const text of copied) {
			expect(text).toContain("AG1");
			expect(text).toContain("M1");
			expect(text).toContain(CITED_CASE);
			expect(text).toContain(CITED_ELEMENT);
			expect(text).toContain(REFERENCED_CASE);
			expect(text).toContain(CITED_LINK);
			expect(text).toContain(REFERENCED_LINK);
		}
	});
});

describe("the dashboard thumbnail, which other people are shown", () => {
	it("leaves out every cited name and link and keeps the cards' own words", async () => {
		const { result } = renderHook(() =>
			useAutoScreenshot({ caseId: "case-1", canEdit: true })
		);

		await result.current.captureScreenshot();

		expect(copied.length).toBeGreaterThan(0);
		for (const text of copied) {
			expect(text).toContain("AG1");
			expect(text).toContain("M1");
			expect(text).not.toContain(CITED_CASE);
			expect(text).not.toContain(CITED_ELEMENT);
			expect(text).not.toContain(REFERENCED_CASE);
			expect(text).not.toContain(CITED_LINK);
			expect(text).not.toContain(REFERENCED_LINK);
		}
	});

	it("leaves the cited names on the screen afterwards", async () => {
		const { result } = renderHook(() =>
			useAutoScreenshot({ caseId: "case-1", canEdit: true })
		);

		await result.current.captureScreenshot();

		expect(
			screen.getByText(`${CITED_CASE} — ${CITED_ELEMENT}`)
		).toBeInTheDocument();
		expect(screen.getByText(REFERENCED_CASE)).toBeInTheDocument();
		expect(screen.getByText(CITED_LINK)).toBeInTheDocument();
		expect(screen.getByText(REFERENCED_LINK)).toBeInTheDocument();
	});

	it("leaves them out of the picture taken when the page is closed", async () => {
		const { result } = renderHook(() =>
			useAutoScreenshot({ caseId: "case-1", canEdit: true })
		);
		result.current.markChanged();

		window.dispatchEvent(new Event("beforeunload"));
		await Promise.resolve();

		expect(copied.length).toBeGreaterThan(0);
		for (const text of copied) {
			expect(text).toContain("AG1");
			expect(text).not.toContain(CITED_CASE);
			expect(text).not.toContain(CITED_ELEMENT);
			expect(text).not.toContain(REFERENCED_CASE);
			expect(text).not.toContain(CITED_LINK);
			expect(text).not.toContain(REFERENCED_LINK);
		}
	});

	it("leaves them out of the picture taken when the editor is closed with a change pending", async () => {
		const { result, unmount } = renderHook(() =>
			useAutoScreenshot({ caseId: "case-1", canEdit: true })
		);
		result.current.markChanged();

		unmount();
		await Promise.resolve();

		expect(copied.length).toBeGreaterThan(0);
		for (const text of copied) {
			expect(text).not.toContain(CITED_CASE);
			expect(text).not.toContain(CITED_ELEMENT);
			expect(text).not.toContain(REFERENCED_CASE);
			expect(text).not.toContain(CITED_LINK);
			expect(text).not.toContain(REFERENCED_LINK);
		}
	});

	it("still leaves the cited names in a user's own image taken afterwards", async () => {
		const { result } = renderHook(() =>
			useAutoScreenshot({ caseId: "case-1", canEdit: true })
		);
		await result.current.captureScreenshot();
		copied.length = 0;

		await exportDiagramImage({ ...EXPORT_BASE, nodes, format: "png" });

		expect(copied.length).toBeGreaterThan(0);
		for (const text of copied) {
			expect(text).toContain(CITED_CASE);
			expect(text).toContain(CITED_LINK);
		}
	});
});
