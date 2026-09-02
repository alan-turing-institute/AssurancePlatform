export const FALLBACK_IMAGE =
	"https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=3000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

/**
 * Resolves a published item's feature image `src` for both Discover render
 * sites (the detail page and the index card). `""` is the common case here,
 * not an edge case: `CaseInformationSection`'s form defaults
 * `featureImageUrl` to `""`, and `caseInformationSchema`
 * (`lib/schemas/case-information.ts`) keeps `""` distinct from `null` so a
 * caller can tell "leave untouched" (`undefined`) apart from "clear it"
 * (`null`) — that means any published case whose author never touched the
 * image field stores `""`, and `""` has to fall back to the placeholder
 * exactly like `null`/`undefined` do, or the detail/index pages render a
 * broken image instead of the Unsplash placeholder.
 */
export function resolveFeatureImageSrc(url: string | null | undefined): string {
	return url ? url : FALLBACK_IMAGE;
}
