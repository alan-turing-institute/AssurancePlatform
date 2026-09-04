/**
 * UUID v4 generator that also works outside secure contexts.
 *
 * `crypto.randomUUID()` is spec-gated to secure contexts (HTTPS or
 * localhost) — see
 * https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID. Over
 * plain HTTP from another host (e.g. a LAN IP), `crypto.randomUUID` is
 * `undefined`, so calling it throws `TypeError: crypto.randomUUID is not a
 * function`. This falls back through `crypto.getRandomValues` — part of the
 * same Web Crypto API but not secure-context-gated — and finally to
 * `Math.random` if `crypto` itself is unavailable.
 *
 * All three paths return a UUID v4-shaped string
 * (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`) so callers that treat the result
 * as UUID-shaped (schema validation, tests, prefixed ids) see the same
 * shape regardless of which path produced it.
 */
export function generateUuid(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}

	if (
		typeof crypto !== "undefined" &&
		typeof crypto.getRandomValues === "function"
	) {
		return uuidFromBytes(crypto.getRandomValues(new Uint8Array(16)));
	}

	return uuidFromBytes(
		Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
	);
}

const VARIANT_NIBBLES = ["8", "9", "a", "b"];

/**
 * Sets the RFC 4122 version (4) and variant nibbles, then hex-formats.
 * Works on the hex digits rather than bitwise-masking the bytes — bitwise
 * operators are banned by lint/suspicious/noBitwiseOperators here.
 */
function uuidFromBytes(bytes: Uint8Array): string {
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

	// Version nibble: force to "4", keep the byte's low nibble.
	hex[6] = `4${hex[6]?.[1] ?? "0"}`;

	// Variant nibble: RFC 4122 requires the top two bits to be "10" (hex
	// 8/9/a/b); the low two bits carry through from the source byte.
	const highNibble = Number.parseInt(hex[8]?.[0] ?? "0", 16);
	const variant = VARIANT_NIBBLES[highNibble % 4] ?? "8";
	hex[8] = `${variant}${hex[8]?.[1] ?? "0"}`;

	return [
		hex.slice(0, 4).join(""),
		hex.slice(4, 6).join(""),
		hex.slice(6, 8).join(""),
		hex.slice(8, 10).join(""),
		hex.slice(10, 16).join(""),
	].join("-");
}
