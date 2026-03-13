import { saveAs } from "file-saver";
import { toPng, toSvg } from "html-to-image";
import type { Options } from "html-to-image/lib/types";
import {
	type Edge,
	getNodesBounds,
	getViewportForBounds,
	type Node,
} from "reactflow";
import {
	type LayoutApplyFn,
	layoutForExport,
	pruneByDepth,
	waitForRender,
} from "@/lib/case/document-export";
import type { LayoutDirection } from "@/lib/case/layout-helper";

export type ImageFormat = "svg" | "png";
export type ImageScale = 1 | 2 | 3;

export interface ImageExportOptions {
	caseName: string;
	format: ImageFormat;
	nodes: Node[];
	scale?: ImageScale;
}

export type FilteredImageExportOptions = ImageExportOptions & {
	edges: Edge[];
	layoutDirection: LayoutDirection;
	applyLayout: LayoutApplyFn;
	restoreLayout: () => void;
	maxDepth?: number | null;
};

/**
 * Generate a filename for the exported image.
 */
export function generateFilename(
	caseName: string,
	format: ImageFormat,
	scale?: ImageScale
): string {
	const sanitised =
		caseName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "") || "diagram";

	const now = new Date();
	const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	const time = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
	const scaleStr = scale && scale > 1 ? `@${scale}x` : "";

	return `${sanitised}-${date}T${time}${scaleStr}.${format}`;
}

/**
 * Convert a data URL to a Blob.
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
	const response = await fetch(dataUrl);
	return response.blob();
}

/**
 * Filter function - exclude controls and minimap only.
 * Note: Parameter type is HTMLElement (DOM node for html-to-image filter).
 */
function shouldInclude(domNode: HTMLElement): boolean {
	if (!(domNode instanceof Element)) {
		return true;
	}
	const classList = domNode.classList;
	if (!classList) {
		return true;
	}
	// Only exclude UI controls, NOT edges or background
	return !(
		classList.contains("react-flow__minimap") ||
		classList.contains("react-flow__controls") ||
		classList.contains("react-flow__panel") ||
		classList.contains("react-flow__attribution")
	);
}

/**
 * Temporarily apply inline styles to edges for export.
 * CSS variables aren't available in the cloned DOM, so we need to inline them.
 * Returns a cleanup function to restore original styles.
 */
function applyExportStyles(viewport: HTMLElement): () => void {
	const edgePaths = viewport.querySelectorAll(".react-flow__edge-path");
	const originalStyles: Map<Element, { stroke: string; strokeWidth: string }> =
		new Map();

	for (const path of edgePaths) {
		const svgPath = path as SVGElement;
		originalStyles.set(path, {
			stroke: svgPath.getAttribute("stroke") || "",
			strokeWidth: svgPath.getAttribute("stroke-width") || "",
		});
		// Apply explicit stroke styles for export (light mode)
		svgPath.setAttribute("stroke", "#666666");
		svgPath.setAttribute("stroke-width", "2");
	}

	// Return cleanup function
	return () => {
		for (const path of edgePaths) {
			const svgPath = path as SVGElement;
			const original = originalStyles.get(path);
			if (original) {
				if (original.stroke) {
					svgPath.setAttribute("stroke", original.stroke);
				} else {
					svgPath.removeAttribute("stroke");
				}
				if (original.strokeWidth) {
					svgPath.setAttribute("stroke-width", original.strokeWidth);
				} else {
					svgPath.removeAttribute("stroke-width");
				}
			}
		}
	};
}

/**
 * Capture the current React Flow viewport as an image and trigger download.
 * Internal helper shared by both export functions.
 */
async function captureAndDownload(
	nodes: Node[],
	format: ImageFormat,
	scale: ImageScale,
	filename: string
): Promise<void> {
	const viewport = document.querySelector(
		".react-flow__viewport"
	) as HTMLElement | null;

	if (!viewport) {
		throw new Error(
			"Diagram viewport not found. Please ensure the case is loaded."
		);
	}

	if (nodes.length === 0) {
		throw new Error("No nodes to export. The diagram appears to be empty.");
	}

	// Filter to visible nodes only
	const visibleNodes = nodes.filter(
		(n) => !(n as Node & { hidden?: boolean }).hidden
	);
	if (visibleNodes.length === 0) {
		throw new Error("No visible nodes to export.");
	}

	// Use ReactFlow's getNodesBounds to calculate proper bounds
	const nodesBounds = getNodesBounds(visibleNodes);
	const padding = 100;
	const imageWidth = nodesBounds.width + padding * 2;
	const imageHeight = nodesBounds.height + padding * 2;

	// Get the viewport transform that will position all content correctly
	const transform = getViewportForBounds(
		nodesBounds,
		imageWidth,
		imageHeight,
		0.5, // minZoom
		2 // maxZoom
	);

	const exportOptions: Options = {
		backgroundColor: "#ffffff",
		width: imageWidth,
		height: imageHeight,
		style: {
			width: `${imageWidth}px`,
			height: `${imageHeight}px`,
			// Apply transform to reposition all content (nodes + edges) into view
			transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
		},
		filter: shouldInclude,
		cacheBust: true,
		pixelRatio: scale,
	};

	// Apply inline styles for export (CSS variables won't work in cloned DOM)
	const restoreStyles = applyExportStyles(viewport);

	try {
		if (format === "svg") {
			const dataUrl = await toSvg(viewport, exportOptions);
			const blob = await dataUrlToBlob(dataUrl);
			saveAs(blob, filename);
		} else {
			const dataUrl = await toPng(viewport, exportOptions);
			const blob = await dataUrlToBlob(dataUrl);
			saveAs(blob, filename);
		}
	} catch (error) {
		console.error("Export failed:", error);
		throw error;
	} finally {
		// Always restore original styles
		restoreStyles();
	}
}

/**
 * Export the ReactFlow diagram as an image (SVG or PNG).
 * Captures the current viewport as-is without any layout changes.
 */
export async function exportDiagramImage(
	options: ImageExportOptions
): Promise<void> {
	const filename = generateFilename(
		options.caseName,
		options.format,
		options.scale
	);

	await captureAndDownload(
		options.nodes,
		options.format,
		options.scale || 2,
		filename
	);
}

/**
 * Export a filtered diagram as an image (SVG or PNG).
 *
 * When maxDepth is set, this function:
 * 1. Prunes nodes/edges to the specified depth
 * 2. Applies compact export layout (with auto-LR direction detection)
 * 3. Pushes the layout to the DOM and waits for React to render
 * 4. Captures the viewport as an image
 * 5. Restores the original layout
 *
 * When maxDepth is null/undefined, delegates to the simple exportDiagramImage.
 */
export async function exportFilteredDiagramImage(
	options: FilteredImageExportOptions
): Promise<void> {
	const {
		maxDepth,
		edges,
		layoutDirection,
		applyLayout,
		restoreLayout,
		...baseOptions
	} = options;

	// No depth filter — capture the viewport as-is
	if (maxDepth == null) {
		await exportDiagramImage(baseOptions);
		return;
	}

	const filename = generateFilename(
		options.caseName,
		options.format,
		options.scale
	);

	// Prune nodes/edges to the specified depth
	let exportNodes = options.nodes.map((n) => ({ ...n }));
	let exportEdges = edges.map((e) => ({ ...e }));

	const pruned = pruneByDepth(exportNodes, exportEdges, maxDepth);
	exportNodes = pruned.nodes;
	exportEdges = pruned.edges;

	// Use default (editor) spacing for standalone image exports — wider layer
	// gaps give smoothstep edges more room and produce cleaner paths.
	const {
		nodes: layoutedNodes,
		edges: layoutedEdges,
		direction,
	} = await layoutForExport(exportNodes, exportEdges, layoutDirection, {
		nodeSpacing: 40,
		layerSpacing: 60,
	});

	// Push to DOM (including direction for correct handle positioning)
	applyLayout(layoutedNodes, layoutedEdges, direction);
	await waitForRender();

	try {
		await captureAndDownload(
			layoutedNodes,
			options.format,
			options.scale || 2,
			filename
		);
	} finally {
		// Always restore original layout
		restoreLayout();
		await waitForRender();
	}
}
