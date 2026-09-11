import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Permanent guard against a new plaintext-token write/read path opening up
 * elsewhere (see "TEA — Encrypt stored OAuth tokens at rest"): encrypting
 * `users.github_access_token`/`google_access_token`/`google_refresh_token`
 * only works if every file that touches those three fields is one of the
 * known, reviewed sites below. A new file referencing any of them — a write
 * that bypasses `encryptToken`, or a read that bypasses `decryptToken` —
 * must be added here deliberately; this test fails loudly instead of
 * silently missing it.
 */

const REPO_ROOT = process.cwd();
const FIELD_NAMES = [
	"githubAccessToken",
	"googleAccessToken",
	"googleRefreshToken",
];

/**
 * The full set of files under `lib/` and `app/` allowed to reference the
 * field names, as of this test's writing:
 * - `lib/auth/config.ts` — encrypts on write (sign-in / account linking)
 * - `lib/services/github-api-service.ts` — decrypts on read
 * - `lib/services/google-drive-service.ts` — encrypts on refresh, decrypts
 *   on read
 * - `lib/auth/google-account-status.ts`,
 *   `lib/services/connected-accounts-service.ts` — presence-only checks and
 *   nulling on disconnect; never read or write the token value itself
 */
const ALLOW_LIST = [
	"lib/auth/config.ts",
	"lib/auth/google-account-status.ts",
	"lib/services/connected-accounts-service.ts",
	"lib/services/github-api-service.ts",
	"lib/services/google-drive-service.ts",
].sort();

function grepFilesReferencingFields(): string[] {
	const result = spawnSync(
		"grep",
		[
			"-rl",
			FIELD_NAMES.join("\\|"),
			"lib",
			"app",
			"--include=*.ts",
			"--include=*.tsx",
		],
		{ cwd: REPO_ROOT, encoding: "utf8" }
	);

	// grep exits 1 (not an error here) when nothing matches; only a genuine
	// spawn failure (missing binary etc.) should fail the test outright.
	if (result.error) {
		throw result.error;
	}

	return (result.stdout ?? "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((file) => path.normalize(file))
		.filter((file) => !file.startsWith(`src${path.sep}generated${path.sep}`))
		.filter((file) => !file.includes(`__tests__${path.sep}`))
		.filter(
			(file) => !(file.endsWith(".test.ts") || file.endsWith(".test.tsx"))
		)
		.filter((file) => file !== path.normalize("lib/auth/token-encryption.ts"))
		.sort();
}

describe("OAuth token field boundary", () => {
	it("only the known, reviewed sites reference githubAccessToken/googleAccessToken/googleRefreshToken", () => {
		expect(grepFilesReferencingFields()).toEqual(ALLOW_LIST);
	});
});
