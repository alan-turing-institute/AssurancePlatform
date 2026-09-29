import { loader } from "fumadocs-core/source";
import { docs } from "@/.source/server";

/**
 * The single place the content tree (`content/`) is read into a Fumadocs
 * source. Everything that needs the docs page tree — the layout sidebar,
 * the catch-all page route, the case-studies index, search — goes through
 * this loader rather than reading `.source` directly.
 */
export const source = loader({
	baseUrl: "/docs",
	source: docs.toFumadocsSource(),
});
