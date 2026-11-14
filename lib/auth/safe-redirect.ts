/**
 * Placeholder origin used only to resolve a candidate path. A value that
 * resolves to any other origin points off-site.
 */
const PLACEHOLDER_ORIGIN = "https://same-site.invalid";

const BACKSLASH_CODE = 0x5c;
const LAST_C0_CONTROL_CODE = 0x1f;
const FIRST_DELETE_OR_C1_CONTROL_CODE = 0x7f;
const LAST_C1_CONTROL_CODE = 0x9f;

function hasBackslashOrControlCharacter(value: string): boolean {
	for (const char of value) {
		const code = char.codePointAt(0) ?? 0;
		if (
			code === BACKSLASH_CODE ||
			code <= LAST_C0_CONTROL_CODE ||
			(code >= FIRST_DELETE_OR_C1_CONTROL_CODE && code <= LAST_C1_CONTROL_CODE)
		) {
			return true;
		}
	}
	return false;
}

/**
 * Returns the same-site path (with query and fragment) to follow after
 * sign-in, or `fallback` when the value is missing or could lead off-site.
 *
 * Only a value that begins with a single `/` is followed. A backslash or a
 * control character anywhere in it is refused, because browsers treat a
 * backslash as a slash and drop tabs and newlines before parsing. The value is
 * then resolved against a fixed placeholder origin: a different origin, or a
 * normalised path that begins with `//` (as `/a/..//host` does), is refused.
 * When several values are given, the first is used.
 */
export function safeRedirectPath(
	raw: string | readonly string[] | null | undefined,
	fallback = "/dashboard"
): string {
	const value = Array.isArray(raw) ? raw[0] : raw;
	if (typeof value !== "string") {
		return fallback;
	}
	if (!value.startsWith("/") || value.startsWith("//")) {
		return fallback;
	}
	if (hasBackslashOrControlCharacter(value)) {
		return fallback;
	}

	let resolved: URL;
	try {
		resolved = new URL(value, PLACEHOLDER_ORIGIN);
	} catch {
		return fallback;
	}
	if (
		resolved.origin !== PLACEHOLDER_ORIGIN ||
		resolved.pathname.startsWith("//")
	) {
		return fallback;
	}

	return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
