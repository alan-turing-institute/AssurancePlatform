import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import { generateApiTokenSecret } from "@/lib/auth/api-token-service";
import prisma from "@/lib/prisma";
import { committedFixtureText, elementsIn } from "./demo-fixture-files";

/**
 * Helpers for the shared demo account tests: the values the account is built
 * from, a runner for the seed's entry point as its own process (the way the
 * reseed workflow runs it), a whole-database snapshot to prove "changed
 * nothing", and the fixture's element ids.
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const TSX_CLI = join(ROOT, "node_modules/tsx/dist/cli.mjs");
const ENTRY_POINT = "prisma/seed/demo-account.ts";
const DEV_SEED = "prisma/seed/dev-seed.ts";

/**
 * The id the demo case must always have. Pipeline configurations name it, so
 * a change to it breaks every pipeline pointed at the account.
 */
export const DEMO_CASE_ID = "c557f324-f2a8-41cd-87c5-6a662fefff9f";

export const DEMO_SCOPES = [
	"health:checks:write",
	"health:criteria:read",
	"health:evidence:write",
];

export interface DemoSecrets {
	openRouterKey: string;
	password: string;
	pipelineToken: string;
}

/** Fresh random secrets that pass the checks; none shares a window with another. */
export function makeSecrets(): DemoSecrets {
	const hex = () => randomBytes(9).toString("hex");
	return {
		password: `Zq9-${hex()}-${hex()}!`,
		openRouterKey: `sk-or-v1-${hex()}${hex()}`,
		pipelineToken: generateApiTokenSecret(),
	};
}

/** The five variables the entry point reads, complete and valid. */
export function validEnv(
	secrets: DemoSecrets,
	overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
	return {
		DATABASE_URL: process.env.DATABASE_URL,
		DEMO_ACCOUNT_PASSWORD: secrets.password,
		DEMO_OPENROUTER_API_KEY: secrets.openRouterKey,
		DEMO_PIPELINE_TOKEN: secrets.pipelineToken,
		TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
		...overrides,
	};
}

export interface ChildResult {
	code: number | null;
	output: string;
	stderr: string;
	stdout: string;
}

function runScript(
	script: string,
	env: Record<string, string | undefined>,
	timeoutMs: number
): Promise<ChildResult> {
	// The framework's typing of ProcessEnv requires NODE_ENV; the child is
	// deliberately given none, as the workflow gives none.
	const childEnv = {} as NodeJS.ProcessEnv;
	for (const name of ["PATH", "HOME", "TMPDIR", "LANG"]) {
		const value = process.env[name];
		if (value !== undefined) {
			childEnv[name] = value;
		}
	}
	for (const [name, value] of Object.entries(env)) {
		if (value !== undefined) {
			childEnv[name] = value;
		}
	}
	return new Promise((done, fail) => {
		const child = spawn(process.execPath, [TSX_CLI, script], {
			cwd: ROOT,
			env: childEnv,
		});
		child.stdin.end();
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += String(chunk);
		});
		child.stderr.on("data", (chunk) => {
			stderr += String(chunk);
		});
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			fail(new Error(`${script} did not finish in ${timeoutMs} ms`));
		}, timeoutMs);
		child.on("error", (error) => {
			clearTimeout(timer);
			fail(error);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			done({ code, stdout, stderr, output: `${stdout}\n${stderr}` });
		});
	});
}

/**
 * Runs the demo-account entry point as its own process with exactly `env`
 * (plus PATH and HOME). A variable whose value is `undefined` is not set.
 */
export function runDemoEntryPoint(
	env: Record<string, string | undefined>,
	timeoutMs = 90_000
): Promise<ChildResult> {
	return runScript(ENTRY_POINT, env, timeoutMs);
}

/** Runs the development seed against the worker database, as the reseed workflow does. */
export function runDevSeed(timeoutMs = 120_000): Promise<ChildResult> {
	return runScript(
		DEV_SEED,
		{
			DATABASE_URL: process.env.DATABASE_URL,
			SEED_USER_PASSWORD: "DevSeed-Pass-1!",
			TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
		},
		timeoutMs
	);
}

/**
 * Every window of `size` characters in each secret, plus the secret itself.
 * A line of output containing one of them shows part of a secret.
 */
function secretFragments(secrets: string[], size = 6): string[] {
	const fragments = new Set<string>();
	for (const secret of secrets) {
		fragments.add(secret);
		for (let start = 0; start + size <= secret.length; start += 1) {
			fragments.add(secret.slice(start, start + size));
		}
	}
	return [...fragments];
}

/** The first secret fragment found in `output`, or null. */
export function findLeak(output: string, secrets: string[]): string | null {
	for (const fragment of secretFragments(secrets)) {
		if (output.includes(fragment)) {
			return fragment;
		}
	}
	return null;
}

/** Every secret an entry-point run was given, for leak checks. */
export function allSecretValues(
	env: Record<string, string | undefined>
): string[] {
	const values: string[] = [];
	for (const name of [
		"DEMO_ACCOUNT_PASSWORD",
		"DEMO_OPENROUTER_API_KEY",
		"DEMO_PIPELINE_TOKEN",
		"TOKEN_ENCRYPTION_KEY",
	]) {
		const value = env[name];
		if (value?.trim()) {
			values.push(value.trim());
		}
	}
	return values;
}

interface FixtureNode {
	children?: FixtureNode[];
	id: string;
	name: string;
}

/** The fixture's elements: id to name. */
export function fixtureElements(): Map<string, string> {
	const file = JSON.parse(committedFixtureText("bluebird-demo-case.json")) as {
		tree: FixtureNode;
	};
	const found = new Map<string, string>();
	const visit = (node: FixtureNode) => {
		found.set(node.id, node.name);
		for (const child of node.children ?? []) {
			visit(child);
		}
	};
	visit(file.tree);
	return found;
}

/** How many evidence elements the fixture files hold between them. */
export function fixtureEvidenceCount(files: string[]): number {
	return files
		.flatMap((file) => elementsIn(committedFixtureText(file)))
		.filter((element) => element.elementType === "EVIDENCE").length;
}

/** The id of a fixture claim, found by its name. */
export function fixtureClaimId(name: string): string {
	for (const [id, elementName] of fixtureElements()) {
		if (elementName === name) {
			return id;
		}
	}
	throw new Error(`fixture has no element named ${name}`);
}

/**
 * Row count and a content hash for every table, so two snapshots are equal
 * only when no row anywhere was added, removed or changed.
 */
export async function snapshotDatabase(): Promise<Record<string, string>> {
	const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
		`SELECT table_name FROM information_schema.tables
		 WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
		 AND table_name <> '_prisma_migrations'
		 ORDER BY table_name`
	);
	const snapshot: Record<string, string> = {};
	for (const { table_name: table } of tables) {
		const rows = await prisma.$queryRawUnsafe<
			{ count: bigint; digest: string | null }[]
		>(
			`SELECT count(*) AS count,
			        md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) AS digest
			 FROM "${table}" t`
		);
		const row = rows[0];
		snapshot[table] = `${row?.count ?? 0}:${row?.digest ?? ""}`;
	}
	return snapshot;
}

/** Names of the tables the health plugin stores its data in. */
export async function healthTableNames(): Promise<string[]> {
	const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
		`SELECT table_name FROM information_schema.tables
		 WHERE table_schema = 'public' AND table_name LIKE 'plugin_health%'
		 ORDER BY table_name`
	);
	return tables.map((row) => row.table_name);
}

/** Total rows across the given tables. */
export async function countRows(tables: string[]): Promise<number> {
	let total = 0;
	for (const table of tables) {
		const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
			`SELECT count(*) AS count FROM "${table}"`
		);
		total += Number(rows[0]?.count ?? 0);
	}
	return total;
}
