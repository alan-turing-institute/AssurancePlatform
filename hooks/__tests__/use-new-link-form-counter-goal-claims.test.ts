import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import { server } from "@/src/__tests__/mocks/server";
import useStore from "@/store/store";
import { useNewLinkForm } from "../use-new-link-form";

/**
 * A claim added from a claim or a strategy that supports a counter-goal is
 * placed in the stored case at once, as it is beneath the top goal's own
 * claims and strategies.
 */

const CLAIM_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STRATEGY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function buildCase(): AssuranceCaseResponse {
	return {
		id: "case-1",
		goals: [
			{
				id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
				type: "goal",
				strategies: [],
				propertyClaims: [
					{
						id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
						type: "property_claim",
						propertyClaims: [],
						strategies: [],
						evidence: [],
						goals: [
							{
								id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
								type: "goal",
								isDefeater: true,
								propertyClaims: [
									{
										id: CLAIM_ID,
										type: "property_claim",
										propertyClaims: [],
										strategies: [],
										evidence: [],
									},
								],
								strategies: [
									{ id: STRATEGY_ID, type: "strategy", propertyClaims: [] },
								],
							},
						],
					},
				],
			},
		],
	} as unknown as AssuranceCaseResponse;
}

/** Answers like the real route: the new claim names its parent. */
function mockElementsRoute() {
	server.use(
		http.post("/api/cases/:caseId/elements", async ({ request }) => {
			const body = (await request.json()) as Record<string, unknown>;
			const parentKey =
				body.parentId === STRATEGY_ID ? "strategyId" : "propertyClaimId";
			return HttpResponse.json(
				{
					id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
					type: "property_claim",
					name: "P9",
					description: body.description,
					[parentKey]: body.parentId,
				},
				{ status: 201 }
			);
		})
	);
}

beforeEach(() => {
	useStore.setState({ assuranceCase: buildCase() });
});

afterEach(() => {
	useStore.setState({ assuranceCase: null });
});

function cardFor(type: "property" | "strategy", id: string): Node {
	return {
		id: `${type}-${id}`,
		type,
		position: { x: 0, y: 0 },
		data: { id },
	};
}

describe("Add Property Claim from a card beneath a counter-goal", () => {
	it.each([
		["a claim", cardFor("property", CLAIM_ID), CLAIM_ID],
		["a strategy", cardFor("strategy", STRATEGY_ID), STRATEGY_ID],
	])("puts the new claim beneath %s in the store", async (_label, node, parentId) => {
		mockElementsRoute();
		const { result } = renderHook(() =>
			useNewLinkForm({
				node,
				linkType: "claim",
				actions: {
					setSelectedLink: vi.fn(),
					setLinkToCreate: vi.fn(),
					handleClose: vi.fn(),
				},
				setUnresolvedChanges: vi.fn(),
			})
		);

		act(() => {
			result.current.form.setValue("description", "A supporting claim");
		});
		await act(async () => {
			await result.current.onSubmit(result.current.form.getValues());
		});
		await waitFor(() => expect(result.current.loading).toBe(false));

		const counterGoal =
			useStore.getState().assuranceCase?.goals?.[0]?.propertyClaims[0]
				?.goals?.[0];
		const parent =
			parentId === CLAIM_ID
				? counterGoal?.propertyClaims[0]
				: counterGoal?.strategies[0];
		expect(parent?.id).toBe(parentId);
		expect(parent?.propertyClaims.map((c) => c.name)).toEqual(["P9"]);
	});
});
