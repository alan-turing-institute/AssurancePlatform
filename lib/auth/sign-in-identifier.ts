import { createHash } from "node:crypto";

/**
 * Longest identifier that is counted. A valid email is at most 254 characters
 * and a username at most 50, so anything longer is cut before it is hashed and
 * a very long value costs no more than a short one.
 */
const MAX_COUNTED_IDENTIFIER_LENGTH = 256;

/**
 * Reduces what a person typed in the "email or username" box to the value the
 * server looks up: leading and trailing whitespace removed, and `null` when
 * nothing is left or the value is not a string. Capitals are kept, because
 * usernames are matched exactly. Passwords never go through this function.
 */
export function normaliseSignInIdentifier(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}

/**
 * The key a sign-in name is counted under: the normalised name, cut to a fixed
 * length, lowercased and hashed. Capitals are ignored so every spelling of an
 * email shares one count, and the hash means a password typed into the name
 * box by mistake is never stored. Sign-in and password reset both call this,
 * so they always agree on the key.
 */
export function signInIdentifierKey(identifier: string): string {
	const name = normaliseSignInIdentifier(identifier) ?? "";
	return createHash("sha256")
		.update(name.slice(0, MAX_COUNTED_IDENTIFIER_LENGTH).toLowerCase())
		.digest("hex");
}
