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

/** One line for the account and its Bluebird case, then one for each showcase case. */
function describeResult(result: DemoAccountResult): string {
	if (result.status !== "created") {
		return "demo account already exists: nothing changed";
	}
	return [
		`demo account ready: case id=${result.caseId}`,
		...result.showcaseCases.map(
			(imported) =>
				`showcase case ready: case id=${imported.caseId} file=${imported.file}`
		),
	].join("\n");
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
