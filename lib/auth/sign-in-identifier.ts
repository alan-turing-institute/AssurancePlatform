import { createHmac } from "node:crypto";

/**
 * Longest identifier that is counted. A valid email is at most 254 characters
 * and a username at most 50, so anything longer is cut before it is hashed and
 * a very long value costs no more than a short one.
 */
const MAX_COUNTED_IDENTIFIER_LENGTH = 256;

/** Written before every name, so these keys differ from any other value signed under the same secret. */
const KEY_CONTEXT = "sign-in-name:";

const ASCII_CAPITALS = /[A-Z]/g;

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
 * The normalised name cut to the length that is counted: the text
 * `signInIdentifierKey` builds its key from, and the text to compare against
 * accounts when asking whose failures that key holds.
 */
export function countedName(identifier: string): string {
	return (normaliseSignInIdentifier(identifier) ?? "").slice(
		0,
		MAX_COUNTED_IDENTIFIER_LENGTH
	);
}

/**
 * Whether sign-in looks this name up as an email, which it does for any name
 * containing "@". Any other name is a username, matched exactly.
 */
export function isEmailName(identifier: string): boolean {
	return countedName(identifier).includes("@");
}

function signingSecret(): string {
	const secret = process.env.NEXTAUTH_SECRET;
	if (!secret) {
		throw new Error(
			"NEXTAUTH_SECRET must be configured to count sign-in attempts"
		);
	}
	return secret;
}

/**
 * The key a sign-in name is counted under: the normalised name, cut to a fixed
 * length and signed with an HMAC-SHA-256 keyed from `NEXTAUTH_SECRET`. Capitals
 * are folded only where sign-in itself ignores them: in a name containing "@"
 * the ASCII capitals `A` to `Z` are lowercased, matching the email lookup, so
 * every spelling of an email shares one count; any other name is a username,
 * which is case-sensitive, and is used exactly as typed. Capitals outside ASCII
 * are never folded. The keyed hash means a password typed into the name box by
 * mistake is stored in a form that cannot be reversed with a dictionary.
 * Throws when `NEXTAUTH_SECRET` is not set. Sign-in and password reset both
 * call this, so they always agree on the key.
 */
export function signInIdentifierKey(identifier: string): string {
	const name = countedName(identifier);
	const counted = name.includes("@")
		? name.replace(ASCII_CAPITALS, (capital) => capital.toLowerCase())
		: name;
	return createHmac("sha256", signingSecret())
		.update(KEY_CONTEXT + counted)
		.digest("hex");
}
