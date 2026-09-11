import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for OAuth tokens at rest (`users.github_access_token`,
 * `users.google_access_token`, `users.google_refresh_token`). The envelope is
 * a plain string — so the columns stay `TEXT` — shaped
 * `v<version>:<iv>:<ciphertext||tag>`, both parts base64url:
 *
 *   v1:<12-byte IV, base64url>:<ciphertext + 16-byte auth tag, base64url>
 *
 * `isEncrypted` recognises the envelope (`^v\d+:`); anything else is legacy
 * plaintext, which `decryptToken` returns unchanged so existing rows and the
 * sweep script (`scripts/encrypt-oauth-tokens.ts`) keep working during
 * rollout.
 *
 * Key rotation: `encryptToken` always writes `CURRENT_VERSION`; `decryptToken`
 * selects the key by the envelope's own version prefix. Adding a `v2` (e.g.
 * after a rotation) is a one-line addition to `KEY_ENV_VAR_BY_VERSION` plus
 * bumping `CURRENT_VERSION` — no change to any call site.
 */

const CURRENT_VERSION = "v1";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;
const ALGORITHM = "aes-256-gcm";
const ENVELOPE_REGEX = /^(v\d+):([^:]+):([^:]+)$/;

/**
 * Thrown when no usable encryption key is configured for the requested (or
 * the envelope's own) version — env var unset, not valid base64, or not
 * exactly 32 bytes once decoded. Never includes the offending value.
 */
export class TokenEncryptionUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TokenEncryptionUnavailableError";
	}
}

/** Env var holding the key for each supported envelope version. */
const KEY_ENV_VAR_BY_VERSION: Record<string, string> = {
	v1: "TOKEN_ENCRYPTION_KEY",
};

/**
 * Reads and validates the key for `version`, lazily — at call time, not
 * module load — so tests can set the env var per test and a build without it
 * does not fail at import.
 */
function keyForVersion(version: string): Buffer {
	const envVar = KEY_ENV_VAR_BY_VERSION[version];
	if (!envVar) {
		throw new TokenEncryptionUnavailableError(
			`No encryption key is configured for token envelope version "${version}".`
		);
	}

	const encoded = process.env[envVar];
	if (!encoded) {
		throw new TokenEncryptionUnavailableError(
			`${envVar} is not set; token encryption is unavailable.`
		);
	}

	const key = Buffer.from(encoded, "base64");
	if (key.length !== KEY_BYTES) {
		throw new TokenEncryptionUnavailableError(
			`${envVar} must be base64 encoding exactly ${KEY_BYTES} bytes.`
		);
	}

	return key;
}

/** True when `stored` has the envelope shape (`v<n>:...`); false for legacy plaintext. */
export function isEncrypted(stored: string): boolean {
	return ENVELOPE_REGEX.test(stored);
}

/**
 * Encrypts `plain` under the current envelope version with a fresh random
 * IV — two calls with the same input never produce the same output.
 * Throws `TokenEncryptionUnavailableError` if no key is configured.
 */
export function encryptToken(plain: string): string {
	const key = keyForVersion(CURRENT_VERSION);
	const iv = randomBytes(IV_BYTES);

	const cipher = createCipheriv(ALGORITHM, key, iv);
	const ciphertext = Buffer.concat([
		cipher.update(plain, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	const payload = Buffer.concat([ciphertext, authTag]);
	return `${CURRENT_VERSION}:${iv.toString("base64url")}:${payload.toString("base64url")}`;
}

/**
 * Decrypts a `vN:` envelope produced by `encryptToken`. Legacy plaintext (no
 * recognised version prefix) is returned unchanged. An unknown version, a
 * malformed envelope, or a failed auth tag (tampered ciphertext, or the
 * wrong key) throws — this never returns corrupted data as if it were a
 * valid token.
 */
export function decryptToken(stored: string): string {
	const match = stored.match(ENVELOPE_REGEX);
	if (!match) {
		return stored;
	}

	const [, version, ivPart, payloadPart] = match as unknown as [
		string,
		string,
		string,
		string,
	];
	const key = keyForVersion(version);

	const iv = Buffer.from(ivPart, "base64url");
	const payload = Buffer.from(payloadPart, "base64url");
	if (payload.length <= AUTH_TAG_BYTES) {
		throw new Error("Malformed token envelope: ciphertext too short.");
	}

	const ciphertext = payload.subarray(0, payload.length - AUTH_TAG_BYTES);
	const authTag = payload.subarray(payload.length - AUTH_TAG_BYTES);

	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);
	const plaintext = Buffer.concat([
		decipher.update(ciphertext),
		decipher.final(),
	]);

	return plaintext.toString("utf8");
}
