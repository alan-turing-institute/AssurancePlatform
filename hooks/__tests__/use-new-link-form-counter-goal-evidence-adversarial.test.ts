import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElementSchema } from "@/lib/schemas/element";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import { toast } from "@/lib/toast";
import { server } from "@/src/__tests__/mocks/server";
import useStore from "@/store/store";
import { useNewLinkForm } from "../use-new-link-form";

/**
 * Evidence added to a claim that supports a counter-goal is created like any
 * other: the form closes without an error. The claim sits beneath the
 * counter-goal in the store, not beneath the top goal's own claims.
 */

const TOP_GOAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COUNTER_GOAL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLAIM_UNDER_COUNTER_GOAL_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CLAIM_UNDER_TOP_GOAL_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const NESTED_CLAIM_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function emptyClaim(id: string, nested: unknown[] = []) {
	return {
		id,
		type: "property_claim",
		propertyClaims: nested,
		strategies: [],
		evidence: [],
	};
}

function buildCase(): AssuranceCaseResponse {
	return {
		id: "case-1",
		goals: [
			{
				id: TOP_GOAL_ID,
				type: "goal",
				strategies: [],
				propertyClaims: [emptyClaim(CLAIM_UNDER_TOP_GOAL_ID)],
				goals: [
					{
						id: COUNTER_GOAL_ID,
						type: "goal",
						isDefeater: true,
						strategies: [],
						propertyClaims: [
							emptyClaim(CLAIM_UNDER_COUNTER_GOAL_ID, [
								emptyClaim(NESTED_CLAIM_ID),
							]),
						],
					},
				],
			},
		],
	} as unknown as AssuranceCaseResponse;
}

function mockElementsRoute() {
	let calls = 0;
	server.use(
		http.post("/api/cases/:caseId/elements", async ({ request }) => {
			calls += 1;
			const body = (await request.json()) as Record<string, unknown>;
			const parsed = createElementSchema.safeParse(body);
			if (!parsed.success) {
				return HttpResponse.json({ error: "Invalid input" }, { status: 400 });
			}
			return HttpResponse.json(
				{
					id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
					...parsed.data,
					propertyClaimId: [body.parentId],
					name: "E1",
				},
				{ status: 201 }
			);
		})
	);
	return { getCalls: () => calls };
}

beforeEach(() => {
	vi.mocked(toast).mockClear();
	useStore.setState({ assuranceCase: buildCase() });
});

afterEach(() => {
	vi.restoreAllMocks();
	useStore.setState({ assuranceCase: null });
});

describe("Add Evidence on a claim", () => {
	it.each([
		["under the top goal", CLAIM_UNDER_TOP_GOAL_ID],
		["under a counter-goal", CLAIM_UNDER_COUNTER_GOAL_ID],
		["under another claim beneath a counter-goal", NESTED_CLAIM_ID],
	])("closes the form without an error when the claim is %s", async (_label, claimId) => {
		const route = mockElementsRoute();
		const handleClose = vi.fn();
		const node: Node = {
			id: `property-${claimId}`,
			type: "property",
			position: { x: 0, y: 0 },
			data: { id: claimId },
		};
		const { result } = renderHook(() =>
			useNewLinkForm({
				node,
				linkType: "evidence",
				actions: {
					setSelectedLink: vi.fn(),
					setLinkToCreate: vi.fn(),
					handleClose,
				},
				setUnresolvedChanges: vi.fn(),
			})
		);

		act(() => {
			result.current.form.setValue("description", "Evidence for the claim");
			result.current.form.setValue("urls.0.value", "example.com/report.pdf");
		});
		await act(async () => {
			await result.current.onSubmit(result.current.form.getValues());
		});
		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(route.getCalls()).toBe(1);
		expect(vi.mocked(toast)).not.toHaveBeenCalled();
		expect(handleClose).toHaveBeenCalled();
	});
});
