import { describe, expect, it } from "vitest";
import { evidenceNodeText } from "@/lib/health-evidence-node-text";

describe("evidenceNodeText", () => {
	it("names the check and the pipeline, and says what the check measures", () => {
		expect(
			evidenceNodeText(
				{ name: "Surface Finish Check", description: "Counts visible marks" },
				"Inspection pipeline (demo)"
			)
		).toBe(
			"Results from the Surface Finish Check check, run by Inspection pipeline (demo). It measures: Counts visible marks."
		);
	});

	it("leaves out the second sentence when the check has no description", () => {
		const opening =
			"Results from the Surface Finish Check check, run by Inspection pipeline (demo).";

		for (const description of [undefined, "", "   "]) {
			expect(
				evidenceNodeText(
					{ name: "Surface Finish Check", description },
					"Inspection pipeline (demo)"
				)
			).toBe(opening);
		}
	});

	it("does not add a full stop to a description that already ends its sentence", () => {
		for (const ending of [".", "?", "!"]) {
			expect(
				evidenceNodeText(
					{ name: "Check", description: ` Is it clean${ending} ` },
					"Pipeline"
				)
			).toBe(
				`Results from the Check check, run by Pipeline. It measures: Is it clean${ending}`
			);
		}
	});
});
