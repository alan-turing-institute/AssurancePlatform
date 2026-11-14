import { describe, expect, it } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { JobStatus } from "../job-status";

describe("JobStatus: the similarity of a failed check", () => {
	it.each([
		[0.999, "0.999"],
		[0.998_999_9, "0.998"],
		[1, "1.000"],
		[0.5, "0.500"],
	])("shows %s as %s, cut rather than rounded", (lowestCosine, shown) => {
		renderWithoutProviders(
			<JobStatus
				job="search"
				model="embed-m"
				search={{ kind: "failed", reason: "similarity", lowestCosine }}
			/>
		);

		expect(
			screen.getByText(`Lowest similarity ${shown}.`, { exact: false })
		).toBeInTheDocument();
	});
});
