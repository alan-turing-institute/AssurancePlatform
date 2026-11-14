import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

/**
 * The reseed workflow's step that rebuilds the shared demo account: it must
 * hand the seed exactly the values it reads, from the right secrets, run
 * after the database is reset and seeded, fail the run when the seed fails,
 * and keep the account's secrets out of every other step.
 */

const WORKFLOW_FILE = join(
	import.meta.dirname,
	"../../../.github/workflows/seed-staging.yml"
);
const STEP_NAME = "Seed the shared demo account";

interface Step {
	"continue-on-error"?: unknown;
	env?: Record<string, string>;
	if?: unknown;
	name?: string;
	run?: string;
}

const text = readFileSync(WORKFLOW_FILE, "utf8");
const workflow = parse(text) as { jobs: Record<string, { steps: Step[] }> };
const steps = Object.values(workflow.jobs).flatMap((job) => job.steps);
const demoStep = steps.find((step) => step.name === STEP_NAME);

/** The expression that reads a repository secret in a workflow. */
const fromSecret = (name: string) => `$\{{ secrets.${name} }}`;

const EXPECTED_ENV = {
	DATABASE_URL: fromSecret("STAGING_DATABASE_URL"),
	DEMO_ACCOUNT_PASSWORD: fromSecret("DEMO_ACCOUNT_PASSWORD"),
	DEMO_OPENROUTER_API_KEY: fromSecret("DEMO_OPENROUTER_API_KEY"),
	DEMO_PIPELINE_TOKEN: fromSecret("DEMO_PIPELINE_TOKEN"),
	TOKEN_ENCRYPTION_KEY: fromSecret("STAGING_TOKEN_ENCRYPTION_KEY"),
};

const ACCOUNT_SECRETS = [
	"DEMO_ACCOUNT_PASSWORD",
	"DEMO_OPENROUTER_API_KEY",
	"DEMO_PIPELINE_TOKEN",
	"STAGING_TOKEN_ENCRYPTION_KEY",
];

const SHELL_TRICKS = ["|", "tee", "||", ";", "&&", "echo", "set -x", ">"];

describe("the demo account step in the staging reseed workflow", () => {
	it("exists once", () => {
		expect(steps.filter((step) => step.name === STEP_NAME)).toHaveLength(1);
	});

	it("runs the entry point and nothing else, so a failure fails the run", () => {
		const command = demoStep?.run?.trim() ?? "";

		expect(command).toBe("npx tsx prisma/seed/demo-account.ts");
		for (const trick of SHELL_TRICKS) {
			expect(command).not.toContain(trick);
		}
		expect(demoStep).not.toHaveProperty("continue-on-error");
		expect(demoStep).not.toHaveProperty("if");
	});

	it("passes exactly the five values the seed reads, each from its own secret", () => {
		expect(demoStep?.env).toEqual(EXPECTED_ENV);
	});

	it("comes after the reset and after the development seed and its check", () => {
		const names = steps.map((step) => step.name);
		const at = names.indexOf(STEP_NAME);

		expect(at).toBeGreaterThan(names.indexOf("Reset and migrate database"));
		expect(at).toBeGreaterThan(names.indexOf("Run seed script"));
		expect(at).toBeGreaterThan(
			names.indexOf("Verify expected seed content ran")
		);
		expect(names.indexOf("Reset and migrate database")).toBeGreaterThan(-1);
	});

	it("is the only place the account's secrets appear", () => {
		const others = steps.filter((step) => step.name !== STEP_NAME);
		const elsewhere = JSON.stringify(others);

		for (const secret of ACCOUNT_SECRETS) {
			expect(elsewhere).not.toContain(secret);
		}
		const mentions = (name: string) => text.split(name).length - 1;
		expect(mentions("secrets.DEMO_ACCOUNT_PASSWORD")).toBe(1);
		expect(mentions("secrets.DEMO_OPENROUTER_API_KEY")).toBe(1);
		expect(mentions("secrets.DEMO_PIPELINE_TOKEN")).toBe(1);
		expect(mentions("secrets.STAGING_TOKEN_ENCRYPTION_KEY")).toBe(1);
	});
});
