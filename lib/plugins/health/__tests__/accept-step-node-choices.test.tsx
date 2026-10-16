import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseEvents } from "@/hooks/use-case-events";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import {
	HEALTH_CHECK_PIPELINE,
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { HealthPanel } from "../health-panel";
import type {
	HealthCheckListOffer,
	HealthCriteriaResponse,
	HealthEvidenceNode,
	HealthEvidenceNodeText,
} from "../health-types";
import {
	checkLists,
	INTEGRATION,
	NO_CRITERIA,
	storedCriteria,
} from "./criteria-test-data";

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

const ITEM_TEXT = `Results from the ${ITEM_CHECK_NAME} check, run by ${HEALTH_CHECK_PIPELINE}. It measures: Is the surface of the item free of visible marks?`;
const NUMERIC_TEXT = `Results from the ${NUMERIC_CHECK_NAME} check, run by ${HEALTH_CHECK_PIPELINE}. It measures: How far the edge of the item sits from its expected position.`;

const LIVE_E4: HealthEvidenceNode = {
	id: "node-4",
	name: "E4",
	state: "live",
};

function textNamingCheck(
	description: string,
	check: string,
	pipeline: string | null = HEALTH_CHECK_PIPELINE
): HealthEvidenceNodeText {
	return { description, written_for: { check, pipeline } };
}

const ITEM_NODE_TEXT = textNamingCheck(ITEM_TEXT, ITEM_CHECK_NAME);

/** Settings read for a claim whose node is `node`, with `overrides` applied. */
function withNode(
	base: HealthCriteriaResponse,
	node: HealthEvidenceNode | null,
	text: HealthEvidenceNodeText | null = node?.state === "live"
		? ITEM_NODE_TEXT
		: null
): HealthCriteriaResponse {
	return { ...base, evidence_node: node, evidence_node_text: text };
}

/** Settings stopped earlier, with the node kept. */
function stoppedWithNode(
	node: HealthEvidenceNode | null = LIVE_E4,
	text?: HealthEvidenceNodeText | null
) {
	return withNode(
		storedCriteria({
			state: "inactive",
			revision: 2,
			overrides: {
				last_change: {
					action: "retired",
					by_name: "Alice",
					at: "2026-10-02T11:00:00.000Z",
					reason: "Check replaced",
				},
			},
		}),
		node,
		text
	);
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
	puts: Record<string, unknown>[];
}

function serve(
	criteria: HealthCriteriaResponse,
	lists: HealthCheckListOffer[] = checkLists()
): Served {
	const served: Served = { criteria, puts: [] };
	server.use(
		http.get("/api/machine/health/elements/claim-42/evidence", () =>
			HttpResponse.json({ evidence: [], next_before: null })
		),
		http.get("/api/elements/claim-42/health", () =>
			HttpResponse.json({ status: null })
		),
		http.get("/api/cases/case-1/health/checks", () => HttpResponse.json(lists)),
		http.get(CRITERIA_URL, () => HttpResponse.json(served.criteria)),
		http.put(CRITERIA_URL, async ({ request }) => {
			served.puts.push((await request.json()) as Record<string, unknown>);
			return HttpResponse.json(served.criteria);
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

async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
	await user.click(await screen.findByRole("combobox", { name: "Check" }));
	await user.click(await screen.findByRole("option", { name }));
}

const IDENTIFIER = /\bE\d+\b/;
const REUSED_NODE_LINE = /Results will show on evidence node/;
const UPDATE_LABEL = /Update/;
const ADD_LABEL = "Add an evidence node under this claim";
const addBox = () => screen.findByRole("checkbox", { name: ADD_LABEL });
const updateBox = (name = "E4") =>
	screen.findByRole("checkbox", {
		name: `Update ${name}'s text to name the new check`,
	});
const nodeSection = () => screen.getByRole("region", { name: "Evidence node" });

/** The boxes the form offers about the node. The rest of the form has boxes of its own. */
function nodeBoxes() {
	const section = screen.queryByRole("region", { name: "Evidence node" });
	return section ? within(section).queryAllByRole("checkbox") : [];
}

describe("the accept step: adding an evidence node", () => {
	it("offers the node ticked, with the whole text it will carry and no identifier", async () => {
		serve(NO_CRITERIA);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);

		expect(await addBox()).toBeChecked();
		expect(within(nodeSection()).getByText(ITEM_TEXT)).toBeVisible();
		expect(nodeSection().textContent).not.toMatch(IDENTIFIER);
	});

	it("shows a description of two thousand characters in full", async () => {
		const longDescription = `${"abcdefghi ".repeat(199)}abcdefghiz`;
		expect(longDescription).toHaveLength(2000);
		const lists = checkLists().map((list) => ({
			...list,
			checks: list.checks.map((check) =>
				check.name === ITEM_CHECK_NAME
					? { ...check, description: longDescription }
					: check
			),
		}));
		serve(NO_CRITERIA, lists);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);

		await addBox();
		const expected = `Results from the ${ITEM_CHECK_NAME} check, run by ${HEALTH_CHECK_PIPELINE}. It measures: ${longDescription}.`;
		expect(within(nodeSection()).getByText(expected)).toBeVisible();
	});

	it("asks the server to add the node when the option is ticked and the settings are accepted", async () => {
		const served = serve(NO_CRITERIA);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);
		await addBox();

		served.criteria = withNode(storedCriteria(), LIVE_E4);
		await user.click(screen.getByRole("button", { name: "Accept settings" }));

		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({
			accept: true,
			add_evidence_node: true,
		});
		expect(served.puts[0]).not.toHaveProperty("update_evidence_node_text");
	});

	it("asks for no node when the option is unticked", async () => {
		const served = serve(NO_CRITERIA);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);
		await user.click(await addBox());
		expect(await addBox()).not.toBeChecked();

		served.criteria = storedCriteria();
		await user.click(screen.getByRole("button", { name: "Accept settings" }));

		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]?.accept).toBe(true);
		expect(served.puts[0]?.add_evidence_node ?? false).toBe(false);
	});

	it("asks for no node when the settings are saved without accepting, even with the option ticked", async () => {
		const served = serve(NO_CRITERIA);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);
		expect(await addBox()).toBeChecked();

		served.criteria = storedCriteria({ state: "suggested" });
		await user.click(
			screen.getByRole("button", { name: "Save without accepting" })
		);

		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]?.accept).toBe(false);
		expect(served.puts[0]?.add_evidence_node ?? false).toBe(false);
		expect(served.puts[0]?.update_evidence_node_text ?? false).toBe(false);
	});

	it("offers the node again when a suggestion is accepted", async () => {
		const served = serve(storedCriteria({ state: "suggested" }));
		const user = await openSettings();

		expect(await addBox()).toBeChecked();
		expect(within(nodeSection()).getByText(ITEM_TEXT)).toBeVisible();
		served.criteria = withNode(storedCriteria({ revision: 2 }), LIVE_E4);
		await user.click(screen.getByRole("button", { name: "Accept settings" }));

		await waitFor(() => expect(served.puts[0]).toMatchObject({ accept: true }));
		expect(served.puts[0]?.add_evidence_node).toBe(true);
	});

	it("offers nothing about a node to a person who cannot edit", async () => {
		serve(withNode(storedCriteria({ state: "suggested" }), null));
		await openSettings(false);

		await screen.findByTestId("health-suggested-banner");
		expect(nodeBoxes()).toHaveLength(0);
		expect(screen.queryByRole("region", { name: "Evidence node" })).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Accept settings" })
		).toBeNull();
	});
});

describe("the accept step: a node kept when the settings were stopped", () => {
	it("says which node results will show on, and offers neither a second node nor a text update, for the same check", async () => {
		const served = serve(stoppedWithNode());
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);

		expect(
			await screen.findByText("Results will show on evidence node E4.")
		).toBeVisible();
		expect(screen.queryByRole("checkbox", { name: ADD_LABEL })).toBeNull();
		expect(nodeBoxes()).toHaveLength(0);

		served.criteria = withNode(storedCriteria({ revision: 3 }), LIVE_E4);
		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]?.accept).toBe(true);
		expect(served.puts[0]?.add_evidence_node ?? false).toBe(false);
		expect(served.puts[0]?.update_evidence_node_text ?? false).toBe(false);
	});

	it("offers the text update, ticked, with the old and new text side by side, when another check is chosen", async () => {
		const served = serve(stoppedWithNode());
		const user = await openSettings();
		await pick(user, NUMERIC_CHECK_NAME);

		expect(await updateBox()).toBeChecked();
		const section = nodeSection();
		expect(within(section).getByText(ITEM_TEXT)).toBeVisible();
		expect(within(section).getByText(NUMERIC_TEXT)).toBeVisible();
		expect(
			screen.getByText("Results will show on evidence node E4.")
		).toBeVisible();

		served.criteria = withNode(
			storedCriteria({ checkName: NUMERIC_CHECK_NAME, revision: 3 }),
			LIVE_E4,
			textNamingCheck(NUMERIC_TEXT, NUMERIC_CHECK_NAME)
		);
		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({
			accept: true,
			update_evidence_node_text: true,
		});
		expect(served.puts[0]?.add_evidence_node ?? false).toBe(false);
	});

	it("sends no text update when the option is unticked", async () => {
		const served = serve(stoppedWithNode());
		const user = await openSettings();
		await pick(user, NUMERIC_CHECK_NAME);
		await user.click(await updateBox());

		served.criteria = storedCriteria({
			checkName: NUMERIC_CHECK_NAME,
			revision: 3,
		});
		await user.click(screen.getByRole("button", { name: "Accept settings" }));

		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]?.accept).toBe(true);
		expect(served.puts[0]?.update_evidence_node_text ?? false).toBe(false);
	});

	it("sends no text update, and no node request at all, when the settings are only saved as a suggestion", async () => {
		const served = serve(stoppedWithNode());
		const user = await openSettings();
		await pick(user, NUMERIC_CHECK_NAME);
		expect(await updateBox()).toBeChecked();

		served.criteria = storedCriteria({
			checkName: NUMERIC_CHECK_NAME,
			state: "suggested",
			revision: 3,
		});
		await user.click(
			screen.getByRole("button", { name: "Save without accepting" })
		);

		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]?.accept).toBe(false);
		expect(served.puts[0]?.update_evidence_node_text ?? false).toBe(false);
		expect(served.puts[0]?.add_evidence_node ?? false).toBe(false);
	});

	it("offers the update when the pipeline now has another name, even for the same check", async () => {
		serve(
			stoppedWithNode(
				LIVE_E4,
				textNamingCheck(ITEM_TEXT, ITEM_CHECK_NAME, "Previous pipeline name")
			)
		);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);

		expect(await updateBox()).toBeChecked();
	});

	it("offers no update for the same check when the node's text does not record a pipeline", async () => {
		serve(
			stoppedWithNode(
				LIVE_E4,
				textNamingCheck(ITEM_TEXT, ITEM_CHECK_NAME, null)
			)
		);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);

		await screen.findByText("Results will show on evidence node E4.");
		expect(nodeBoxes()).toHaveLength(0);
	});

	it("offers no update when the history names no check the text was written for", async () => {
		serve(
			stoppedWithNode(LIVE_E4, { description: ITEM_TEXT, written_for: null })
		);
		const user = await openSettings();
		await pick(user, NUMERIC_CHECK_NAME);

		await screen.findByText("Results will show on evidence node E4.");
		expect(nodeBoxes()).toHaveLength(0);
	});

	it.each([
		["trashed"],
		["moved"],
		["missing"],
	] as const)("offers a new node, not the old one, when the kept node is %s", async (state) => {
		const served = serve(
			stoppedWithNode({ id: "node-4", name: "E4", state }, null)
		);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);

		expect(await addBox()).toBeChecked();
		expect(screen.queryByText(REUSED_NODE_LINE)).toBeNull();
		expect(screen.queryByRole("checkbox", { name: UPDATE_LABEL })).toBeNull();

		served.criteria = storedCriteria({ revision: 3 });
		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]?.add_evidence_node).toBe(true);
	});
});

describe("the accept step: a suggestion saved after the settings were stopped", () => {
	it.each([
		[
			"a suggestion of another check",
			NUMERIC_CHECK_NAME,
			ITEM_CHECK_NAME,
			true,
		],
		[
			"a suggestion of the check the text names",
			ITEM_CHECK_NAME,
			ITEM_CHECK_NAME,
			false,
		],
		[
			"a suggestion of the old check when the text names another",
			ITEM_CHECK_NAME,
			NUMERIC_CHECK_NAME,
			true,
		],
	] as const)("%s: the update is offered %s", async (_name, suggested, textNames, offered) => {
		const text = textNamingCheck(
			textNames === ITEM_CHECK_NAME ? ITEM_TEXT : NUMERIC_TEXT,
			textNames
		);
		serve(
			withNode(
				storedCriteria({ checkName: suggested, state: "suggested" }),
				LIVE_E4,
				text
			)
		);
		await openSettings();

		await screen.findByText("Results will show on evidence node E4.");
		const boxes = nodeBoxes();
		expect(boxes.length).toBe(offered ? 1 : 0);
	});

	it("sends the text update when the suggestion is accepted and the option is ticked", async () => {
		const served = serve(
			withNode(
				storedCriteria({ checkName: NUMERIC_CHECK_NAME, state: "suggested" }),
				LIVE_E4
			)
		);
		const user = await openSettings();
		expect(await updateBox()).toBeChecked();

		served.criteria = storedCriteria({
			checkName: NUMERIC_CHECK_NAME,
			revision: 3,
		});
		await user.click(screen.getByRole("button", { name: "Accept settings" }));

		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({
			accept: true,
			update_evidence_node_text: true,
		});
	});
});

describe("changing the check of accepted settings", () => {
	it("offers the text update, ticked, with the old and new text side by side, when the node is live", async () => {
		const served = serve(withNode(storedCriteria(), LIVE_E4));
		const user = await openSettings();
		await screen.findByText("1. Judge each reading");
		expect(nodeBoxes()).toHaveLength(0);

		await pick(user, NUMERIC_CHECK_NAME);

		expect(await updateBox()).toBeChecked();
		const section = nodeSection();
		expect(within(section).getByText(ITEM_TEXT)).toBeVisible();
		expect(within(section).getByText(NUMERIC_TEXT)).toBeVisible();
		expect(screen.queryByRole("checkbox", { name: ADD_LABEL })).toBeNull();

		served.criteria = withNode(
			storedCriteria({ checkName: NUMERIC_CHECK_NAME, revision: 2 }),
			LIVE_E4,
			textNamingCheck(NUMERIC_TEXT, NUMERIC_CHECK_NAME)
		);
		await user.click(screen.getByRole("button", { name: "Save settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({
			accept: true,
			update_evidence_node_text: true,
		});
		expect(served.puts[0]?.add_evidence_node ?? false).toBe(false);
	});

	it("sends no text update when the option is unticked", async () => {
		const served = serve(withNode(storedCriteria(), LIVE_E4));
		const user = await openSettings();
		await screen.findByText("1. Judge each reading");
		await pick(user, NUMERIC_CHECK_NAME);
		await user.click(await updateBox());

		served.criteria = storedCriteria({
			checkName: NUMERIC_CHECK_NAME,
			revision: 2,
		});
		await user.click(screen.getByRole("button", { name: "Save settings" }));

		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]?.update_evidence_node_text ?? false).toBe(false);
	});

	it("offers nothing when only a number is changed and the check stays", async () => {
		const served = serve(withNode(storedCriteria(), LIVE_E4));
		const user = await openSettings();
		const window = await screen.findByLabelText("Window length");
		await user.clear(window);
		await user.type(window, "2");

		expect(nodeBoxes()).toHaveLength(0);
		served.criteria = withNode(storedCriteria({ revision: 2 }), LIVE_E4);
		await user.click(screen.getByRole("button", { name: "Save settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]?.update_evidence_node_text ?? false).toBe(false);
		expect(served.puts[0]?.add_evidence_node ?? false).toBe(false);
	});

	it.each([
		["trashed"],
		["moved"],
		["missing"],
	] as const)("offers nothing about the node when it is %s", async (state) => {
		const served = serve(
			withNode(storedCriteria(), { id: "node-4", name: "E4", state }, null)
		);
		const user = await openSettings();
		await screen.findByText("1. Judge each reading");

		await pick(user, NUMERIC_CHECK_NAME);

		expect(nodeBoxes()).toHaveLength(0);
		served.criteria = storedCriteria({
			checkName: NUMERIC_CHECK_NAME,
			revision: 2,
		});
		await user.click(screen.getByRole("button", { name: "Save settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]?.update_evidence_node_text ?? false).toBe(false);
	});

	it("offers nothing about a node when the claim has none", async () => {
		serve(storedCriteria());
		const user = await openSettings();
		await screen.findByText("1. Judge each reading");

		await pick(user, NUMERIC_CHECK_NAME);

		expect(nodeBoxes()).toHaveLength(0);
	});
});

describe("the integration the form is told about", () => {
	it("keeps the stored settings' pipeline when comparing pipelines for the text update", async () => {
		serve(
			withNode(
				storedCriteria({ state: "suggested" }),
				LIVE_E4,
				textNamingCheck(ITEM_TEXT, ITEM_CHECK_NAME, HEALTH_CHECK_PIPELINE)
			)
		);
		await openSettings();

		await screen.findByText("Results will show on evidence node E4.");
		expect(nodeBoxes()).toHaveLength(0);
		expect(INTEGRATION.name).not.toBe(HEALTH_CHECK_PIPELINE);
	});
});
