import type { ElementType } from "@/lib/schemas/case-export";
import type { ElementWithLinks } from "@/lib/transforms/build-tree";

/**
 * One row as the export query hands it to the tree builder: every field the
 * builder reads, with nothing set that the test does not name.
 */
export function treeRow(
	id: string,
	elementType: ElementType,
	name: string | null,
	parentId: string | null,
	overrides: Partial<ElementWithLinks> = {}
): ElementWithLinks {
	return {
		id,
		elementType,
		name,
		description: `description of ${id}`,
		parentId,
		isDefeater: false,
		defeatsElementId: null,
		assertionStatus: null,
		assumption: null,
		citedElementId: null,
		context: [],
		fromPattern: false,
		inSandbox: false,
		justification: null,
		level: null,
		modifiedFromPattern: false,
		moduleEmbedType: null,
		modulePublicSummary: null,
		moduleReferenceId: null,
		role: null,
		url: null,
		...overrides,
	};
}
