import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fairRecruitmentStages } from "@/content/curriculum/tea-trainee/01-first-sip/stages";
import { ELEMENT_GUIDE } from "@/lib/help/help-guide";
import { CaseExportNestedSchema } from "@/lib/schemas/case-export";
import { caseExportToAssuranceCase } from "../case-export-to-assurance-case";

const ROOT = path.resolve(__dirname, "../../..");
const DIR = path.join(ROOT, "public/data/curriculum/first-sip");

interface RawNode {
	assumption?: string;
	children?: RawNode[];
	justification?: string;
	name?: string;
}

const files = readdirSync(DIR)
	.filter((f) => f.endsWith(".json"))
	.sort();
const load = (file: string) =>
	JSON.parse(readFileSync(path.join(DIR, file), "utf8"));

const collect = (node: RawNode, out: RawNode[] = []): RawNode[] => {
	out.push(node);
	for (const child of node.children ?? []) {
		collect(child, out);
	}
	return out;
};

const stageFile = (caseFile: string) => path.basename(caseFile);

describe("first-sip stage files (adversarial)", () => {
	it.each(files)("%s converts to an assurance case", (file) => {
		expect(() => caseExportToAssuranceCase(load(file))).not.toThrow();
	});

	it.each(
		files
	)("%s parses with the nested export schema apart from id format", (file) => {
		// Several stage files carry non-UUID ids that predate this change.
		const result = CaseExportNestedSchema.safeParse(load(file));
		const other = result.success
			? []
			: result.error.issues.filter((i) => i.message !== "Invalid UUID");
		expect(other).toEqual([]);
	});

	it.each(
		files
	)("%s carries the assumption and justification from stage 4", (file) => {
		const stageNumber = Number(file.match(/stage-(\d)/)?.[1]);
		const nodes = collect(load(file).tree);
		const p1 = nodes.find((n) => n.name === "P1");
		const p2 = nodes.find((n) => n.name === "P2");
		const has = (v?: string) => (v ?? "").trim().length > 0;
		if (stageNumber >= 4) {
			expect(has(p1?.assumption)).toBe(true);
			expect(has(p2?.justification)).toBe(true);
		} else {
			expect(has(p1?.assumption)).toBe(false);
			expect(has(p2?.justification)).toBe(false);
		}
	});

	it("only prompts for elements that exist in that stage's file", () => {
		for (const stage of fairRecruitmentStages) {
			const names = new Set(
				collect(load(stageFile(stage.caseFile)).tree).map((n) => n.name)
			);
			for (const prompt of stage.prompts ?? []) {
				for (const name of prompt.select) {
					expect(names.has(name), `${stage.id}:${name}`).toBe(true);
				}
			}
		}
	});

	it("keeps exclamation marks and 'click on' out of guidance and prompts", () => {
		for (const stage of fairRecruitmentStages) {
			const texts = [
				stage.guidance,
				...(stage.prompts ?? []).map((p) => p.text),
			];
			for (const text of texts) {
				expect(text).not.toContain("!");
				expect(text.toLowerCase()).not.toContain("click on");
			}
		}
	});
});

describe("element guide links (adversarial)", () => {
	it("points every docsHref at a heading on the element types page", () => {
		const mdx = readFileSync(
			path.join(ROOT, "content/platform-guide/reference/02-element-types.mdx"),
			"utf8"
		);
		const slugs = new Set(
			mdx
				.split("\n")
				.filter((l) => l.startsWith("### "))
				.map((l) => l.slice(4).trim().toLowerCase().replace(/\s+/g, "-"))
		);
		for (const entry of ELEMENT_GUIDE) {
			if (!entry.docsHref?.includes("#")) {
				continue;
			}
			const fragment = entry.docsHref.split("#")[1];
			expect(slugs.has(fragment), `${entry.id} -> #${fragment}`).toBe(true);
		}
	});
});
