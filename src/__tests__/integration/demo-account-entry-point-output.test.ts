import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { basename } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEMO_CASE_ID,
	DEMO_FIXTURES,
	type DemoFixture,
} from "../../../prisma/seed/demo-account-seed";
import {
	allSecretValues,
	findLeak,
	makeSecrets,
	runDemoEntryPoint,
	snapshotDatabase,
	validEnv,
} from "../utils/demo-account-kit";
import {
	committedFixturePath,
	makeTempDir,
	writeShowcase,
	writeText,
} from "../utils/demo-fixture-files";

/**
 * What the demo-account entry point prints. The seed reads its case list
 * from `DEMO_FIXTURES`, so the module is wrapped to hand it another list
 * where a test needs one; the entry point's own code runs unchanged.
 */

const state = vi.hoisted(() => ({
	fixtures: undefined as
		| readonly { caseId: string; file: string }[]
		| undefined,
}));

vi.mock("../../../prisma/seed/demo-account-seed", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("../../../prisma/seed/demo-account-seed")
		>();
	return {
		...actual,
		seedDemoAccount: (values: Parameters<typeof actual.seedDemoAccount>[0]) =>
			actual.seedDemoAccount(values, state.fixtures),
	};
});

const SECRETS = makeSecrets();
const CANARY = "Zr4mT9wE-not-for-output";
/** The start of the note; a parser error quotes only a few characters of the text it rejects. */
const CANARY_START = CANARY.slice(0, 8);

let dir = "";

beforeEach(() => {
	dir = makeTempDir();
	vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
	vi.stubEnv("DEMO_ACCOUNT_PASSWORD", SECRETS.password);
	vi.stubEnv("DEMO_OPENROUTER_API_KEY", SECRETS.openRouterKey);
	vi.stubEnv("DEMO_PIPELINE_TOKEN", SECRETS.pipelineToken);
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	state.fixtures = undefined;
});

const bluebird = (): DemoFixture => ({
	file: committedFixturePath("bluebird-demo-case.json"),
	caseId: DEMO_CASE_ID,
});

/** The lines the entry point prints for the account, without the application's JSON log lines. */
function printedLines(stdout: string): string[] {
	return stdout.split("\n").filter((line) => line && !line.startsWith("{"));
}

interface EntryRun {
	code: number;
	errors: string;
	lines: string[];
}

/** Runs the entry point's code once in this process with `fixtures` as the case list. */
async function runEntryPoint(
	fixtures?: readonly DemoFixture[]
): Promise<EntryRun> {
	state.fixtures = fixtures;
	vi.resetModules();
	const out: string[] = [];
	const err: string[] = [];
	vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => {
		out.push(parts.join(" "));
	});
	vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => {
		err.push(parts.join(" "));
	});
	const exited = new Promise<number>((done) => {
		vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
			done(code ?? 0);
		}) as never);
	});
	await import("../../../prisma/seed/demo-account");
	const code = await exited;
	vi.restoreAllMocks();
	return {
		code,
		errors: err.join("\n"),
		lines: out.join("\n").split("\n").filter(Boolean),
	};
}

describe("the demo-account entry point's output", () => {
	it("prints the Bluebird line, then one line for each further case in list order", async () => {
		const first = writeShowcase(dir, "first");
		const second = writeShowcase(dir, "second");

		const run = await runEntryPoint([bluebird(), first, second]);

		expect(run.code).toBe(0);
		expect(run.errors).toBe("");
		expect(run.lines).toHaveLength(3);
		expect(run.lines[0]).toBe(`demo account ready: case id=${DEMO_CASE_ID}`);
		expect(run.lines[1]).toContain(first.caseId);
		expect(run.lines[2]).toContain(second.caseId);
		expect(run.lines.join("\n")).not.toContain(CANARY_START);
		expect(findLeak(run.lines.join("\n"), Object.values(SECRETS))).toBeNull();
	}, 60_000);

	it("prints no case line on a second run and changes nothing", async () => {
		const list = [bluebird(), writeShowcase(dir, "first")];
		const first = await runEntryPoint(list);
		expect(first.lines).toHaveLength(2);
		const before = await snapshotDatabase();

		const second = await runEntryPoint(list);

		expect(second.code).toBe(0);
		expect(second.errors).toBe("");
		const printed = second.lines.join("\n");
		expect(printed).not.toContain("demo account ready");
		for (const { caseId } of list) {
			expect(printed).not.toContain(caseId);
		}
		expect(await snapshotDatabase()).toEqual(before);
	}, 90_000);

	it("exits non-zero naming a broken file and printing neither its contents nor a secret", async () => {
		const broken: DemoFixture = {
			file: writeText(dir, "garbled.json", `${CANARY} is not JSON`),
			caseId: randomUUID(),
		};

		const run = await runEntryPoint([bluebird(), broken]);

		expect(run.code).not.toBe(0);
		expect(run.errors).toContain(basename(broken.file));
		expect(run.errors).not.toContain(CANARY_START);
		expect(findLeak(run.errors, Object.values(SECRETS))).toBeNull();
		expect(run.lines.join("\n")).not.toContain("demo account ready");
	}, 60_000);
});

describe("the demo-account entry point run as its own process", () => {
	it("prints the Bluebird line and one line per further listed case, and nothing of the kind on a second run", async () => {
		const env = validEnv(SECRETS);
		const further = DEMO_FIXTURES.filter(
			(fixture) => fixture.caseId !== DEMO_CASE_ID
		);

		const first = await runDemoEntryPoint(env);

		expect(first.code).toBe(0);
		const lines = printedLines(first.stdout);
		expect(lines).toHaveLength(1 + further.length);
		expect(lines[0]).toBe(`demo account ready: case id=${DEMO_CASE_ID}`);
		for (const [index, fixture] of further.entries()) {
			expect(lines[index + 1]).toContain(fixture.caseId);
		}
		expect(findLeak(first.output, allSecretValues(env))).toBeNull();

		const before = await snapshotDatabase();
		const second = await runDemoEntryPoint(env);

		expect(second.code).toBe(0);
		expect(second.stdout).not.toContain("demo account ready");
		for (const { caseId } of DEMO_FIXTURES) {
			expect(second.output).not.toContain(caseId);
		}
		expect(await snapshotDatabase()).toEqual(before);
	}, 180_000);
});
