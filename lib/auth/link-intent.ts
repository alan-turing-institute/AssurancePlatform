import { createHmac, randomBytes } from "node:crypto";
import { timingSafeCompare } from "@/lib/auth/timing-safe";

/**
 * Signed, short-lived tokens that stand in for the raw user id previously
 * stored in the OAuth account-linking cookie (see `app/api/auth/link/
 * [provider]/route.ts` and the `signIn` callback in `./config.ts`).
 *
 * A token is `base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload))`,
 * keyed from `NEXTAUTH_SECRET` — the app already requires this for session
 * encryption, so no new secret is introduced. The payload carries the
 * linking user id, the provider it was issued for, a random nonce (unused
 * beyond making the token unguessable; the cookie's single-read-then-delete
 * lifecycle is what makes replay ineffective) and a short expiry.
 */

const LINK_INTENT_MAX_AGE_SECONDS = 60 * 5; // 5 minutes — mirrors the OAuth flow's cookie lifetime

interface LinkIntentPayload {
	/** Unix seconds expiry. */
	exp: number;
	/** Random nonce; makes the token unguessable. */
	n: string;
	/** The provider this intent was issued for ("github" | "google"). */
	p: string;
	/** The user id the caller is linking a provider account to. */
	u: string;
}

function isLinkIntentPayload(value: unknown): value is LinkIntentPayload {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as Record<string, unknown>).u === "string" &&
		typeof (value as Record<string, unknown>).p === "string" &&
		typeof (value as Record<string, unknown>).n === "string" &&
		typeof (value as Record<string, unknown>).exp === "number"
	);
}

function getSigningSecret(): string {
	const secret = process.env.NEXTAUTH_SECRET;
	if (!secret) {
		throw new Error(
			"NEXTAUTH_SECRET must be configured to sign account-link intents"
		);
	}
	return secret;
}

function sign(payloadB64: string, secret: string): string {
	return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

/** Creates a signed, provider-bound, short-lived link intent token. */
export function createLinkIntent({
	userId,
	provider,
}: {
	userId: string;
	provider: string;
}): string {
	const secret = getSigningSecret();
	const payload: LinkIntentPayload = {
		u: userId,
		p: provider,
		n: randomBytes(16).toString("base64url"),
		exp: Math.floor(Date.now() / 1000) + LINK_INTENT_MAX_AGE_SECONDS,
	};
	const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `${payloadB64}.${sign(payloadB64, secret)}`;
}

/**
 * Verifies a link intent token against the provider the OAuth callback is
 * currently running for. Never throws — any malformed, tampered, expired or
 * provider-mismatched token simply returns `null`, exactly like an absent one.
 */
export function verifyLinkIntent(
	token: string,
	expected: { provider: string }
): { userId: string } | null {
	if (typeof token !== "string" || token.length === 0) {
		return null;
	}

	const parts = token.split(".");
	if (parts.length !== 2) {
		return null;
	}
	const [payloadB64, signatureB64] = parts;
	if (!(payloadB64 && signatureB64)) {
		return null;
	}

	let secret: string;
	try {
		secret = getSigningSecret();
	} catch {
		return null;
	}

	if (!timingSafeCompare(signatureB64, sign(payloadB64, secret))) {
		return null;
	}

	let payload: unknown;
	try {
		payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
	} catch {
		return null;
	}
	if (!isLinkIntentPayload(payload)) {
		return null;
	}

	if (payload.p !== expected.provider) {
		return null;
	}

	// `exp` is exclusive (RFC 7519): the token is no longer valid AT its
	// expiry second, not just after it.
	if (Math.floor(Date.now() / 1000) >= payload.exp) {
		return null;
	}

	return { userId: payload.u };
}

export { LINK_INTENT_MAX_AGE_SECONDS };
