import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseEvents } from "@/hooks/use-case-events";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import {
	HEALTH_CHECK_PIPELINE,
	ITEM_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { HealthPanel } from "../health-panel";
import type {
	HealthCriteriaResponse,
	HealthEvidenceNode,
} from "../health-types";
import { checkLists, NO_CRITERIA, storedCriteria } from "./criteria-test-data";

vi.mock("@/hooks/use-case-events", () => ({
	useCaseEvents: vi.fn(),
}));

const CONTEXT: ElementSlotContext = {
	caseId: "case-1",
	elementId: "claim-42",
	elementType: "property",
	canEdit: true,
};
const CRITERIA_URL = "/api/elements/claim-42/health/criteria";
const RETIREMENT_URL = `${CRITERIA_URL}/retirement`;
const NODE_URL = "/api/elements/claim-42/health/evidence-node";

const LIVE_E4: HealthEvidenceNode = { id: "node-4", name: "E4", state: "live" };
const ITEM_TEXT = `Results from the ${ITEM_CHECK_NAME} check, run by ${HEALTH_CHECK_PIPELINE}. It measures: Is the surface of the item free of visible marks?`;

function withNode(
	base: HealthCriteriaResponse,
	node: HealthEvidenceNode | null
): HealthCriteriaResponse {
	return {
		...base,
		evidence_node: node,
		evidence_node_text:
			node?.state === "live"
				? {
						description: ITEM_TEXT,
						written_for: {
							check: ITEM_CHECK_NAME,
							pipeline: HEALTH_CHECK_PIPELINE,
						},
					}
				: null,
	};
}

beforeEach(() => {
	vi.mocked(useCaseEvents).mockImplementation(() => ({
		status: "connected",
		isConnected: true,
		lastEvent: null,
		reconnect: vi.fn(),
		disconnect: vi.fn(),
	}));
});

afterEach(() => {
	vi.restoreAllMocks();
});

interface Served {
	criteria: HealthCriteriaResponse;
	nodePosts: number;
	reads: number;
	retirements: Record<string, unknown>[];
}

function serve(
	criteria: HealthCriteriaResponse,
	options: { onNodePost?: () => Response | Promise<Response> } = {}
): Served {
	const served: Served = { criteria, nodePosts: 0, reads: 0, retirements: [] };
	server.use(
		http.get("/api/machine/health/elements/claim-42/evidence", () =>
			HttpResponse.json({ evidence: [], next_before: null })
		),
		http.get("/api/elements/claim-42/health", () =>
			HttpResponse.json({ status: null })
		),
		http.get("/api/cases/case-1/health/checks", () =>
			HttpResponse.json(checkLists())
		),
		http.get(CRITERIA_URL, () => {
			served.reads += 1;
			return HttpResponse.json(served.criteria);
		}),
		http.post(RETIREMENT_URL, async ({ request }) => {
			served.retirements.push(
				(await request.json()) as Record<string, unknown>
			);
			return HttpResponse.json(NO_CRITERIA);
		}),
		http.post(NODE_URL, async () => {
			served.nodePosts += 1;
			return (
				(await options.onNodePost?.()) ?? HttpResponse.json(served.criteria)
			);
		})
	);
	return served;
}

async function openSettings(canEdit = true) {
	const user = userEvent.setup();
	render(<HealthPanel {...CONTEXT} canEdit={canEdit} />, {
		withProviders: false,
	});
	await user.click(await screen.findByRole("tab", { name: "Settings" }));
	return user;
}

const STOP = "Stop using these settings";
const KEEP = /^Keep /;
const REMOVE = /^Remove /;
const KEEP_E4 = /^Keep E4 as ordinary evidence/;
const REMOVE_E4 = /^Remove E4/;

async function openStopDialog(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole("button", { name: STOP }));
	return screen.getAllByRole("button", { name: STOP }).at(-1) as HTMLElement;
}

const keepRadio = () => screen.queryByRole("radio", { name: KEEP });
const removeRadio = () => screen.queryByRole("radio", { name: REMOVE });

describe("stopping the use of settings whose node is live", () => {
	it("asks what to do with the node, with neither answer chosen in advance", async () => {
		serve(withNode(storedCriteria(), LIVE_E4));
		const user = await openSettings();
		const submit = await openStopDialog(user);

		expect(
			await screen.findByText("What should happen to evidence node E4?")
		).toBeVisible();
		expect(keepRadio()).not.toBeChecked();
		expect(removeRadio()).not.toBeChecked();
		expect(screen.getByRole("radio", { name: KEEP_E4 })).toBeVisible();
		expect(screen.getByRole("radio", { name: REMOVE_E4 })).toBeVisible();

		await user.type(screen.getByLabelText("Reason"), "Check replaced");
		expect(submit).toBeDisabled();
	});

	it("sends the reason and 'keep' when keeping is chosen", async () => {
		const served = serve(withNode(storedCriteria(), LIVE_E4));
		const user = await openSettings();
		const submit = await openStopDialog(user);
		await user.type(screen.getByLabelText("Reason"), "Check replaced");
		await user.click(screen.getByRole("radio", { name: KEEP }));
		expect(submit).toBeEnabled();

		await user.click(submit);

		await waitFor(() =>
			expect(served.retirements).toEqual([
				{ reason: "Check replaced", evidence_node: "keep" },
			])
		);
	});

	it("sends the reason and 'remove' when removing is chosen", async () => {
		const served = serve(withNode(storedCriteria(), LIVE_E4));
		const user = await openSettings();
		const submit = await openStopDialog(user);
		await user.type(screen.getByLabelText("Reason"), "Check replaced");
		await user.click(screen.getByRole("radio", { name: REMOVE }));

		await user.click(submit);

		await waitFor(() =>
			expect(served.retirements).toEqual([
				{ reason: "Check replaced", evidence_node: "remove" },
			])
		);
	});

	it("needs an answer even when the reason is filled in first", async () => {
		const served = serve(withNode(storedCriteria(), LIVE_E4));
		const user = await openSettings();
		const submit = await openStopDialog(user);
		await user.type(screen.getByLabelText("Reason"), "Check replaced");

		await user.click(submit);

		expect(served.retirements).toEqual([]);
	});

	it("forgets an earlier answer when the dialog is closed and opened again", async () => {
		serve(withNode(storedCriteria(), LIVE_E4));
		const user = await openSettings();
		await openStopDialog(user);
		await user.click(screen.getByRole("radio", { name: REMOVE }));
		expect(removeRadio()).toBeChecked();

		await user.click(
			screen.getAllByRole("button", { name: "Cancel" }).at(-1) as HTMLElement
		);
		await openStopDialog(user);

		expect(keepRadio()).not.toBeChecked();
		expect(removeRadio()).not.toBeChecked();
	});
});

describe("stopping the use of settings whose node is not live", () => {
	it.each([
		["trashed", { id: "node-4", name: "E4", state: "trashed" }],
		["moved", { id: "node-4", name: "E4", state: "moved" }],
		["missing", { id: "node-4", name: null, state: "missing" }],
		["never added", null],
	] as const)("does not ask when the node is %s, and sends only the reason", async (_name, node) => {
		const served = serve(withNode(storedCriteria(), node));
		const user = await openSettings();
		const submit = await openStopDialog(user);

		expect(keepRadio()).toBeNull();
		expect(removeRadio()).toBeNull();
		await user.type(screen.getByLabelText("Reason"), "Check replaced");
		expect(submit).toBeEnabled();
		await user.click(submit);

		await waitFor(() =>
			expect(served.retirements).toEqual([{ reason: "Check replaced" }])
		);
	});

	it("does not ask when a suggestion is discarded, even if a node was kept", async () => {
		const served = serve(
			withNode(storedCriteria({ state: "suggested" }), LIVE_E4)
		);
		const user = await openSettings();

		await user.click(
			await screen.findByRole("button", { name: "Discard suggestion" })
		);

		await waitFor(() => expect(served.retirements).toEqual([{}]));
	});

	it("gives a person who cannot edit no way to stop the settings", async () => {
		serve(withNode(storedCriteria(), LIVE_E4));
		await openSettings(false);

		await screen.findByText("1. Judge each reading");
		expect(screen.queryByRole("button", { name: STOP })).toBeNull();
		expect(keepRadio()).toBeNull();
	});
});

describe("accepted settings with no live node", () => {
	it("says results are not shown as evidence, and offers to add the node, when there was never one", async () => {
		serve(withNode(storedCriteria(), null));
		await openSettings();

		expect(await screen.findByTestId("health-node-line")).toHaveTextContent(
			"Results are not shown as evidence in the case."
		);
		expect(
			screen.getByRole("button", { name: "Add evidence node" })
		).toBeVisible();
	});

	it.each([
		["moved", "E4 is no longer under this claim."],
		["trashed", "E4 is in the trash."],
	] as const)("says where the node is when it is %s, and offers to add one", async (state, sentence) => {
		serve(withNode(storedCriteria(), { id: "node-4", name: "E4", state }));
		await openSettings();

		const line = await screen.findByTestId("health-node-line");
		expect(line).toHaveTextContent(sentence);
		expect(line).toHaveTextContent(
			"Results are not shown as evidence in the case."
		);
		expect(
			screen.getByRole("button", { name: "Add evidence node" })
		).toBeVisible();
	});

	it("offers to add one when the node has been deleted for good", async () => {
		serve(
			withNode(storedCriteria(), { id: "node-4", name: null, state: "missing" })
		);
		await openSettings();

		expect(await screen.findByTestId("health-node-line")).toHaveTextContent(
			"Results are not shown as evidence in the case."
		);
		expect(
			screen.getByRole("button", { name: "Add evidence node" })
		).toBeVisible();
	});

	it("shows the node's new state at once when the button is pressed", async () => {
		const served = serve(withNode(storedCriteria(), null));
		const user = await openSettings();
		const button = await screen.findByRole("button", {
			name: "Add evidence node",
		});
		served.criteria = withNode(storedCriteria(), LIVE_E4);

		await user.click(button);

		await waitFor(() => expect(served.nodePosts).toBe(1));
		expect(await screen.findByTestId("health-node-line")).toHaveTextContent(
			"Results show on evidence node E4."
		);
		expect(
			screen.queryByRole("button", { name: "Add evidence node" })
		).toBeNull();
	});

	it("sends one request, however often the button is pressed while it waits", async () => {
		const served = serve(withNode(storedCriteria(), null), {
			onNodePost: async () => {
				await delay(100);
				return HttpResponse.json(withNode(storedCriteria(), LIVE_E4));
			},
		});
		const user = await openSettings();
		const button = await screen.findByRole("button", {
			name: "Add evidence node",
		});

		await user.click(button);
		await user.click(button);
		await user.click(button);

		await screen.findByText("Results show on evidence node E4.");
		expect(served.nodePosts).toBe(1);
	});

	it("reads the settings again, and keeps the button, when the server says the case changed", async () => {
		const served = serve(withNode(storedCriteria(), null), {
			onNodePost: () =>
				HttpResponse.json(
					{ error: "The case changed while you were saving. Try again." },
					{ status: 409 }
				),
		});
		const user = await openSettings();
		const button = await screen.findByRole("button", {
			name: "Add evidence node",
		});
		const readsBefore = served.reads;

		await user.click(button);

		await waitFor(() => expect(served.reads).toBeGreaterThan(readsBefore));
		expect(
			await screen.findByRole("button", { name: "Add evidence node" })
		).toBeEnabled();
	});

	it("shows the line but no button to a person who cannot edit", async () => {
		serve(withNode(storedCriteria(), null));
		await openSettings(false);

		expect(await screen.findByTestId("health-node-line")).toHaveTextContent(
			"Results are not shown as evidence in the case."
		);
		expect(
			screen.queryByRole("button", { name: "Add evidence node" })
		).toBeNull();
	});
});

describe("accepted settings with a live node", () => {
	it("says which node results show on, with no button", async () => {
		serve(withNode(storedCriteria(), LIVE_E4));
		await openSettings();

		expect(await screen.findByTestId("health-node-line")).toHaveTextContent(
			"Results show on evidence node E4."
		);
		expect(
			screen.queryByRole("button", { name: "Add evidence node" })
		).toBeNull();
	});
});

describe("settings that are not accepted", () => {
	it.each([
		[
			"suggested",
			storedCriteria({ state: "suggested" }),
			"health-suggested-banner",
		],
		["stopped", storedCriteria({ state: "inactive" }), "health-stopped-line"],
	] as const)("say nothing about the node, and offer no way to add one, when they are %s", async (_name, base, shown) => {
		serve(withNode(base, null));
		await openSettings();

		await screen.findByTestId(shown);
		expect(screen.queryByTestId("health-node-line")).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Add evidence node" })
		).toBeNull();
	});

	it("say nothing about the node, and offer no way to add one, when there are none", async () => {
		serve(withNode(NO_CRITERIA, null));
		await openSettings();

		await screen.findByRole("combobox", { name: "Check" });
		expect(screen.queryByTestId("health-node-line")).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Add evidence node" })
		).toBeNull();
	});
});
