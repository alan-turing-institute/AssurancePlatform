import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	AdvisoryCheckError,
	type BaselineEntry,
	evaluate,
	parseAuditOutput,
	parseBaseline,
	run,
} from "../check-advisories";

const TODAY = "2026-11-15";

function entry(overrides: Partial<BaselineEntry> = {}): BaselineEntry {
	return {
		ghsa: "GHSA-aaaa-aaaa-aaaa",
		package: "left-pad",
		severity: "high",
		scope: "dev",
		reason: "development-only copy",
		owner: "maintainers",
		expires: "2027-01-31",
		...overrides,
	};
}

function auditJson(
	list: { ghsa: string; severity: string; name?: string }[]
): string {
	const advisories: Record<string, unknown> = {};
	list.forEach((item, index) => {
		advisories[String(index)] = {
			github_advisory_id: item.ghsa,
			severity: item.severity,
			module_name: item.name ?? "left-pad",
		};
	});
	return JSON.stringify({ advisories });
}

describe("check-advisories", () => {
	it("fails on a new high advisory that is not in the baseline", () => {
		const advisories = parseAuditOutput(
			auditJson([{ ghsa: "GHSA-new1-new1-new1", severity: "high" }])
		);
		const { failures } = evaluate(advisories, [], [], TODAY);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toContain("GHSA-new1-new1-new1");
	});

	it("passes a high advisory that the baseline approves", () => {
		const advisories = parseAuditOutput(
			auditJson([{ ghsa: "GHSA-aaaa-aaaa-aaaa", severity: "high" }])
		);
		expect(evaluate(advisories, [], [entry()], TODAY).failures).toEqual([]);
	});

	it("fails when the baseline entry has expired", () => {
		const advisories = parseAuditOutput(
			auditJson([{ ghsa: "GHSA-aaaa-aaaa-aaaa", severity: "high" }])
		);
		const { failures } = evaluate(
			advisories,
			[],
			[entry({ expires: "2026-11-14" })],
			TODAY
		);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toContain("expired");
	});

	it("passes a moderate advisory that is not in the baseline", () => {
		const advisories = parseAuditOutput(
			auditJson([{ ghsa: "GHSA-mod1-mod1-mod1", severity: "moderate" }])
		);
		expect(advisories).toEqual([]);
		expect(evaluate(advisories, [], [], TODAY).failures).toEqual([]);
	});

	it("fails closed on empty or malformed output", () => {
		expect(() => parseAuditOutput("")).toThrow(AdvisoryCheckError);
		expect(() => parseAuditOutput("not json")).toThrow(AdvisoryCheckError);
		expect(() => parseAuditOutput("{}")).toThrow(AdvisoryCheckError);
		expect(() => parseAuditOutput('{"advisories":[1]}')).toThrow(
			"no advisories object"
		);
	});

	it("rejects a malformed advisory entry and an entry without an id, severity or package", () => {
		expect(() => parseAuditOutput('{"advisories":{"1":1}}')).toThrow(
			"malformed entry"
		);
		expect(() =>
			parseAuditOutput(
				'{"advisories":{"1":{"severity":"high","module_name":"left-pad"}}}'
			)
		).toThrow("without an id, severity or package");
	});

	it("fails when a development-only entry meets the same advisory in production", () => {
		const reported = parseAuditOutput(
			auditJson([{ ghsa: "GHSA-aaaa-aaaa-aaaa", severity: "high" }])
		);
		const { failures } = evaluate(reported, reported, [entry()], TODAY);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toContain("production audit");
	});

	it("passes a production advisory that has a production entry", () => {
		const reported = parseAuditOutput(
			auditJson([{ ghsa: "GHSA-aaaa-aaaa-aaaa", severity: "high" }])
		);
		const { failures } = evaluate(
			reported,
			reported,
			[entry({ scope: "prod" })],
			TODAY
		);
		expect(failures).toEqual([]);
	});

	it("fails when the reported severity is above the baselined one", () => {
		const reported = parseAuditOutput(
			auditJson([{ ghsa: "GHSA-aaaa-aaaa-aaaa", severity: "critical" }])
		);
		const { failures } = evaluate(reported, [], [entry()], TODAY);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toContain("re-accepted");
	});

	it("warns, without failing, on a baseline entry the audit no longer reports", () => {
		const { failures, warnings } = evaluate([], [], [entry()], TODAY);
		expect(failures).toEqual([]);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("GHSA-aaaa-aaaa-aaaa");
	});
});

describe("the baseline file", () => {
	it("accepts a complete entry and rejects a missing reason, a bad scope or a bad date", () => {
		expect(parseBaseline(JSON.stringify([entry()]))).toHaveLength(1);
		expect(() =>
			parseBaseline(JSON.stringify([entry({ reason: " " })]))
		).toThrow(AdvisoryCheckError);
		expect(() =>
			parseBaseline(JSON.stringify([{ ...entry(), scope: "both" }]))
		).toThrow(AdvisoryCheckError);
		expect(() =>
			parseBaseline(JSON.stringify([entry({ expires: "next year" })]))
		).toThrow(AdvisoryCheckError);
		expect(() => parseBaseline("{}")).toThrow(AdvisoryCheckError);
		expect(() => parseBaseline("[1]")).toThrow(AdvisoryCheckError);
		expect(() => parseBaseline("nope")).toThrow(AdvisoryCheckError);
	});
});

describe("running the check", () => {
	const dirs: string[] = [];
	afterEach(() => {
		vi.restoreAllMocks();
		for (const dir of dirs.splice(0)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	function baselineFile(entries: BaselineEntry[]): string {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "advisories-"));
		dirs.push(dir);
		const file = path.join(dir, "baseline.json");
		fs.writeFileSync(file, JSON.stringify(entries));
		return file;
	}

	it("exits 0 for a baselined advisory and 1 for an unlisted one", () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const file = baselineFile([entry()]);
		const known = (productionOnly: boolean) =>
			productionOnly
				? auditJson([])
				: auditJson([{ ghsa: "GHSA-aaaa-aaaa-aaaa", severity: "high" }]);
		const unknown = () =>
			auditJson([{ ghsa: "GHSA-zzzz-zzzz-zzzz", severity: "critical" }]);
		expect(run(["--baseline", file], known, TODAY)).toBe(0);
		expect(run(["--baseline", file], unknown, TODAY)).toBe(1);
	});

	it("exits 1 when the audit output is unusable or the baseline path is missing", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const file = baselineFile([]);
		expect(run(["--baseline", file], () => "", TODAY)).toBe(1);
		expect(run(["--baseline"], () => auditJson([]), TODAY)).toBe(1);
	});

	it("warns about a stale baseline entry and still exits 0", () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const file = baselineFile([entry()]);
		expect(run(["--baseline", file], () => auditJson([]), TODAY)).toBe(0);
		expect(warn).toHaveBeenCalledTimes(1);
	});
});
