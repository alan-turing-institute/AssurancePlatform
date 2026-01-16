import { saveAs } from "file-saver";
import { toPng } from "html-to-image";
import type { Options } from "html-to-image/lib/types";
import JSZip from "jszip";
import { type Node, getNodesBounds, getViewportForBounds } from "reactflow";
import {
	createTemplateFromPreset,
	exporterRegistry,
	type DiagramImage,
	type ExportFormat,
	type TemplatePreset,
} from "@/lib/export";
import type { CaseExportNested } from "@/lib/schemas/case-export";

export type DocumentExportOptions = {
	caseData: CaseExportNested;
	caseName: string;
	format: ExportFormat;
	template: TemplatePreset;
	includeDiagram: boolean;
	nodes: Node[];
};

/**
 * Filter function for diagram capture - exclude UI controls.
 */
function shouldIncludeInDiagram(domNode: HTMLElement): boolean {
	if (!(domNode instanceof Element)) {
		return true;
	}
	const classList = domNode.classList;
	if (!classList) {
		return true;
	}
	return !(
		classList.contains("react-flow__minimap") ||
		classList.contains("react-flow__controls") ||
		classList.contains("react-flow__panel") ||
		classList.contains("react-flow__attribution")
	);
}

/**
 * Apply inline styles to edges for export.
 * Returns cleanup function to restore original styles.
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
		svgPath.setAttribute("stroke", "#666666");
		svgPath.setAttribute("stroke-width", "2");
	}

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
 * Capture the diagram as a base64-encoded PNG for embedding in documents.
 */
async function captureDiagramImage(nodes: Node[]): Promise<DiagramImage | null> {
	const viewport = document.querySelector(
		".react-flow__viewport"
	) as HTMLElement | null;

	if (!viewport || nodes.length === 0) {
		return null;
	}

	const nodesBounds = getNodesBounds(nodes);
	const padding = 100;
	const imageWidth = nodesBounds.width + padding * 2;
	const imageHeight = nodesBounds.height + padding * 2;

	const transform = getViewportForBounds(
		nodesBounds,
		imageWidth,
		imageHeight,
		0.5,
		2
	);

	const exportOptions: Options = {
		backgroundColor: "#ffffff",
		width: imageWidth,
		height: imageHeight,
		style: {
			width: `${imageWidth}px`,
			height: `${imageHeight}px`,
			transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
		},
		filter: shouldIncludeInDiagram,
		cacheBust: true,
		pixelRatio: 2,
	};

	const restoreStyles = applyExportStyles(viewport);

	try {
		const dataUrl = await toPng(viewport, exportOptions);
		// Extract base64 data from data URL (remove "data:image/png;base64," prefix)
		const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
		return { data: base64Data, format: "png" };
	} finally {
		restoreStyles();
	}
}

/**
 * Export an assurance case as a document (PDF or Markdown).
 *
 * This function orchestrates the full export flow:
 * 1. Optionally captures the diagram as an image
 * 2. Creates a template from the selected preset
 * 3. Renders the document using the template
 * 4. Exports to the specified format
 * 5. Downloads the result
 */
export async function exportDocument(
	options: DocumentExportOptions
): Promise<void> {
	const { caseData, caseName, format, template, includeDiagram, nodes } =
		options;

	// Capture diagram image if requested
	let diagramImage: DiagramImage | undefined;
	if (includeDiagram) {
		const captured = await captureDiagramImage(nodes);
		if (captured) {
			diagramImage = captured;
		}
	}

	// Create template from preset
	const templateInstance = createTemplateFromPreset(template);

	// Render the document
	const renderedDocument = await templateInstance.render({
		caseData,
		diagramImage,
	});

	// Get the appropriate exporter
	const exporter = exporterRegistry.get(format);
	if (!exporter) {
		throw new Error(`No exporter available for format: ${format}`);
	}

	// Export to format
	const result = await exporter.export(renderedDocument, {
		caseName,
		timestamp: new Date(),
	});

	if (!result.success) {
		throw new Error(result.error);
	}

	// Handle markdown with diagram - create ZIP archive
	if (format === "markdown" && includeDiagram && diagramImage && "content" in result) {
		await exportMarkdownZip(result.content, result.filename, diagramImage);
		return;
	}

	// Download the result
	if ("blob" in result) {
		saveAs(result.blob, result.filename);
	} else if ("content" in result) {
		// For text formats like Markdown, create a blob from the content
		const blob = new Blob([result.content], { type: result.mimeType });
		saveAs(blob, result.filename);
	}
}

/**
 * Export markdown with diagram as a ZIP archive.
 *
 * Creates a ZIP containing:
 * - report.md - the markdown file with relative image reference
 * - diagram.png - the diagram image
 */
async function exportMarkdownZip(
	markdownContent: string,
	markdownFilename: string,
	diagramImage: DiagramImage
): Promise<void> {
	const zip = new JSZip();

	// Add markdown file
	zip.file(markdownFilename, markdownContent);

	// Convert base64 to binary and add PNG
	const binaryData = atob(diagramImage.data);
	const uint8Array = new Uint8Array(binaryData.length);
	for (let i = 0; i < binaryData.length; i++) {
		uint8Array[i] = binaryData.charCodeAt(i);
	}
	zip.file("diagram.png", uint8Array);

	// Generate and download ZIP
	const zipBlob = await zip.generateAsync({ type: "blob" });
	const zipFilename = markdownFilename.replace(/\.md$/, ".zip");
	saveAs(zipBlob, zipFilename);
}
