import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElementSchema } from "@/lib/schemas/element";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import { server } from "@/src/__tests__/mocks/server";
import useStore from "@/store/store";
import { useNewLinkForm } from "../use-new-link-form";

/**
 * The Add Strategy, Add Property Claim and Add Defeater actions create their
 * element under the card they were opened on. On a counter-goal card that is
 * the counter-goal itself, and the store's top goal (`goals[0]`) is not
 * rewritten to make room for it: the refetch that follows the live update
 * puts the new element in the right place. On the top goal's own card the
 * optimistic update still happens.
 */

const TOP_GOAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COUNTER_GOAL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NESTED_COUNTER_GOAL_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CLAIM_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function buildCase(): AssuranceCaseResponse {
	return {
		id: "case-1",
		goals: [
			{
				id: TOP_GOAL_ID,
				type: "goal",
				name: "G1",
				strategies: [],
				propertyClaims: [
					{
						id: CLAIM_ID,
						type: "property_claim",
						name: "P1",
						propertyClaims: [],
						strategies: [],
						evidence: [],
						goals: [
							{
								id: NESTED_COUNTER_GOAL_ID,
								type: "goal",
								name: "CG2",
								isDefeater: true,
								strategies: [],
								propertyClaims: [],
							},
						],
					},
				],
				goals: [
					{
						id: COUNTER_GOAL_ID,
						type: "goal",
						name: "CG1",
						isDefeater: true,
						strategies: [],
						propertyClaims: [],
					},
				],
			},
		],
	} as unknown as AssuranceCaseResponse;
}

function goalNode(id: string, isDefeater: boolean): Node {
	return {
		id: `goal-${id}`,
		type: "goal",
		position: { x: 0, y: 0 },
		data: { id, isDefeater },
	};
}

const TOP_GOAL_NODE = goalNode(TOP_GOAL_ID, false);
const COUNTER_GOAL_NODE = goalNode(COUNTER_GOAL_ID, true);
const NESTED_COUNTER_GOAL_NODE = goalNode(NESTED_COUNTER_GOAL_ID, true);

/** Validates the body like the real route and records it. */
function mockElementsRoute() {
	let receivedBody: Record<string, unknown> | undefined;
	let calls = 0;
	server.use(
		http.post("/api/cases/:caseId/elements", async ({ request }) => {
			calls += 1;
			const body = (await request.json()) as Record<string, unknown>;
			receivedBody = body;
			const parsed = createElementSchema.safeParse(body);
			if (!parsed.success) {
				return HttpResponse.json(
					{ error: parsed.error.issues[0]?.message ?? "Invalid input" },
					{ status: 400 }
				);
			}
			return HttpResponse.json(
				{
					id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
					...parsed.data,
					name: "N1",
				},
				{ status: 201 }
			);
		})
	);
	return {
		getReceivedBody: () => receivedBody,
		getCalls: () => calls,
	};
}

function setup(node: Node, linkType: "claim" | "strategy" | "defeater") {
	return renderHook(() =>
		useNewLinkForm({
			node,
			linkType,
			actions: {
				setSelectedLink: vi.fn(),
				setLinkToCreate: vi.fn(),
				handleClose: vi.fn(),
			},
			setUnresolvedChanges: vi.fn(),
		})
	);
}

async function submitDescription(
	result: { current: ReturnType<typeof useNewLinkForm> },
	description: string
) {
	act(() => {
		result.current.form.setValue("description", description);
	});
	await act(async () => {
		await result.current.onSubmit(result.current.form.getValues());
	});
	await waitFor(() => expect(result.current.loading).toBe(false));
}

let initialCase: AssuranceCaseResponse;

beforeEach(() => {
	initialCase = buildCase();
	useStore.setState({ assuranceCase: initialCase });
});

afterEach(() => {
	vi.restoreAllMocks();
	useStore.setState({ assuranceCase: null });
});

describe("Add actions on a counter-goal card", () => {
	it.each([
		["direct counter-goal of the top goal", COUNTER_GOAL_NODE, COUNTER_GOAL_ID],
		[
			"counter-goal nested beneath a claim",
			NESTED_COUNTER_GOAL_NODE,
			NESTED_COUNTER_GOAL_ID,
		],
	])("Add Strategy sends the counter-goal as the parent and leaves the store alone (%s)", async (_label, node, expectedParent) => {
		const route = mockElementsRoute();
		const { result } = setup(node, "strategy");

		await submitDescription(result, "A strategy for the counter-goal");

		expect(route.getCalls()).toBe(1);
		expect(route.getReceivedBody()?.parentId).toBe(expectedParent);
		expect(route.getReceivedBody()?.parentId).not.toBe(TOP_GOAL_ID);
		expect(useStore.getState().assuranceCase).toEqual(buildCase());
		expect(useStore.getState().assuranceCase?.goals?.[0]?.strategies).toEqual(
			[]
		);
	});

	it.each([
		["direct counter-goal of the top goal", COUNTER_GOAL_NODE, COUNTER_GOAL_ID],
		[
			"counter-goal nested beneath a claim",
			NESTED_COUNTER_GOAL_NODE,
			NESTED_COUNTER_GOAL_ID,
		],
	])("Add Property Claim sends the counter-goal as the parent and leaves the store alone (%s)", async (_label, node, expectedParent) => {
		const route = mockElementsRoute();
		const { result } = setup(node, "claim");

		await submitDescription(result, "A claim supporting the counter-goal");

		expect(route.getCalls()).toBe(1);
		expect(route.getReceivedBody()?.parentId).toBe(expectedParent);
		expect(route.getReceivedBody()?.parentId).not.toBe(TOP_GOAL_ID);
		expect(useStore.getState().assuranceCase).toEqual(buildCase());
		expect(
			useStore.getState().assuranceCase?.goals?.[0]?.propertyClaims
		).toHaveLength(1);
	});

	it.each([
		["direct counter-goal of the top goal", COUNTER_GOAL_NODE, COUNTER_GOAL_ID],
		[
			"counter-goal nested beneath a claim",
			NESTED_COUNTER_GOAL_NODE,
			NESTED_COUNTER_GOAL_ID,
		],
	])("Add Defeater sends the counter-goal as parent and target and leaves the store alone (%s)", async (_label, node, expectedParent) => {
		const route = mockElementsRoute();
		const { result } = setup(node, "defeater");

		await submitDescription(result, "A challenge to the counter-goal");

		expect(route.getCalls()).toBe(1);
		const body = route.getReceivedBody();
		expect(body?.parentId).toBe(expectedParent);
		expect(body?.defeatsElementId).toBe(expectedParent);
		expect(body?.isDefeater).toBe(true);
		expect(useStore.getState().assuranceCase).toEqual(buildCase());
		expect(
			useStore.getState().assuranceCase?.goals?.[0]?.propertyClaims
		).toHaveLength(1);
	});
});

describe("Add actions on the top goal card", () => {
	it("Add Strategy sends the top goal as the parent and adds the strategy to it in the store", async () => {
		const route = mockElementsRoute();
		const { result } = setup(TOP_GOAL_NODE, "strategy");

		await submitDescription(result, "A strategy for the top goal");

		expect(route.getReceivedBody()?.parentId).toBe(TOP_GOAL_ID);
		const strategies =
			useStore.getState().assuranceCase?.goals?.[0]?.strategies;
		expect(strategies).toHaveLength(1);
		// Everything else on the top goal is as it was.
		const topGoal = useStore.getState().assuranceCase?.goals?.[0];
		expect(topGoal?.goals).toEqual(initialCase.goals?.[0]?.goals);
		expect(topGoal?.propertyClaims).toEqual(
			initialCase.goals?.[0]?.propertyClaims
		);
	});

	it("Add Property Claim sends the top goal as the parent and adds the claim to it in the store", async () => {
		const route = mockElementsRoute();
		const { result } = setup(TOP_GOAL_NODE, "claim");

		await submitDescription(result, "A claim for the top goal");

		expect(route.getReceivedBody()?.parentId).toBe(TOP_GOAL_ID);
		const topGoal = useStore.getState().assuranceCase?.goals?.[0];
		expect(topGoal?.propertyClaims).toHaveLength(2);
		expect(topGoal?.goals).toEqual(initialCase.goals?.[0]?.goals);
	});

	it("Add Defeater sends the top goal as parent and target and adds the claim to it in the store", async () => {
		const route = mockElementsRoute();
		const { result } = setup(TOP_GOAL_NODE, "defeater");

		await submitDescription(result, "A challenge to the top goal");

		const body = route.getReceivedBody();
		expect(body?.parentId).toBe(TOP_GOAL_ID);
		expect(body?.defeatsElementId).toBe(TOP_GOAL_ID);
		expect(body?.isDefeater).toBe(true);
		expect(
			useStore.getState().assuranceCase?.goals?.[0]?.propertyClaims
		).toHaveLength(2);
	});
});
