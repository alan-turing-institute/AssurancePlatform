import type { PlainCase, PlainTreeNode } from "@/lib/case/defined-terms";
import type {
	ContentBlock,
	DiagramImage,
	HeadingBlock,
	RenderedDocument,
	RenderedSection,
	SectionType,
} from "@/lib/export/types";

export const OVERVIEW: DiagramImage = {
	data: "data:image/png;base64,AAAA",
	format: "png",
};

export function typesOf(document: RenderedDocument): SectionType[] {
	return document.sections.map((section) => section.type);
}

export function sectionOf(
	document: RenderedDocument,
	type: SectionType
): RenderedSection {
	const section = document.sections.find((s) => s.type === type);
	if (!section) {
		throw new Error(`no ${type} section`);
	}
	return section;
}

export function heading(
	level: HeadingBlock["level"],
	text: string
): ContentBlock {
	return { type: "heading", level, text };
}

export function paragraph(text: string): ContentBlock {
	return { type: "paragraph", text };
}

export function metadata(key: string, value: string): ContentBlock {
	return { type: "metadata", key, value };
}

/**
 * Builders for small cases handed to the export templates. A node has an empty
 * description and no children unless the test says otherwise.
 */

export function exportNode(
	fields: Partial<PlainTreeNode> & Pick<PlainTreeNode, "id" | "type">
): PlainTreeNode {
	return {
		name: null,
		description: "",
		inSandbox: false,
		children: [],
		...fields,
	};
}

export function exportCase(
	tree: PlainTreeNode,
	caseFields: Partial<PlainCase["case"]> = {}
): PlainCase {
	return {
		version: "1.0",
		exportedAt: "2024-01-15T10:00:00Z",
		case: {
			name: "Sample case",
			description: "Sample description",
			...caseFields,
		},
		tree,
	};
}
