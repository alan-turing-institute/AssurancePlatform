import { createHash, randomBytes } from "node:crypto";

/**
 * Pure crypto helpers for machine API tokens (ADR 0002 v2 §2.4). Mirrors
 * `password-service.ts`'s split: no Prisma here, no business rules — just
 * secret generation and hashing. The integration registry service owns the
 * database side.
 */

/** Prefix on every issued token secret, e.g. `teap_xxxxxxxxxxxxxxxxxxxxxxxx`. */
export const TOKEN_PREFIX = "teap_";

/** Random bytes of entropy in the token body (256 bits). */
const TOKEN_BODY_BYTES = 32;

/** Leading characters of the plaintext secret persisted for UI/log identification. */
const TOKEN_PREFIX_DISPLAY_LENGTH = 12;

/**
 * Generates a new token secret: `teap_` + a cryptographically random,
 * URL-safe body. Shown to the caller exactly once — only its SHA-256 hash
 * is persisted.
 */
export function generateApiTokenSecret(): string {
	const body = randomBytes(TOKEN_BODY_BYTES).toString("base64url");
	return `${TOKEN_PREFIX}${body}`;
}

/** SHA-256 hash (hex) of a token secret, for at-rest storage and lookup. */
export function hashApiTokenSecret(secret: string): string {
	return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Leading characters of a secret, stored alongside the hash for identification. */
export function tokenDisplayPrefix(secret: string): string {
	return secret.slice(0, TOKEN_PREFIX_DISPLAY_LENGTH);
}

/** True if `value` has the shape of a machine API token (cheap pre-filter before hashing). */
export function looksLikeApiToken(value: string): boolean {
	return value.startsWith(TOKEN_PREFIX) && value.length > TOKEN_PREFIX.length;
}
