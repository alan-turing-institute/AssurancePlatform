/**
 * Seeds the shared demo account on a freshly reset staging database.
 * The staging reseed workflow runs it after the development seed.
 *
 * Run: npx tsx prisma/seed/demo-account.ts
 *
 * Reads DATABASE_URL, DEMO_ACCOUNT_PASSWORD, DEMO_OPENROUTER_API_KEY,
 * DEMO_PIPELINE_TOKEN and TOKEN_ENCRYPTION_KEY from the environment. It exits
 * non-zero, naming what is wrong, if any is missing or malformed. It prints
 * no secret: a failure reports only the kind of error and its code.
 */

import { TokenEncryptionUnavailableError } from "../../lib/auth/token-encryption";
import {
	type DemoAccountResult,
	DemoSeedError,
	readDemoAccountValues,
	seedDemoAccount,
} from "./demo-account-seed";

/** The error's code, in brackets, when it has one (Prisma errors do). */
function errorCode(error: Error): string {
	const code = "code" in error ? error.code : undefined;
	return typeof code === "string" ? ` (${code})` : "";
}

/** What is safe to print about a failure: a Prisma error message can echo the arguments of the failed call. */
function describeFailure(error: unknown): string {
	if (
		error instanceof DemoSeedError ||
		error instanceof TokenEncryptionUnavailableError
	) {
		return error.message;
	}
	return error instanceof Error
		? `${error.name}${errorCode(error)}`
		: "unknown error";
}

function describeResult(result: DemoAccountResult): string {
	return result.status === "created"
		? `demo account ready: case id=${result.caseId}`
		: "demo account already exists: nothing changed";
}

async function main(): Promise<number> {
	const checked = readDemoAccountValues(process.env);
	if ("problems" in checked) {
		console.error(checked.problems.join("\n"));
		return 1;
	}

	try {
		console.log(describeResult(await seedDemoAccount(checked.values)));
		return 0;
	} catch (error) {
		console.error(`Demo account seed failed: ${describeFailure(error)}`);
		return 1;
	}
}

// Exiting explicitly: the database connection pools do not close on their own.
main().then((code) => process.exit(code));
