import { spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

/**
 * The scheduled workflow is not run by CI, so its loop is exercised here with a
 * stand-in `curl` that plays back canned answers and records how it was called.
 */

const WORKFLOW = join(
	import.meta.dirname,
	"../../../.github/workflows/health-evidence-thinning.yml"
);
const SECRET = "workflow-test-secret";
const APP_URL = "https://app.example.test";
const ENDPOINT = `${APP_URL}/api/cron/health-evidence-thinning`;
// Azure ends a request after this many seconds.
const AZURE_REQUEST_LIMIT_SECONDS = 230;
const MAX_TIME = /--max-time\s+(\d+)/;

interface Workflow {
	concurrency?: { "cancel-in-progress"?: boolean; group?: string };
	jobs: Record<
		string,
		{
			"timeout-minutes"?: number;
			steps: Array<{ env?: Record<string, string>; run?: string }>;
		}
	>;
	on: {
		schedule?: Array<{ cron: string }>;
		workflow_dispatch?: {
			inputs?: Record<string, { default?: unknown; type?: string }>;
		};
	};
}

// The workflow script and the stand-in `curl` both call `jq`. GitHub's runners
// have it; the local-CI coverage container does not, so the suite skips there.
const jqAvailable = spawnSync("jq", ["--version"]).status === 0;

const workflow = parse(readFileSync(WORKFLOW, "utf8")) as Workflow;
const job = Object.values(workflow.jobs)[0];
const step = job?.steps.find((candidate) => candidate.run);
const script = step?.run ?? "";

let directory = "";

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), "thinning-workflow-"));
});

afterEach(() => {
	rmSync(directory, { recursive: true, force: true });
});

/** Runs the step's script the way a runner does, with `curl` answering from `answers`. */
function runScript(
	answers: Array<{ body: unknown; code: number } | "curl-fails">,
	dryRun = "false"
) {
	const queue = join(directory, "answers.jsonl");
	const calls = join(directory, "calls.log");
	writeFileSync(queue, `${answers.map((a) => JSON.stringify(a)).join("\n")}\n`);
	writeFileSync(calls, "");
	const fake = join(directory, "curl");
	writeFileSync(
		fake,
		`#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${calls}"
line=$(head -n1 "${queue}")
if [ -z "$line" ]; then
  line='{"body":{"success":true,"more":true,"busy":false},"code":200}'
else
  tail -n +2 "${queue}" > "${queue}.next" && mv "${queue}.next" "${queue}"
fi
if [ "$line" = '"curl-fails"' ]; then exit 28; fi
body=$(printf '%s' "$line" | jq -c '.body')
code=$(printf '%s' "$line" | jq -r '.code')
printf '%s\\n%s' "$body" "$code"
`
	);
	chmodSync(fake, 0o755);
	const result = spawnSync("bash", ["-e", "-c", script], {
		encoding: "utf8",
		env: {
			...process.env,
			PATH: `${directory}:${process.env.PATH}`,
			APP_URL,
			CRON_SECRET: SECRET,
			DRY_RUN: dryRun,
		},
	});
	const logged = readFileSync(calls, "utf8").split("\n").filter(Boolean);
	return { ...result, calls: logged };
}

const answer = (body: Record<string, unknown>, code = 200) => ({ body, code });
const MORE = answer({ success: true, busy: false, more: true });
const DONE = answer({ success: true, busy: false, more: false });
const BUSY = answer({ success: true, busy: true, more: false });

describe.skipIf(!jqAvailable)("the thinning workflow (needs jq)", () => {
	it("is scheduled daily and can be run by hand as a trial by default", () => {
		const cron = workflow.on.schedule?.[0]?.cron ?? "";
		expect(cron.split(" ")).toHaveLength(5);
		expect(cron.split(" ").slice(2)).toEqual(["*", "*", "*"]);
		const input = workflow.on.workflow_dispatch?.inputs?.dry_run;
		expect(input?.type).toBe("boolean");
		expect(input?.default).toBe(true);
	});

	it("allows one run at a time and never cancels one that is working", () => {
		expect(workflow.concurrency?.group).toBeTruthy();
		expect(workflow.concurrency?.["cancel-in-progress"]).toBe(false);
	});

	it("has a time limit on the job and on each request, the request under Azure's", () => {
		expect(job?.["timeout-minutes"]).toBeGreaterThan(0);
		const maxTime = MAX_TIME.exec(script);
		expect(maxTime).not.toBeNull();
		expect(Number(maxTime?.[1])).toBeLessThan(AZURE_REQUEST_LIMIT_SECONDS);
	});

	it("calls again while more is left, and stops when nothing is", () => {
		const run = runScript([MORE, MORE, DONE, MORE]);

		expect(run.status).toBe(0);
		expect(run.calls).toHaveLength(3);
		for (const call of run.calls) {
			expect(call).toContain("-X POST");
			expect(call).toContain(ENDPOINT);
			expect(call).not.toContain("dryRun");
			expect(call).toContain(`Authorization: Bearer ${SECRET}`);
			// The secret travels in the header, never in the address.
			const address = call.split(" ").find((part) => part.startsWith(APP_URL));
			expect(address).not.toContain(SECRET);
		}
	});

	it("does nothing more when another call holds the lock, and does not fail", () => {
		const run = runScript([BUSY, MORE, MORE]);

		expect(run.status).toBe(0);
		expect(run.calls).toHaveLength(1);
		expect(run.stdout).toContain("::warning::");
	});

	it("fails the run on a server error or a call that did not complete", () => {
		const refused = runScript([answer({ error: "Unauthorised" }, 401), DONE]);
		expect(refused.status).toBe(1);
		expect(refused.calls).toHaveLength(1);

		const broken = runScript([MORE, answer({ error: "x" }, 500), DONE]);
		expect(broken.status).toBe(1);
		expect(broken.calls).toHaveLength(2);

		const timedOut = runScript([MORE, "curl-fails", DONE]);
		expect(timedOut.status).toBe(1);
		expect(timedOut.calls).toHaveLength(2);
	});

	it("stops after a fixed number of calls when there is always more, without failing", () => {
		const run = runScript([]);

		expect(run.status).toBe(0);
		expect(run.calls.length).toBeGreaterThan(1);
		expect(run.calls.length).toBeLessThanOrEqual(50);
		expect(run.stdout).toContain("::warning::");
	});

	it("makes a single trial call for a trial run, whatever the answer says", () => {
		const run = runScript([MORE, MORE], "true");

		expect(run.status).toBe(0);
		expect(run.calls).toHaveLength(1);
		expect(run.calls[0]).toContain(`${ENDPOINT}?dryRun=1`);
	});
});
