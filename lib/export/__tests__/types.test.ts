import { describe, expect, it } from "vitest";
import type { PlainTreeNode } from "@/lib/case/defined-terms";
import type { ElementType } from "@/lib/schemas/case-export";
import {
	exportCase,
	exportNode,
	sectionOf,
} from "@/src/__tests__/utils/export-case-kit";
import { createTemplateFromPreset } from "../templates";

const LABELS: [ElementType, string][] = [
	["GOAL", "Goal"],
	["CONTEXT", "Context"],
	["STRATEGY", "Strategy"],
	["PROPERTY_CLAIM", "Property Claim"],
	["EVIDENCE", "Evidence"],
	["JUSTIFICATION", "Justification"],
	["ASSUMPTION", "Assumption"],
	["MODULE", "Module"],
	["AWAY_GOAL", "Away Goal"],
	["CONTRACT", "Contract"],
];

function commented(id: string, type: ElementType): PlainTreeNode {
	return exportNode({
		id,
		type,
		comments: [
			{ author: "ann", content: "noted", createdAt: "2024-01-02T12:00:00Z" },
		],
	});
}

describe("element type labels", () => {
	it("names every element type in words in the document's headings", async () => {
		const root = {
			...commented("root", "GOAL"),
			children: LABELS.slice(1).map(([type]) => commented(type, type)),
		};
		const document = await createTemplateFromPreset("full-report").render({
			caseData: exportCase(root),
		});

		const titles = sectionOf(document, "comments").blocks.flatMap((b) =>
			b.type === "heading" && b.level === 3 ? [b.text] : []
		);

		expect(titles).toStrictEqual(
			LABELS.map(([, label]) => `Comments on ${label}`)
		);
	});
});
