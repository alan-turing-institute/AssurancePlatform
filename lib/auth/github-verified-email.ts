import { logger } from "@/lib/logger";

const log = logger.child({ component: "github-verified-email" });

const GITHUB_EMAILS_URL = "https://api.github.com/user/emails?per_page=100";
const REQUEST_TIMEOUT_MS = 5000;

type NotVerifiedReason =
	| "no-token"
	| "request-failed"
	| "bad-status"
	| "bad-body";

function notVerified(reason: NotVerifiedReason): false {
	log.warn("GitHub email could not be confirmed as verified", { reason });
	return false;
}

function listsAsVerified(body: unknown, email: string): boolean | null {
	if (!Array.isArray(body)) {
		return null;
	}
	const wanted = email.toLowerCase();
	return body.some(
		(entry: unknown) =>
			typeof entry === "object" &&
			entry !== null &&
			(entry as { verified?: unknown }).verified === true &&
			typeof (entry as { email?: unknown }).email === "string" &&
			(entry as { email: string }).email.toLowerCase() === wanted
	);
}

/**
 * Asks GitHub for the signed-in person's email addresses, with the access
 * token from that sign-in, and answers whether `email` is in the list marked
 * verified. Addresses are compared without regard to capitals; only the
 * boolean true on `verified` counts. Only the first page of up to a hundred
 * addresses is read. Every failure (no token, a network error, a timeout, a
 * redirect or other non-success status, a body that is not a list) answers
 * false and logs one warning carrying a short reason and nothing else.
 */
export async function isGitHubEmailVerified(
	accessToken: string | undefined,
	email: string
): Promise<boolean> {
	if (!accessToken) {
		return notVerified("no-token");
	}

	let response: Response;
	try {
		response = await fetch(GITHUB_EMAILS_URL, {
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${accessToken}`,
				"User-Agent": "TEA-Platform",
				"X-GitHub-Api-Version": "2022-11-28",
			},
			redirect: "manual",
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch {
		return notVerified("request-failed");
	}

	if (!response.ok) {
		return notVerified("bad-status");
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		return notVerified("bad-body");
	}

	const verified = listsAsVerified(body, email);
	if (verified === null) {
		return notVerified("bad-body");
	}
	if (!verified) {
		log.warn("GitHub email could not be confirmed as verified", {
			reason: "not-listed-verified",
		});
	}
	return verified;
}
