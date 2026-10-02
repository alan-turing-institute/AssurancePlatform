import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	FakeEventSource,
	installFakeEventSource,
} from "@/src/__tests__/utils/health-criteria-harness";
import { render, screen, within } from "@/src/__tests__/utils/test-utils";
import { EvidenceHealthPanel } from "../evidence-health-panel";

const HYGIENE_URL = "/api/cases/case-9/health/hygiene";

interface Figures {
	checks_without_time_limit: { count: number; of: number };
	claims_without_time_limit: { count: number; of: number };
	settings_as_recommended: { count: number; of: number };
}

const FIGURES: Figures = {
	claims_without_time_limit: { count: 3, of: 12 },
	checks_without_time_limit: { count: 2, of: 5 },
	settings_as_recommended: { count: 7, of: 9 },
};

let reads = 0;

function serveFigures(...answers: (Figures | number)[]) {
	reads = 0;
	server.use(
		http.get(HYGIENE_URL, () => {
			const answer = answers[Math.min(reads, answers.length - 1)];
			reads += 1;
			return typeof answer === "number"
				? HttpResponse.json({ error: "no" }, { status: answer })
				: HttpResponse.json(answer);
		})
	);
}

function renderPanel(canEdit = true) {
	return render(<EvidenceHealthPanel canEdit={canEdit} caseId="case-9" />, {
		withProviders: false,
	});
}

beforeEach(() => {
	installFakeEventSource();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("the Evidence health panel", () => {
	it("words each figure as k of n with its sentence and its note", async () => {
		serveFigures(FIGURES);
		renderPanel();
		const claims = await screen.findByTestId("hygiene-claims");
		expect(claims).toHaveTextContent("3 of 12");
		expect(claims).toHaveTextContent(
			"3 of 12 claims with a current result have no time limit on that result."
		);
		expect(claims).toHaveTextContent(
			"A result with no time limit counts until someone withdraws it."
		);
		const checks = screen.getByTestId("hygiene-checks");
		expect(checks).toHaveTextContent("2 of 5");
		expect(checks).toHaveTextContent(
			"2 of 5 checks in use have at least one such claim."
		);
		const settings = screen.getByTestId("hygiene-settings");
		expect(settings).toHaveTextContent("7 of 9");
		expect(settings).toHaveTextContent(
			"7 of 9 accepted settings were accepted exactly as the pipeline recommended."
		);
		expect(settings).toHaveTextContent(
			"Settings accepted without a change deserve a second look: the numbers came from the pipeline."
		);
	});

	it("keeps each figure's own numbers, so a swapped field would show", async () => {
		serveFigures({
			claims_without_time_limit: { count: 1, of: 2 },
			checks_without_time_limit: { count: 3, of: 4 },
			settings_as_recommended: { count: 5, of: 6 },
		});
		renderPanel();
		expect(await screen.findByTestId("hygiene-claims")).toHaveTextContent(
			"1 of 2 claims"
		);
		expect(screen.getByTestId("hygiene-checks")).toHaveTextContent(
			"3 of 4 checks"
		);
		expect(screen.getByTestId("hygiene-settings")).toHaveTextContent(
			"5 of 6 accepted settings"
		);
	});

	it("shows zero counts of a non-zero total as ordinary figures", async () => {
		serveFigures({
			claims_without_time_limit: { count: 0, of: 4 },
			checks_without_time_limit: { count: 0, of: 2 },
			settings_as_recommended: { count: 0, of: 3 },
		});
		renderPanel();
		expect(await screen.findByTestId("hygiene-claims")).toHaveTextContent(
			"0 of 4 claims with a current result have no time limit on that result."
		);
	});

	it("says no claims have a result yet for the first two figures and no accepted settings for the third, when each total is zero", async () => {
		serveFigures({
			claims_without_time_limit: { count: 0, of: 0 },
			checks_without_time_limit: { count: 0, of: 0 },
			settings_as_recommended: { count: 0, of: 0 },
		});
		renderPanel();
		const claims = await screen.findByTestId("hygiene-claims");
		expect(claims).toHaveTextContent("No claims with a result yet.");
		expect(claims.textContent).not.toContain("0 of 0");
		expect(claims.textContent).not.toContain("counts until someone withdraws");
		expect(screen.getByTestId("hygiene-checks")).toHaveTextContent(
			"No claims with a result yet."
		);
		const settings = screen.getByTestId("hygiene-settings");
		expect(settings).toHaveTextContent("No accepted settings yet.");
		expect(settings.textContent).not.toContain("second look");
	});

	it("treats each zero total on its own", async () => {
		serveFigures({
			claims_without_time_limit: { count: 1, of: 1 },
			checks_without_time_limit: { count: 0, of: 0 },
			settings_as_recommended: { count: 0, of: 0 },
		});
		renderPanel();
		expect(await screen.findByTestId("hygiene-claims")).toHaveTextContent(
			"1 of 1"
		);
		expect(screen.getByTestId("hygiene-checks")).toHaveTextContent(
			"No claims with a result yet."
		);
		expect(screen.getByTestId("hygiene-settings")).toHaveTextContent(
			"No accepted settings yet."
		);
	});

	it("shows an error state, with Refresh still there, when the figures cannot be read", async () => {
		serveFigures(500);
		renderPanel();
		await screen.findByText("Evidence health unavailable");
		expect(screen.queryByTestId("hygiene-claims")).toBeNull();
		expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
	});

	it("reads the figures once on opening, and again only when Refresh is pressed", async () => {
		serveFigures(FIGURES, {
			...FIGURES,
			claims_without_time_limit: { count: 4, of: 12 },
		});
		const user = userEvent.setup();
		renderPanel();
		await screen.findByTestId("hygiene-claims");
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(reads).toBe(1);
		await user.click(screen.getByRole("button", { name: "Refresh" }));
		await waitFor(() =>
			expect(screen.getByTestId("hygiene-claims")).toHaveTextContent("4 of 12")
		);
		expect(reads).toBe(2);
	});

	it("recovers from an error when Refresh is pressed", async () => {
		serveFigures(500, FIGURES);
		const user = userEvent.setup();
		renderPanel();
		await screen.findByText("Evidence health unavailable");
		await user.click(screen.getByRole("button", { name: "Refresh" }));
		expect(await screen.findByTestId("hygiene-claims")).toHaveTextContent(
			"3 of 12"
		);
	});

	it("shows an error when a refresh fails after figures were shown, and not stale figures", async () => {
		serveFigures(FIGURES, 500);
		const user = userEvent.setup();
		renderPanel();
		await screen.findByTestId("hygiene-claims");
		await user.click(screen.getByRole("button", { name: "Refresh" }));
		await screen.findByText("Evidence health unavailable");
		expect(screen.queryByTestId("hygiene-claims")).toBeNull();
	});

	it("opens no live connection", async () => {
		serveFigures(FIGURES);
		renderPanel();
		await screen.findByTestId("hygiene-claims");
		expect(FakeEventSource.instances).toHaveLength(0);
	});

	it("has nothing to edit: one button, no field, whoever opens it", async () => {
		for (const canEdit of [true, false]) {
			serveFigures(FIGURES);
			const { unmount } = renderPanel(canEdit);
			const panel = await screen.findByTestId("evidence-health-panel");
			await within(panel).findByTestId("hygiene-claims");
			expect(within(panel).getAllByRole("button")).toHaveLength(1);
			expect(
				panel.querySelectorAll(
					"input, textarea, select, [role=combobox], [role=switch]"
				)
			).toHaveLength(0);
			unmount();
		}
	});

	it("reads the figures of the case it was opened for", async () => {
		let requested = "";
		server.use(
			http.get("/api/cases/:caseId/health/hygiene", ({ params }) => {
				requested = String(params.caseId);
				return HttpResponse.json(FIGURES);
			})
		);
		renderPanel();
		await screen.findByTestId("hygiene-claims");
		expect(requested).toBe("case-9");
	});
});
