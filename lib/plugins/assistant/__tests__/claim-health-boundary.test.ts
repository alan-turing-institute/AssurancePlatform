import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const ASSISTANT_DIR = path.join(ROOT, "lib/plugins/assistant");
const ASSISTANT_ROUTE = path.join(
	ROOT,
	"app/api/cases/[id]/assistant/route.ts"
);

const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;
const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const HEALTH_TABLE_NAME = /pluginHealth|PluginHealth|plugin_health/;
const PRISMA_CLIENT_USE = /\bprisma\b/i;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /^\s*\/\/.*$/gm;

function assistantSources(directory: string): string[] {
	return readdirSync(directory).flatMap((entry) => {
		const full = path.join(directory, entry);
		if (statSync(full).isDirectory()) {
			return entry === "__tests__" ? [] : assistantSources(full);
		}
		return SOURCE_FILE.test(entry) && !TEST_FILE.test(entry) ? [full] : [];
	});
}

const SOURCES = [...assistantSources(ASSISTANT_DIR), ASSISTANT_ROUTE];

/** The file's code, without comments. */
function codeOf(file: string): string {
	return readFileSync(file, "utf8")
		.replace(BLOCK_COMMENT, "")
		.replace(LINE_COMMENT, "");
}

function specifiersOf(file: string): string[] {
	return [...codeOf(file).matchAll(IMPORT_SPECIFIER)].map(
		(match) => match[1] ?? ""
	);
}

function resolved(file: string, specifier: string): string {
	if (specifier.startsWith("@/")) {
		return path.join(ROOT, specifier.slice(2));
	}
	return specifier.startsWith(".")
		? path.resolve(path.dirname(file), specifier)
		: specifier;
}

describe("the assistant's use of the health plugin", () => {
	it("finds the assistant sources it is checking", () => {
		const names = SOURCES.map((file) => path.basename(file));

		expect(names).toContain("tools.ts");
		expect(names).toContain("claim-health-tool.ts");
		expect(names).toContain("route.ts");
	});

	it("imports nothing from the health plugin's own code", () => {
		const healthDir = path.join(ROOT, "lib/plugins/health");
		const offenders = SOURCES.flatMap((file) =>
			specifiersOf(file)
				.filter((specifier) => {
					const target = resolved(file, specifier);
					return (
						target === healthDir || target.startsWith(`${healthDir}${path.sep}`)
					);
				})
				.map((specifier) => `${path.relative(ROOT, file)} imports ${specifier}`)
		);

		expect(offenders).toEqual([]);
	});

	it("never names a health table or model", () => {
		const offenders = SOURCES.filter((file) =>
			HEALTH_TABLE_NAME.test(codeOf(file))
		).map((file) => path.relative(ROOT, file));

		expect(offenders).toEqual([]);
	});

	it("does not query the database itself", () => {
		const offenders = SOURCES.filter((file) =>
			PRISMA_CLIENT_USE.test(codeOf(file))
		).map((file) => path.relative(ROOT, file));

		expect(offenders).toEqual([]);
	});

	it("reaches the health status only through the health status service", () => {
		const reaches = SOURCES.flatMap((file) =>
			specifiersOf(file)
				.filter((specifier) => specifier.includes("health"))
				.map((specifier) => path.basename(resolved(file, specifier)))
		);

		for (const name of reaches) {
			expect([
				"claim-health-availability",
				"claim-health-tool",
				"health-claim-access",
				"health-status-service",
			]).toContain(name);
		}
	});
});
