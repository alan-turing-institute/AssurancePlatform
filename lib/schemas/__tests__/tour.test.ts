import { describe, expect, it } from "vitest";
import { issuesOf, outputOf } from "@/src/__tests__/utils/schema-issues-kit";
import { KNOWN_TOUR_IDS, tourCompletionSchema } from "../tour";

describe("tourCompletionSchema", () => {
	it.each(KNOWN_TOUR_IDS)("accepts the tour %s", (tourId) => {
		expect(outputOf(tourCompletionSchema, { tourId })).toEqual({ tourId });
	});

	it("names the tours that exist when given one that does not", () => {
		expect(issuesOf(tourCompletionSchema, { tourId: "nope" })).toEqual([
			`tourId: Invalid tour ID. Expected one of: ${KNOWN_TOUR_IDS.join(", ")}`,
		]);
	});
});
