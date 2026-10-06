import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Concept } from "@/types/curriculum";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const TRAINEE = path.join(ROOT, "content/curriculum/tea-trainee");

const conceptTypes = [
	"goal",
	"strategy",
	"property_claim",
	"evidence",
	"context",
	"assumption",
	"justification",
	"general",
];

const conceptModules = import.meta.glob<Record<string, unknown>>(
	"../../../../content/curriculum/tea-trainee/*/concepts.ts",
	{ eager: true }
);

const allConcepts = Object.entries(conceptModules).flatMap(([file, mod]) =>
	Object.values(mod)
		.filter(Array.isArray)
		.flatMap((list) => (list as Concept[]).map((c) => ({ file, c })))
);

const reflections = readdirSync(TRAINEE)
	.map((d) => path.join(TRAINEE, d, "reflection.mdx"))
	.filter((f) => existsSync(f));

describe("curriculum concept content", () => {
	it("finds concepts in every module", () => {
		expect(Object.keys(conceptModules)).toHaveLength(4);
		expect(allConcepts.length).toBeGreaterThan(10);
	});

	it("uses only known concept types", () => {
		for (const { file, c } of allConcepts) {
			expect(conceptTypes, `${file} ${c.id}`).toContain(c.type);
		}
	});

	it("types attribute concepts by their id", () => {
		const expected: Record<string, string> = {
			"concept-context": "context",
			"concept-justification": "justification",
			"concept-assumption": "assumption",
		};
		for (const { file, c } of allConcepts) {
			if (c.id in expected) {
				expect(c.type, `${file} ${c.id}`).toBe(expected[c.id]);
			}
		}
	});
});

describe("reflection pages", () => {
	it("covers all four modules", () => {
		expect(reflections).toHaveLength(4);
	});

	it("import ConceptCards and never mention the carousel", () => {
		for (const f of reflections) {
			const src = readFileSync(f, "utf8");
			expect(src, f).toMatch(
				/import ConceptCards from "@\/components\/docs\/curriculum\/concept-cards"/
			);
			expect(src, f).not.toMatch(/ConceptCarousel/i);
		}
	});

	it("keep the prose free of carousel instructions and exclamation marks", () => {
		for (const f of reflections) {
			const prose = readFileSync(f, "utf8")
				.replace(/^---[\s\S]*?---/, "")
				.replace(/^(import|export) .*$/gm, "")
				.replace(/\{[^{}]*\}/g, "")
				.replace(/<[^>]*>/g, "");
			expect(prose, f).not.toContain("Click through each card");
			expect(prose, f).not.toContain("!");
		}
	});
});

const removedFiles = [
	"components/docs/curriculum/concept-carousel.tsx",
	"components/docs/curriculum/index.ts",
	"lib/docs/elk-layout.ts",
	"lib/docs/case-data-transformer.ts",
	"public/images/001-01-figure1.svg",
	"public/images/001-01-figure2.svg",
	"public/images/001-01-figure3.svg",
	"public/images/001-01-figure4.svg",
	"public/images/001-01-figure5.svg",
	"public/images/context-example1.svg",
	"public/images/context-example2.svg",
	"public/images/goal-element.svg",
];

const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		if (name === "node_modules" || name === ".next") {
			return [];
		}
		const p = path.join(dir, name);
		return statSync(p).isDirectory() ? walk(p) : [p];
	});

describe("removed files", () => {
	it("no longer exist", () => {
		for (const f of removedFiles) {
			expect(existsSync(path.join(ROOT, f)), f).toBe(false);
		}
	});

	it("are not referenced from app, components, content, lib or types", () => {
		const needles = [
			"concept-" + "carousel",
			"ConceptCa" + "rousel",
			"elk-" + "layout",
			"case-data-" + "transformer",
			"@/components/docs/curriculum\"",
			"@/components/docs/curriculum'",
			"@/components/docs/curriculum/index",
			...removedFiles
				.filter((f) => f.endsWith(".svg"))
				.map((f) => path.basename(f)),
		];
		const self = path.basename(import.meta.filename);
		const hits: string[] = [];
		for (const dir of ["app", "components", "content", "lib", "types"]) {
			for (const f of walk(path.join(ROOT, dir))) {
				if (!/\.(tsx?|mdx?|json|jsx?)$/.test(f) || f.endsWith(self)) {
					continue;
				}
				const src = readFileSync(f, "utf8");
				for (const n of needles) {
					if (src.includes(n)) {
						hits.push(`${f}: ${n}`);
					}
				}
			}
		}
		expect(hits).toEqual([]);
	});
});
