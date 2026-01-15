import { saveAs } from "file-saver";
import { toPng, toSvg } from "html-to-image";
import type { Options } from "html-to-image/lib/types";
import { type Node, getNodesBounds, getViewportForBounds } from "reactflow";

export type ImageFormat = "svg" | "png";
export type ImageScale = 1 | 2 | 3;

export interface ImageExportOptions {
	format: ImageFormat;
	scale?: ImageScale;
	caseName: string;
	nodes: Node[];
}

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

	edgePaths.forEach((path) => {
		const svgPath = path as SVGElement;
		originalStyles.set(path, {
			stroke: svgPath.getAttribute("stroke") || "",
			strokeWidth: svgPath.getAttribute("stroke-width") || "",
		});
		// Apply explicit stroke styles for export (light mode)
		svgPath.setAttribute("stroke", "#666666");
		svgPath.setAttribute("stroke-width", "2");
	});

	// Return cleanup function
	return () => {
		edgePaths.forEach((path) => {
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
		});
	};
}

/**
 * Export the ReactFlow diagram as an image (SVG or PNG).
 * Uses ReactFlow's bounds calculation to ensure all nodes and edges are captured.
 */
export async function exportDiagramImage(
	options: ImageExportOptions
): Promise<void> {
	const viewport = document.querySelector(
		".react-flow__viewport"
	) as HTMLElement | null;

	if (!viewport) {
		throw new Error(
			"Diagram viewport not found. Please ensure the case is loaded."
		);
	}

	if (options.nodes.length === 0) {
		throw new Error("No nodes to export. The diagram appears to be empty.");
	}

	const filename = generateFilename(
		options.caseName,
		options.format,
		options.scale
	);

	// Use ReactFlow's getNodesBounds to calculate proper bounds
	const nodesBounds = getNodesBounds(options.nodes);
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

	const imageScale = options.scale || 2;

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
		pixelRatio: imageScale,
	};

	// Apply inline styles for export (CSS variables won't work in cloned DOM)
	const restoreStyles = applyExportStyles(viewport);

	try {
		if (options.format === "svg") {
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
