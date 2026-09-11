/**
 * Sweeps existing users for plaintext OAuth tokens (github_access_token,
 * google_access_token, google_refresh_token) and encrypts them in place
 * (see "TEA — Encrypt stored OAuth tokens at rest"). Idempotent: a field
 * already shaped like the encrypted envelope (`isEncrypted`) is left
 * untouched, so re-running this after a partial run, or after new users
 * have signed in with the encryption path already live, is safe.
 *
 * Dry run by default — prints counts only, writes nothing. Pass --apply to
 * write. Never prints token values, only counts.
 *
 * Run with: npx tsx scripts/encrypt-oauth-tokens.ts [--apply]
 */

import { encryptToken, isEncrypted } from "../lib/auth/token-encryption";
import { prisma } from "../lib/prisma";

const BATCH_SIZE = 100;

interface Counts {
	githubEncrypted: number;
	googleAccessEncrypted: number;
	googleRefreshEncrypted: number;
	scanned: number;
	usersUpdated: number;
}

function freshCounts(): Counts {
	return {
		scanned: 0,
		githubEncrypted: 0,
		googleAccessEncrypted: 0,
		googleRefreshEncrypted: 0,
		usersUpdated: 0,
	};
}

interface UserTokens {
	githubAccessToken: string | null;
	googleAccessToken: string | null;
	googleRefreshToken: string | null;
	id: string;
}

interface EncryptedFields {
	githubAccessToken?: string;
	googleAccessToken?: string;
	googleRefreshToken?: string;
}

/**
 * Encrypts `value` if it's non-null plaintext (not already in the encrypted
 * envelope shape). Returns `undefined` when there's nothing to change, so
 * callers can distinguish "no update needed" from "value updated" without a
 * sentinel.
 */
function encryptIfPlaintext(value: string | null): string | undefined {
	if (!value || isEncrypted(value)) {
		return undefined;
	}
	return encryptToken(value);
}

/**
 * Computes the encrypted replacement for each plaintext field on `user`,
 * bumping the matching per-field counter as it goes. Returns an object with
 * only the fields that actually changed — empty when the user has nothing
 * left to encrypt.
 */
function computeEncryptedFields(
	user: UserTokens,
	counts: Counts
): EncryptedFields {
	const fields: EncryptedFields = {};

	const newGithubAccessToken = encryptIfPlaintext(user.githubAccessToken);
	if (newGithubAccessToken !== undefined) {
		fields.githubAccessToken = newGithubAccessToken;
		counts.githubEncrypted++;
	}

	const newGoogleAccessToken = encryptIfPlaintext(user.googleAccessToken);
	if (newGoogleAccessToken !== undefined) {
		fields.googleAccessToken = newGoogleAccessToken;
		counts.googleAccessEncrypted++;
	}

	const newGoogleRefreshToken = encryptIfPlaintext(user.googleRefreshToken);
	if (newGoogleRefreshToken !== undefined) {
		fields.googleRefreshToken = newGoogleRefreshToken;
		counts.googleRefreshEncrypted++;
	}

	return fields;
}

async function processUser(
	user: UserTokens,
	apply: boolean,
	counts: Counts
): Promise<void> {
	counts.scanned++;
	const fields = computeEncryptedFields(user, counts);

	if (Object.keys(fields).length === 0) {
		return;
	}

	counts.usersUpdated++;

	if (apply) {
		await prisma.user.update({ where: { id: user.id }, data: fields });
	}
}

async function sweep(apply: boolean): Promise<Counts> {
	const counts = freshCounts();
	let cursor: string | undefined;

	for (;;) {
		const users = await prisma.user.findMany({
			where: {
				OR: [
					{ githubAccessToken: { not: null } },
					{ googleAccessToken: { not: null } },
					{ googleRefreshToken: { not: null } },
				],
			},
			select: {
				id: true,
				githubAccessToken: true,
				googleAccessToken: true,
				googleRefreshToken: true,
			},
			orderBy: { id: "asc" },
			take: BATCH_SIZE,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		});

		if (users.length === 0) {
			break;
		}

		for (const user of users) {
			await processUser(user, apply, counts);
		}

		cursor = users.at(-1)?.id;
		if (users.length < BATCH_SIZE) {
			break;
		}
	}

	return counts;
}

function printResults(counts: Counts, apply: boolean): void {
	console.log("\n=== Sweep results ===");
	console.log(
		`Users scanned (had at least one non-null token field): ${counts.scanned}`
	);
	console.log(`GitHub access tokens encrypted: ${counts.githubEncrypted}`);
	console.log(
		`Google access tokens encrypted: ${counts.googleAccessEncrypted}`
	);
	console.log(
		`Google refresh tokens encrypted: ${counts.googleRefreshEncrypted}`
	);
	console.log(`Users updated: ${counts.usersUpdated}`);
	if (!apply) {
		console.log(
			"\nDry run only — no changes were written. Re-run with --apply to write."
		);
	}
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	console.log(
		apply
			? "Applying encryption to legacy plaintext OAuth tokens..."
			: "Dry run — no writes will be made. Pass --apply to write."
	);

	const counts = await sweep(apply);
	printResults(counts, apply);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
