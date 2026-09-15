import type { CreateNodePayload } from "@/lib/case/types";

/**
 * The two kinds of side-attached element the D7 picker creates. Lives here
 * (not in the hook that also uses it) so `lib/` never imports from
 * `hooks/` — matching this codebase's established layering
 * (`lib/plugins/slots/types.ts`'s docstring on `DiagramNodeType`).
 */
export type CitedElementKind = "away-goal" | "module";

export interface BuildCitedElementPayloadInput {
	assuranceCaseId: string;
	citedElementId?: string;
	description: string;
	kind: CitedElementKind;
	moduleReferenceId: string;
	name?: string;
	parentId: string;
}

/**
 * Builds the create-element payload for an away goal or a module (ADR 0005
 * D7) — a discriminated union on `kind`: an away goal additionally sets
 * `citedElementId`; a module sets `moduleEmbedType: "COPY"` (required by
 * the Prisma validation layer for MODULE elements — see
 * `lib/schemas/element.ts` — "COPY", a snapshot rather than a live link, is
 * the safer default absent any UI for choosing embed type in 1.0).
 * Extracted from `add-cited-element-form.tsx` (review round 1) so this
 * discrimination is unit-testable without rendering the form.
 */
export function buildCitedElementPayload(
	input: BuildCitedElementPayloadInput
): CreateNodePayload {
	const {
		kind,
		parentId,
		assuranceCaseId,
		moduleReferenceId,
		citedElementId,
		name,
		description,
	} = input;

	const base: CreateNodePayload = {
		description,
		name: name?.trim() || undefined,
		parentId,
		assuranceCaseId,
		moduleReferenceId,
	};

	if (kind === "away-goal") {
		return { ...base, citedElementId };
	}
	return { ...base, moduleEmbedType: "COPY" };
}
