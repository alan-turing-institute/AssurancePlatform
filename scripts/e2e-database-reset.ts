/**
 * Decides whether the Playwright global setup may reset and reseed a database.
 *
 * The reset deletes every row in the database it targets, so it only runs
 * against a database that is plainly disposable: the shell's own
 * `DATABASE_URL` must name a database ending `_test` or `_e2e`, or
 * `E2E_ALLOW_RESET` must be set to `1` or `true`.
 */

export type Env = Record<string, string | undefined>;

export type ResetDecision =
	| { action: "skip"; reason: string; quiet: boolean }
	| { action: "refuse"; message: string }
	| {
			action: "reset";
			url: string;
			host: string;
			port: string;
			database: string;
	  };

export type ExecFn = (
	command: string,
	options: { stdio: "inherit"; env: Env }
) => unknown;

const TRUTHY = new Set(["1", "true"]);
const DISPOSABLE_SUFFIXES = ["_test", "_e2e"];
const DEFAULT_POSTGRES_PORT = "5432";
const DATABASE_NAME = /^[A-Za-z0-9_$-]+$/;
const AUTHORITY_END = /[/?#]/;

const isSwitchOn = (value: string | undefined) =>
	TRUTHY.has((value ?? "").trim().toLowerCase());

const REFUSAL_HINT =
	"Point DATABASE_URL, in the shell that runs Playwright, at a disposable " +
	"database whose name ends _test or _e2e, or set E2E_ALLOW_RESET=1 to " +
	"allow a differently named disposable database. Set E2E_SKIP_DB_RESET=1 " +
	"to run without resetting.";

function parseDatabaseUrl(
	raw: string
): { host: string; port: string; database: string } | null {
	let parsed: URL;
	let database: string;
	try {
		parsed = new URL(raw);
		database = decodeURIComponent(parsed.pathname.slice(1));
	} catch {
		return null;
	}
	if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
		return null;
	}
	// A name outside the plain identifier characters (including "/" or "@")
	// means the path or credentials were malformed, for example an unencoded
	// "/" in a password; the real target is unclear.
	if (!DATABASE_NAME.test(database)) {
		return null;
	}
	// An unencoded "/", "?" or "#" in the credentials ends the host part early,
	// so the real separating "@" lands after the authority and the parsed host
	// and database come from the password. The parser can also drop that part
	// (for example a "/../" or "/%2e%2e/" segment), so the raw text is checked:
	// any literal "@" after the authority is refused, and nothing the parser
	// reports is echoed. An "@" after the authority must be written "%40".
	const afterScheme = raw.slice(raw.indexOf("//") + 2);
	const authorityEnd = afterScheme.search(AUTHORITY_END);
	if (authorityEnd !== -1 && afterScheme.slice(authorityEnd).includes("@")) {
		return null;
	}
	// The drivers let these query parameters override the host part.
	if (parsed.searchParams.has("host") || parsed.searchParams.has("port")) {
		return null;
	}
	return {
		host: parsed.hostname,
		port: parsed.port || DEFAULT_POSTGRES_PORT,
		database,
	};
}

export function decideE2eDatabaseReset(env: Env): ResetDecision {
	if (env.CI) {
		return { action: "skip", reason: "CI is set", quiet: true };
	}
	if (isSwitchOn(env.E2E_SKIP_DB_RESET)) {
		return {
			action: "skip",
			reason: "E2E_SKIP_DB_RESET is set; skipping database reset and seed",
			quiet: false,
		};
	}

	const raw = (env.DATABASE_URL ?? "").trim();
	if (!raw) {
		return {
			action: "refuse",
			message:
				"Refusing to reset: DATABASE_URL is not set in the environment of " +
				"this command. The reset never reads .env, because .env normally " +
				`names the development database. ${REFUSAL_HINT}`,
		};
	}

	const target = parseDatabaseUrl(raw);
	if (!target) {
		return {
			action: "refuse",
			message:
				"Refusing to reset: DATABASE_URL is not a postgres URL that names " +
				`a database. ${REFUSAL_HINT}`,
		};
	}

	const name = target.database.toLowerCase();
	const disposable = DISPOSABLE_SUFFIXES.some((suffix) =>
		name.endsWith(suffix)
	);
	if (disposable || isSwitchOn(env.E2E_ALLOW_RESET)) {
		return { action: "reset", url: raw, ...target };
	}

	return {
		action: "refuse",
		message:
			`Refusing to reset database "${target.database}" on ` +
			`${target.host}:${target.port}: its name does not end _test or _e2e. ` +
			REFUSAL_HINT,
	};
}

export function runE2eDatabaseReset(env: Env, exec: ExecFn): void {
	const decision = decideE2eDatabaseReset(env);

	if (decision.action === "skip") {
		if (!decision.quiet) {
			console.log(decision.reason);
		}
		return;
	}
	if (decision.action === "refuse") {
		throw new Error(decision.message);
	}

	console.log(
		`Resetting and reseeding ${decision.database} on ` +
			`${decision.host}:${decision.port}; every row in it will be deleted`
	);
	const childEnv = { ...env, DATABASE_URL: decision.url };
	exec("npx prisma migrate reset --force --schema=prisma/schema.prisma", {
		stdio: "inherit",
		env: childEnv,
	});
	exec("npx tsx prisma/seed/dev-seed.ts", { stdio: "inherit", env: childEnv });
}
