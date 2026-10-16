import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseEvents } from "@/hooks/use-case-events";
import { evidenceNodeText } from "@/lib/health-evidence-node-text";
import type { ElementSlotContext } from "@/lib/plugins/slots/index";
import { toast } from "@/lib/toast";
import {
	HEALTH_CHECK_PIPELINE,
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { HealthPanel } from "../health-panel";
import type {
	HealthCriteriaResponse,
	HealthEvidenceNode,
	HealthEvidenceNodeText,
} from "../health-types";
import { checkLists, NO_CRITERIA, storedCriteria } from "./criteria-test-data";

vi.mock("@/hooks/use-case-events", () => ({
	CASE_RELOAD_EVENT_TYPES: [],
	subscribeToCaseEvents: vi.fn(() => () => undefined),
	useCaseEvents: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

const CONTEXT: ElementSlotContext = {
	caseId: "case-1",
	elementId: "claim-42",
	elementType: "property",
	canEdit: true,
};
const CRITERIA_URL = "/api/elements/claim-42/health/criteria";
const NODE_URL = "/api/elements/claim-42/health/evidence-node";
const IDENTIFIER = /\bE\d+\b/;
const KEEP_LABEL = /^Keep E4 as ordinary evidence/;
const REMOVE_LABEL = /^Remove E4/;

function checkNamed(name: string) {
	const check = checkLists()[0]?.checks.find((entry) => entry.name === name);
	if (!check) {
		throw new Error(`no demo check ${name}`);
	}
	return check;
}

const ITEM_TEXT = evidenceNodeText(
	checkNamed(ITEM_CHECK_NAME),
	HEALTH_CHECK_PIPELINE
);
const NUMERIC_TEXT = evidenceNodeText(
	checkNamed(NUMERIC_CHECK_NAME),
	HEALTH_CHECK_PIPELINE
);

function node(overrides: Partial<HealthEvidenceNode> = {}): HealthEvidenceNode {
	return { id: "node-1", name: "E4", state: "live", ...overrides };
}

function nodeText(
	overrides: Partial<HealthEvidenceNodeText> = {}
): HealthEvidenceNodeText {
	return {
		description: ITEM_TEXT,
		written_for: { check: ITEM_CHECK_NAME, pipeline: HEALTH_CHECK_PIPELINE },
		...overrides,
	};
}

/** Settings that were stopped, with the node kept. */
function stoppedWithNode(
	nodeOverrides: Partial<HealthEvidenceNode> = {},
	textOverrides: Partial<HealthEvidenceNodeText> = {}
): HealthCriteriaResponse {
	return storedCriteria({
		state: "inactive",
		overrides: {
			evidence_node: node(nodeOverrides),
			evidence_node_text:
				(nodeOverrides.state ?? "live") === "live"
					? nodeText(textOverrides)
					: null,
			last_change: {
				action: "retired",
				by_name: "Alice",
				at: "2026-10-02T10:00:00.000Z",
				reason: "Superseded",
			},
		},
	});
}

interface Served {
	criteria: HealthCriteriaResponse;
	nodePosts: number;
	puts: Record<string, unknown>[];
	retirements: Record<string, unknown>[];
}

function serve(criteria: HealthCriteriaResponse): Served {
	const served: Served = { criteria, puts: [], retirements: [], nodePosts: 0 };
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
		http.get(CRITERIA_URL, () => HttpResponse.json(served.criteria)),
		http.put(CRITERIA_URL, async ({ request }) => {
			served.puts.push((await request.json()) as Record<string, unknown>);
			return HttpResponse.json(served.criteria);
		}),
		http.post(`${CRITERIA_URL}/retirement`, async ({ request }) => {
			served.retirements.push(
				(await request.json()) as Record<string, unknown>
			);
			return HttpResponse.json(NO_CRITERIA);
		}),
		http.post(NODE_URL, () => {
			served.nodePosts += 1;
			return HttpResponse.json(served.criteria);
		})
	);
	return served;
}

beforeEach(() => {
	vi.mocked(useCaseEvents).mockReturnValue({
		status: "connected",
		isConnected: true,
		lastEvent: null,
		reconnect: vi.fn(),
		disconnect: vi.fn(),
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

async function openSettings(canEdit = true) {
	const user = userEvent.setup();
	render(<HealthPanel {...CONTEXT} canEdit={canEdit} />, {
		withProviders: false,
	});
	await user.click(await screen.findByRole("tab", { name: "Settings" }));
	return user;
}

async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
	await user.click(await screen.findByRole("combobox", { name: "Check" }));
	await user.click(await screen.findByRole("option", { name }));
}

describe("accepting a fresh pick", () => {
	it("offers to add a node, ticked, showing the whole text it will carry and no identifier", async () => {
		serve(NO_CRITERIA);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);

		const box = await screen.findByRole("checkbox", {
			name: "Add an evidence node under this claim",
		});
		expect(box).toBeChecked();
		const text = screen.getByTestId("health-node-new-text");
		expect(text).toHaveTextContent(ITEM_TEXT);
		expect(text.textContent).toBe(ITEM_TEXT);
		expect(screen.getByTestId("health-node-options")).not.toHaveTextContent(
			IDENTIFIER
		);
	});

	it("asks the server for the node when the box is ticked", async () => {
		const served = serve(NO_CRITERIA);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);

		await user.click(
			await screen.findByRole("button", { name: "Accept settings" })
		);

		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({
			accept: true,
			add_evidence_node: true,
		});
	});

	it("sends no node request when the box is unticked", async () => {
		const served = serve(NO_CRITERIA);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);
		await user.click(
			await screen.findByRole("checkbox", {
				name: "Add an evidence node under this claim",
			})
		);

		await user.click(screen.getByRole("button", { name: "Accept settings" }));

		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({ accept: true });
		expect(served.puts[0]).not.toHaveProperty("add_evidence_node");
	});

	it("sends no node request when the settings are only saved as a suggestion", async () => {
		const served = serve(NO_CRITERIA);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);

		await user.click(
			await screen.findByRole("button", { name: "Save without accepting" })
		);

		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({ accept: false });
		expect(served.puts[0]).not.toHaveProperty("add_evidence_node");
		expect(served.puts[0]).not.toHaveProperty("update_evidence_node_text");
	});

	it("shows no node choices to a person who cannot edit", async () => {
		serve(storedCriteria({ state: "suggested" }));
		await openSettings(false);

		await screen.findByTestId("health-criteria-form");
		expect(screen.queryByTestId("health-node-options")).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Accept settings" })
		).toBeNull();
	});
});

describe("accepting again over a kept node", () => {
	it("says which node results will show on and offers nothing else when the check is the same", async () => {
		const served = serve(stoppedWithNode());
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);

		expect(await screen.findByTestId("health-node-reused")).toHaveTextContent(
			"Results will show on evidence node E4."
		);
		expect(
			within(screen.getByTestId("health-node-options")).queryByRole("checkbox")
		).toBeNull();

		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).not.toHaveProperty("add_evidence_node");
		expect(served.puts[0]).not.toHaveProperty("update_evidence_node_text");
	});

	it("offers the text update, ticked, with the text now and after, when the new check differs", async () => {
		const served = serve(stoppedWithNode());
		const user = await openSettings();
		await pick(user, NUMERIC_CHECK_NAME);

		const box = await screen.findByRole("checkbox", {
			name: "Update E4's text to name the new check",
		});
		expect(box).toBeChecked();
		expect(screen.getByTestId("health-node-old-text")).toHaveTextContent(
			ITEM_TEXT
		);
		expect(screen.getByTestId("health-node-after-text")).toHaveTextContent(
			NUMERIC_TEXT
		);
		expect(
			screen.queryByRole("checkbox", {
				name: "Add an evidence node under this claim",
			})
		).toBeNull();

		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({ update_evidence_node_text: true });
		expect(served.puts[0]).not.toHaveProperty("add_evidence_node");
	});

	it("leaves the text update out of the request when it is unticked", async () => {
		const served = serve(stoppedWithNode());
		const user = await openSettings();
		await pick(user, NUMERIC_CHECK_NAME);
		await user.click(
			await screen.findByRole("checkbox", {
				name: "Update E4's text to name the new check",
			})
		);

		await user.click(screen.getByRole("button", { name: "Accept settings" }));

		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).not.toHaveProperty("update_evidence_node_text");
	});

	it("offers the update over a suggestion made after the node was kept, by the check the node's text names", async () => {
		const served = serve(
			storedCriteria({
				checkName: NUMERIC_CHECK_NAME,
				state: "suggested",
				overrides: {
					evidence_node: node(),
					evidence_node_text: nodeText(),
				},
			})
		);
		const user = await openSettings();

		expect(
			await screen.findByRole("checkbox", {
				name: "Update E4's text to name the new check",
			})
		).toBeChecked();
		expect(screen.getByTestId("health-node-after-text")).toHaveTextContent(
			NUMERIC_TEXT
		);

		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({
			accept: true,
			update_evidence_node_text: true,
		});
	});

	it("offers no update over a suggestion for the check the node's text already names", async () => {
		serve(
			storedCriteria({
				checkName: ITEM_CHECK_NAME,
				state: "suggested",
				overrides: {
					evidence_node: node(),
					evidence_node_text: nodeText({
						written_for: {
							check: ITEM_CHECK_NAME,
							pipeline: HEALTH_CHECK_PIPELINE,
						},
					}),
				},
			})
		);
		await openSettings();

		expect(await screen.findByTestId("health-node-reused")).toBeVisible();
		expect(
			within(screen.getByTestId("health-node-options")).queryByRole("checkbox")
		).toBeNull();
	});

	it.each([
		"moved",
		"trashed",
		"missing",
	] as const)("offers a new node, as for a first acceptance, when the kept node is %s", async (state) => {
		const served = serve(stoppedWithNode({ state }));
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);

		expect(
			await screen.findByRole("checkbox", {
				name: "Add an evidence node under this claim",
			})
		).toBeChecked();
		expect(screen.queryByTestId("health-node-reused")).toBeNull();

		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({ add_evidence_node: true });
	});
});

describe("changing the check of accepted settings", () => {
	function acceptedWith(
		nodeOverrides: Partial<HealthEvidenceNode> | null,
		text: Partial<HealthEvidenceNodeText> = {}
	) {
		return storedCriteria({
			overrides: {
				evidence_node: nodeOverrides ? node(nodeOverrides) : null,
				evidence_node_text:
					nodeOverrides && (nodeOverrides.state ?? "live") === "live"
						? nodeText(text)
						: null,
			},
		});
	}

	it("offers the text update for a live node, with the node's own text beside the new text", async () => {
		const served = serve(
			acceptedWith({}, { description: "Rewritten by the author" })
		);
		const user = await openSettings();
		await screen.findByTestId("health-criteria-form");
		expect(screen.queryByTestId("health-node-options")).toBeNull();

		await pick(user, NUMERIC_CHECK_NAME);

		expect(
			await screen.findByRole("checkbox", {
				name: "Update E4's text to name the new check",
			})
		).toBeChecked();
		expect(screen.getByTestId("health-node-old-text")).toHaveTextContent(
			"Rewritten by the author"
		);
		expect(screen.getByTestId("health-node-after-text")).toHaveTextContent(
			NUMERIC_TEXT
		);

		await user.click(screen.getByRole("button", { name: "Save settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({
			accept: true,
			update_evidence_node_text: true,
		});
	});

	it.each([
		["a node that has moved", { state: "moved" as const }],
		["a node in the trash", { state: "trashed" as const }],
		["no node", null],
	])("offers no text update for %s", async (_label, nodeOverrides) => {
		serve(acceptedWith(nodeOverrides));
		const user = await openSettings();
		await screen.findByTestId("health-criteria-form");

		await pick(user, NUMERIC_CHECK_NAME);

		await screen.findByRole("button", { name: "Save settings" });
		expect(screen.queryByTestId("health-node-options")).toBeNull();
	});

	it("offers nothing while the check stays the same", async () => {
		serve(acceptedWith({}));
		await openSettings();

		await screen.findByTestId("health-criteria-form");
		expect(screen.queryByTestId("health-node-options")).toBeNull();
	});
});

describe("stopping the use of accepted settings", () => {
	async function openRetire(view: HealthCriteriaResponse) {
		const served = serve(view);
		const user = await openSettings();
		await user.click(
			await screen.findByRole("button", { name: "Stop using these settings" })
		);
		const dialog = await screen.findByRole("dialog");
		return { dialog, served, user };
	}

	it("asks keep or remove for a live node, with neither chosen, and waits for the answer", async () => {
		const { dialog, user } = await openRetire(
			storedCriteria({ overrides: { evidence_node: node() } })
		);

		const keep = within(dialog).getByRole("radio", { name: KEEP_LABEL });
		const remove = within(dialog).getByRole("radio", { name: REMOVE_LABEL });
		expect(keep).not.toBeChecked();
		expect(remove).not.toBeChecked();

		await user.type(within(dialog).getByLabelText("Reason"), "Superseded");
		const submit = within(dialog).getByRole("button", {
			name: "Stop using these settings",
		});
		expect(submit).toBeDisabled();

		await user.click(keep);
		expect(submit).toBeEnabled();
	});

	it.each([
		["keep", KEEP_LABEL],
		["remove", REMOVE_LABEL],
	] as const)("sends the choice to %s the node", async (choice, label) => {
		const { dialog, served, user } = await openRetire(
			storedCriteria({ overrides: { evidence_node: node() } })
		);
		await user.type(within(dialog).getByLabelText("Reason"), "Superseded");
		await user.click(within(dialog).getByRole("radio", { name: label }));

		await user.click(
			within(dialog).getByRole("button", { name: "Stop using these settings" })
		);

		await waitFor(() => expect(served.retirements).toHaveLength(1));
		expect(served.retirements[0]).toEqual({
			reason: "Superseded",
			evidence_node: choice,
		});
	});

	it.each([
		["a node that has moved", node({ state: "moved" })],
		["a node in the trash", node({ state: "trashed" })],
		["no node", null],
	])("asks nothing about %s, and sends only the reason", async (_label, evidenceNode) => {
		const { dialog, served, user } = await openRetire(
			storedCriteria({ overrides: { evidence_node: evidenceNode } })
		);
		expect(within(dialog).queryByRole("radio")).toBeNull();
		await user.type(within(dialog).getByLabelText("Reason"), "Superseded");

		await user.click(
			within(dialog).getByRole("button", { name: "Stop using these settings" })
		);

		await waitFor(() => expect(served.retirements).toHaveLength(1));
		expect(served.retirements[0]).toEqual({ reason: "Superseded" });
	});
});

describe("the node line in Settings", () => {
	it("says which node results show on", async () => {
		serve(storedCriteria({ overrides: { evidence_node: node() } }));
		await openSettings();

		expect(await screen.findByTestId("health-node-line")).toHaveTextContent(
			"Results show on evidence node E4."
		);
		expect(
			screen.queryByRole("button", { name: "Add evidence node" })
		).toBeNull();
	});

	it("offers to add the node for accepted settings that have none, and shows the answer", async () => {
		const served = serve(storedCriteria());
		const user = await openSettings();
		expect(await screen.findByTestId("health-node-line")).toHaveTextContent(
			"Results are not shown as evidence in the case."
		);
		served.criteria = storedCriteria({
			overrides: { evidence_node: node() },
		});

		await user.click(screen.getByRole("button", { name: "Add evidence node" }));

		await waitFor(() => expect(served.nodePosts).toBe(1));
		await waitFor(() =>
			expect(screen.getByTestId("health-node-line")).toHaveTextContent(
				"Results show on evidence node E4."
			)
		);
		expect(
			screen.queryByRole("button", { name: "Add evidence node" })
		).toBeNull();
	});

	it("says where a node is that has moved or gone to the trash, and offers a new one", async () => {
		serve(
			storedCriteria({ overrides: { evidence_node: node({ state: "moved" }) } })
		);
		await openSettings();

		expect(await screen.findByTestId("health-node-line")).toHaveTextContent(
			"E4 is no longer under this claim. Results are not shown as evidence in the case."
		);
		expect(
			screen.getByRole("button", { name: "Add evidence node" })
		).toBeVisible();
	});

	it("shows the server's refusal when the node cannot be added", async () => {
		const served = serve(storedCriteria());
		server.use(
			http.post(NODE_URL, () =>
				HttpResponse.json(
					{ error: "This claim already has a live evidence node" },
					{ status: 409 }
				)
			)
		);
		const user = await openSettings();

		await user.click(
			await screen.findByRole("button", { name: "Add evidence node" })
		);

		await waitFor(() =>
			expect(toast).toHaveBeenCalledWith(
				expect.objectContaining({
					variant: "destructive",
					description: "This claim already has a live evidence node",
				})
			)
		);
		expect(served.nodePosts).toBe(0);
	});

	it("shows the line but no button to a person who cannot edit", async () => {
		serve(storedCriteria());
		await openSettings(false);

		expect(await screen.findByTestId("health-node-line")).toBeVisible();
		expect(
			screen.queryByRole("button", { name: "Add evidence node" })
		).toBeNull();
	});

	it("says nothing about a node for settings that are not accepted", async () => {
		serve(storedCriteria({ state: "suggested" }));
		await openSettings();

		await screen.findByTestId("health-criteria-form");
		expect(screen.queryByTestId("health-node-line")).toBeNull();
	});
});
