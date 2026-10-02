import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { EvidenceHealthPanel } from "../evidence-health-panel";
import type { HygieneFigures } from "../use-hygiene";

const URL = "/api/cases/case-1/health/hygiene";

function figures(overrides: Partial<HygieneFigures> = {}): HygieneFigures {
	return {
		claims_without_time_limit: { count: 1, of: 4 },
		checks_without_time_limit: { count: 1, of: 2 },
		settings_as_recommended: { count: 3, of: 5 },
		...overrides,
	};
}

function renderPanel() {
	return render(<EvidenceHealthPanel canEdit caseId="case-1" />, {
		withProviders: false,
	});
}

describe("EvidenceHealthPanel", () => {
	it("shows the three figures as 'k of n' with their sentences", async () => {
		server.use(http.get(URL, () => HttpResponse.json(figures())));
		renderPanel();

		expect(
			await screen.findByText(
				"1 of 4 claims with a current result have no time limit on that result."
			)
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"A result with no time limit counts until someone withdraws it."
			)
		).toBeInTheDocument();
		expect(
			screen.getByText("1 of 2 checks in use have at least one such claim.")
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"3 of 5 accepted settings were accepted exactly as the pipeline recommended."
			)
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Settings accepted without a change deserve a second look: the numbers came from the pipeline."
			)
		).toBeInTheDocument();
	});

	it("says there is nothing to count when a figure has no population", async () => {
		server.use(
			http.get(URL, () =>
				HttpResponse.json(
					figures({
						claims_without_time_limit: { count: 0, of: 0 },
						checks_without_time_limit: { count: 0, of: 0 },
						settings_as_recommended: { count: 0, of: 0 },
					})
				)
			)
		);
		renderPanel();

		expect(
			await screen.findAllByText("No claims with a result yet.")
		).toHaveLength(2);
		expect(screen.getByText("No accepted settings yet.")).toBeInTheDocument();
		expect(screen.queryByText("0 of 0")).not.toBeInTheDocument();
	});

	it("shows an error state when the figures cannot be read", async () => {
		server.use(
			http.get(URL, () => HttpResponse.json({ error: "no" }, { status: 500 }))
		);
		renderPanel();

		expect(
			await screen.findByText("Evidence health unavailable")
		).toBeInTheDocument();
	});

	it("reads the figures again on Refresh", async () => {
		let current = figures();
		server.use(http.get(URL, () => HttpResponse.json(current)));
		const user = userEvent.setup();
		renderPanel();
		await screen.findByText(
			"1 of 2 checks in use have at least one such claim."
		);

		current = figures({ checks_without_time_limit: { count: 2, of: 2 } });
		await user.click(screen.getByRole("button", { name: "Refresh" }));

		expect(
			await screen.findByText(
				"2 of 2 checks in use have at least one such claim."
			)
		).toBeInTheDocument();
	});
});
