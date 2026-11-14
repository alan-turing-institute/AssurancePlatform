import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	CLAIM_CONTEXT,
	FakeEventSource,
	installFakeEventSource,
	openConnections,
	serveHealth,
} from "@/src/__tests__/utils/health-criteria-harness";
import { render, screen, within } from "@/src/__tests__/utils/test-utils";
import { HealthPanel } from "../health-panel";
import type { HealthMismatch } from "../health-types";
import { checkLists, storedCriteria } from "./criteria-test-data";
import { item, status } from "./health-test-data";

vi.mock("@radix-ui/react-select", async () => {
	return await vi.importActual("@radix-ui/react-select");
});
vi.mock("@radix-ui/react-radio-group", async () => {
	return await vi.importActual("@radix-ui/react-radio-group");
});

beforeEach(() => {
	installFakeEventSource();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const NO_SETTINGS = storedCriteria({ state: "inactive" });

function serve(
	options: {
		evidence?: ReturnType<typeof item>[];
		mismatch?: HealthMismatch | null;
		view?: ReturnType<typeof storedCriteria>;
	} = {}
) {
	return serveHealth({
		lists: checkLists(),
		view: options.view ?? NO_SETTINGS,
		status: status({ mismatch: options.mismatch ?? null }),
		evidence: options.evidence ?? [item()],
	});
}

function renderPanel(canEdit = true) {
	return render(<HealthPanel {...CLAIM_CONTEXT} canEdit={canEdit} />, {
		withProviders: false,
	});
}

describe("the Evidence tab's two views", () => {
	it("opens on Results and has a Settings view beside it", async () => {
		serve();
		renderPanel();
		await screen.findByTestId("health-evidence-log");
		expect(screen.getByRole("tab", { name: "Results" })).toHaveAttribute(
			"aria-selected",
			"true"
		);
		expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute(
			"aria-selected",
			"false"
		);
		expect(screen.getByRole("tabpanel", { name: "Results" })).toBeVisible();
		expect(screen.getByRole("tabpanel", { name: "Settings" })).toHaveAttribute(
			"data-state",
			"inactive"
		);
	});

	it("keeps unsaved settings when the person looks at Results and comes back", async () => {
		serve({ view: storedCriteria() });
		const user = userEvent.setup();
		renderPanel();
		await user.click(await screen.findByRole("tab", { name: "Settings" }));
		const panel = screen.getByRole("tabpanel", { name: "Settings" });
		const window = await within(panel).findByLabelText("Window length");
		await user.clear(window);
		await user.type(window, "9");
		await user.click(screen.getByRole("tab", { name: "Results" }));
		await user.click(screen.getByRole("tab", { name: "Settings" }));
		expect(
			(
				within(
					screen.getByRole("tabpanel", { name: "Settings" })
				).getByLabelText("Window length") as HTMLInputElement
			).value
		).toBe("9");
	});

	it("shows not applicable for a goal, makes no request for settings and opens no connection", async () => {
		let requests = 0;
		server.use(
			http.get("/api/elements/goal-1/health/criteria", () => {
				requests += 1;
				return HttpResponse.json({});
			})
		);
		render(
			<HealthPanel {...CLAIM_CONTEXT} elementId="goal-1" elementType="goal" />,
			{ withProviders: false }
		);
		expect(screen.getByText("Not applicable")).toBeVisible();
		expect(screen.queryByRole("tab", { name: "Settings" })).toBeNull();
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(requests).toBe(0);
		expect(FakeEventSource.instances).toHaveLength(0);
	});

	it("opens exactly one live-update connection for the whole tab, before and after the Settings view is opened", async () => {
		const served = serve({ view: storedCriteria() });
		const user = userEvent.setup();
		renderPanel();
		await screen.findByTestId("health-evidence-log");
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(openConnections()).toHaveLength(1);
		await user.click(screen.getByRole("tab", { name: "Settings" }));
		await within(
			screen.getByRole("tabpanel", { name: "Settings" })
		).findByTestId("health-accepted-line");
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(openConnections()).toHaveLength(1);
		expect(FakeEventSource.instances).toHaveLength(1);
		expect(served.checkListReads).toBeGreaterThan(0);
	});

	it("opens one connection for a viewer as well", async () => {
		serve({ view: storedCriteria() });
		renderPanel(false);
		await screen.findByTestId("health-evidence-log");
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(openConnections()).toHaveLength(1);
	});
});

describe("Results: the header button", () => {
	it("offers Change while the claim has no accepted settings", async () => {
		serve({ view: NO_SETTINGS });
		renderPanel();
		const header = await screen.findByTestId("health-panel-header");
		expect(
			within(header).getByRole("button", { name: "Change" })
		).toBeVisible();
		expect(
			within(header).queryByRole("button", { name: "Set in Settings" })
		).toBeNull();
	});

	it("offers Set in Settings instead of Change while the claim has accepted settings, and it opens the Settings view", async () => {
		serve({ view: storedCriteria() });
		const user = userEvent.setup();
		renderPanel();
		const header = await screen.findByTestId("health-panel-header");
		const button = await within(header).findByRole("button", {
			name: "Set in Settings",
		});
		expect(within(header).queryByRole("button", { name: "Change" })).toBeNull();
		await user.click(button);
		expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute(
			"aria-selected",
			"true"
		);
		expect(
			await within(
				screen.getByRole("tabpanel", { name: "Settings" })
			).findByTestId("health-accepted-line")
		).toBeVisible();
	});

	it("offers Change for suggested settings, because nothing is accepted", async () => {
		serve({ view: storedCriteria({ state: "suggested" }) });
		renderPanel();
		const header = await screen.findByTestId("health-panel-header");
		await waitFor(() =>
			expect(
				within(header).getByRole("button", { name: "Change" })
			).toBeVisible()
		);
	});

	it("offers a viewer neither button", async () => {
		serve({ view: storedCriteria() });
		renderPanel(false);
		const header = await screen.findByTestId("health-panel-header");
		expect(within(header).queryByRole("button")).toBeNull();
	});
});

describe("Results: saying a result was judged with other settings", () => {
	it("says nobody has accepted how results are judged when the claim has no accepted settings", async () => {
		serve({ mismatch: { state: "undeclared" } });
		renderPanel();
		const lines = await screen.findByTestId("health-mismatch-lines");
		expect(lines).toHaveTextContent(
			"This claim has no accepted settings. Results are shown, but nobody has accepted how they are judged."
		);
	});

	it("gives one sentence for each difference in the present tense", async () => {
		serve({
			mismatch: {
				state: "mismatch",
				differences: [
					{ field: "window", declared: "PT5M", used: "PT1M" },
					{ field: "reduction", declared: null, used: "d1" },
				],
			},
		});
		renderPanel();
		const lines = await screen.findByTestId("health-mismatch-lines");
		const sentences = [...lines.querySelectorAll("p")].map(
			(line) => line.textContent
		);
		expect(sentences).toEqual([
			"The pipeline used a window of 1 minute; the settings say 5 minutes.",
			"The pipeline used a combining step; the settings do not have one.",
		]);
	});

	it("shows no line for a claim whose result matches", async () => {
		serve({ mismatch: null });
		renderPanel();
		await screen.findByTestId("health-panel-header");
		expect(screen.queryByTestId("health-mismatch-lines")).toBeNull();
	});

	it("words a record's differences in the past tense, an undeclared record in its own sentence, and a matching record not at all", async () => {
		serve({
			evidence: [
				item(
					{
						id: "row-a",
						chain_sequence: 3,
						echo_state: "mismatch",
						echo_differences: [
							{ field: "valid_for", declared: "PT1H", used: "indefinite" },
						],
					},
					{ record_id: "e0bbe873-0000-4000-8000-00000000000a" }
				),
				item(
					{ id: "row-b", chain_sequence: 2, echo_state: "undeclared" },
					{ record_id: "e0bbe873-0000-4000-8000-00000000000b" }
				),
				item(
					{ id: "row-c", chain_sequence: 1, echo_state: "match" },
					{ record_id: "e0bbe873-0000-4000-8000-00000000000c" }
				),
			],
		});
		renderPanel();
		await screen.findByTestId("health-evidence-log");
		const notes = await screen.findAllByTestId("health-evidence-echo");
		expect(notes).toHaveLength(2);
		expect(notes[0]?.textContent).toBe(
			"The pipeline let the result count for no time limit; the settings said 1 hour."
		);
		expect(notes[1]?.textContent).toBe(
			"No accepted settings when this result arrived."
		);
	});
});
