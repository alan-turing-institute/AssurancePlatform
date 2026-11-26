import type {
	ContentBlock,
	DocumentMetadata,
	RenderedDocument,
	RenderedSection,
	ResolvedBranding,
	SectionType,
} from "@/lib/export/types";

interface ExportDocumentParts {
	branding?: Partial<ResolvedBranding>;
	metadata?: Partial<DocumentMetadata>;
	sections?: RenderedSection[];
}

/**
 * A complete, minimal rendered document. The parts a test names replace the
 * defaults; everything else is fixed.
 */
export function exportDocument(
	parts: ExportDocumentParts = {}
): RenderedDocument {
	return {
		metadata: {
			caseName: "Test Case",
			caseDescription: "",
			exportedAt: "2024-01-15T10:00:00Z",
			version: "1.0",
			elementCount: 1,
			format: "markdown",
			...parts.metadata,
		},
		branding: {
			primaryColour: "#1e40af",
			secondaryColour: "#64748b",
			footerText: "Footer",
			fontFamily: "Inter, sans-serif",
			...parts.branding,
		},
		sections: parts.sections ?? [],
	};
}

/** A section holding the given blocks, in the order given. */
export function exportSection(
	type: SectionType,
	title: string,
	blocks: ContentBlock[]
): RenderedSection {
	return { type, title, blocks };
}
