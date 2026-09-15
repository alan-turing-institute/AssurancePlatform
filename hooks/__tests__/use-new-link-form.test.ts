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
 * Mimics the real POST /api/cases/[id]/elements route: validates the body
 * with the actual createElementSchema and returns the same shape of
 * success/error response. This is what lets these tests prove the plain
 * -English message from lib/schemas/base.ts's lenientUrlSchema actually
 * reaches the evidence-creation toast a user sees, not just the schema
 * in isolation.
 */
function mockElementsRoute() {
	let receivedBody: Record<string, unknown> | undefined;
	server.use(
		http.post("/api/cases/:caseId/elements", async ({ request }) => {
			const body = (await request.json()) as Record<string, unknown>;
			receivedBody = body;
			const parsed = createElementSchema.safeParse(body);
			if (!parsed.success) {
				return HttpResponse.json(
					{ error: parsed.error.issues[0]?.message ?? "Invalid input" },
					{ status: 400 }
				);
			}
			// apiSuccess() returns the element flat (no envelope) — matches
			// what createAssuranceCaseNode (lib/case/api.ts) expects. Mirrors
			// element-service.ts's real response shape: propertyClaimId is
			// derived from the request's parentId (the evidence link target),
			// not sent as its own field.
			return HttpResponse.json(
				{
					id: "evidence-1",
					...parsed.data,
					propertyClaimId: [body.parentId],
					name: "E1",
				},
				{ status: 201 }
			);
		})
	);
	return {
		getReceivedBody: () => receivedBody,
	};
}

const NODE: Node = {
	id: "1",
	type: "property",
	position: { x: 0, y: 0 },
	data: { id: "claim-1" },
};

// A strategy node - for the createStrategyPayload/createPropertyClaimItem
// branches keyed on node.type === "strategy".
const STRATEGY_NODE: Node = {
	id: "2",
	type: "strategy",
	position: { x: 0, y: 0 },
	data: { id: "strategy-1" },
};

// A goal node - exercises the default/goal branch of createStrategyPayload
// and createPropertyClaimItem, where parentId comes from
// assuranceCase.goals[0].id rather than node.data.id.
const GOAL_NODE: Node = {
	id: "3",
	type: "goal",
	position: { x: 0, y: 0 },
	data: { id: "goal-1" },
};

const CASE_WITH_CLAIM = {
	id: "case-1",
	goals: [
		{
			id: "goal-1",
			propertyClaims: [{ id: "claim-1", propertyClaims: [], evidence: [] }],
			strategies: [],
		},
	],
} as unknown as AssuranceCaseResponse;

function setup(overrides: { node?: Node; linkType?: string } = {}) {
	return renderHook(() =>
		useNewLinkForm({
			node: overrides.node ?? NODE,
			linkType: overrides.linkType ?? "evidence",
			actions: {
				setSelectedLink: vi.fn(),
				setLinkToCreate: vi.fn(),
				handleClose: vi.fn(),
			},
			setUnresolvedChanges: vi.fn(),
		})
	);
}

/** Submits the description-only form (context/claim/strategy paths - no urls field). */
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

beforeEach(() => {
	useStore.setState({ assuranceCase: CASE_WITH_CLAIM });
});

afterEach(() => {
	vi.restoreAllMocks();
	useStore.setState({ assuranceCase: null });
});

describe("useNewLinkForm — evidence URL submission", () => {
	it("accepts a bare domain, sending it as typed and normalising it server-side to https://", async () => {
		const { getReceivedBody } = mockElementsRoute();
		const { result } = setup();

		act(() => {
			result.current.form.setValue("urls.0.value", "example.com/report.pdf");
		});

		await act(async () => {
			await result.current.onSubmit(result.current.form.getValues());
		});

		await waitFor(() => expect(result.current.loading).toBe(false));

		// The client sends the bare domain exactly as typed — normalisation
		// is the schema's job, not the form's.
		expect(getReceivedBody()?.urls).toEqual(["example.com/report.pdf"]);
		expect(vi.mocked(toast)).not.toHaveBeenCalled();
	});

	it("surfaces the plain-English message when the address is genuinely invalid", async () => {
		mockElementsRoute();
		const { result } = setup();

		act(() => {
			result.current.form.setValue("urls.0.value", "not a url at all");
		});

		await act(async () => {
			await result.current.onSubmit(result.current.form.getValues());
		});

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(vi.mocked(toast)).toHaveBeenCalledWith(
			expect.objectContaining({
				variant: "destructive",
				description: "Enter a web address, such as example.com/report.pdf",
			})
		);
	});
});

/**
 * Each rewritten payload builder (TEA — Mutation-schema hardening, commit
 * 00a77f7e) sends a narrow named shape — { description, parentId,
 * assuranceCaseId } — instead of legacy relationship keys (goalId/
 * strategyId/propertyClaimId). These pin that every branch of every
 * builder still resolves parentId correctly and produces a body the real
 * createElementSchema accepts (via mockElementsRoute's real-schema check,
 * same as the evidence describe block above) — no DB, mocked fetch only.
 */
describe("useNewLinkForm — rewritten payload builders (parentId resolution)", () => {
	it("handleContextAdd sends parentId = the goal's id (context is always attached under the goal)", async () => {
		const { getReceivedBody } = mockElementsRoute();
		const { result } = setup({ node: GOAL_NODE, linkType: "context" });

		await submitDescription(result, "A context description");

		const body = getReceivedBody();
		expect(body).toBeDefined();
		expect(body?.parentId).toBe("goal-1");
	});

	it("createStrategyPayload sends parentId = node.data.id when node.type is 'property'", async () => {
		const { getReceivedBody } = mockElementsRoute();
		const { result } = setup({ node: NODE, linkType: "strategy" });

		await submitDescription(result, "A strategy description");

		const body = getReceivedBody();
		expect(body).toBeDefined();
		expect(body?.parentId).toBe("claim-1");
	});

	it("createStrategyPayload sends parentId = the goal's id for the goal/default branch", async () => {
		const { getReceivedBody } = mockElementsRoute();
		const { result } = setup({ node: GOAL_NODE, linkType: "strategy" });

		await submitDescription(result, "A strategy description");

		const body = getReceivedBody();
		expect(body).toBeDefined();
		expect(body?.parentId).toBe("goal-1");
	});

	it("createPropertyClaimItem sends parentId = node.data.id for the strategy branch", async () => {
		const { getReceivedBody } = mockElementsRoute();
		const { result } = setup({ node: STRATEGY_NODE, linkType: "claim" });

		await submitDescription(result, "A property claim description");

		const body = getReceivedBody();
		expect(body).toBeDefined();
		expect(body?.parentId).toBe("strategy-1");
	});

	it("createPropertyClaimItem sends parentId = node.data.id for the property branch", async () => {
		const { getReceivedBody } = mockElementsRoute();
		const { result } = setup({ node: NODE, linkType: "claim" });

		await submitDescription(result, "A property claim description");

		const body = getReceivedBody();
		expect(body).toBeDefined();
		expect(body?.parentId).toBe("claim-1");
	});

	it("createPropertyClaimItem sends parentId = the goal's id for the goal/default branch", async () => {
		const { getReceivedBody } = mockElementsRoute();
		const { result } = setup({ node: GOAL_NODE, linkType: "claim" });

		await submitDescription(result, "A property claim description");

		const body = getReceivedBody();
		expect(body).toBeDefined();
		expect(body?.parentId).toBe("goal-1");
	});
});

// defeatsElementId is zod-validated as a UUID (lib/schemas/element.ts) —
// unlike the shared NODE/STRATEGY_NODE/GOAL_NODE fixtures above (whose
// data.id values are plain test strings, fine for parentId but not for a
// UUID-constrained field), these fixtures use UUID-shaped ids so
// handleDefeaterAdd's real payload passes the real schema the mocked route
// validates against.
const CLAIM_NODE_UUID: Node = {
	id: "1",
	type: "property",
	position: { x: 0, y: 0 },
	data: { id: "11111111-1111-4111-8111-111111111111" },
};
const STRATEGY_NODE_UUID: Node = {
	id: "2",
	type: "strategy",
	position: { x: 0, y: 0 },
	data: { id: "22222222-2222-4222-8222-222222222222" },
};
const GOAL_NODE_UUID: Node = {
	id: "3",
	type: "goal",
	position: { x: 0, y: 0 },
	data: { id: "33333333-3333-4333-8333-333333333333" },
};

describe("useNewLinkForm — handleDefeaterAdd (ADR 0005 D7)", () => {
	it("sends isDefeater: true and defeatsElementId = the element the menu was opened on, as both parentId and defeatsElementId", async () => {
		const { getReceivedBody } = mockElementsRoute();
		const { result } = setup({ node: CLAIM_NODE_UUID, linkType: "defeater" });

		await submitDescription(result, "This challenges the claim");

		const body = getReceivedBody();
		expect(body).toBeDefined();
		expect(body?.isDefeater).toBe(true);
		expect(body?.defeatsElementId).toBe(CLAIM_NODE_UUID.data.id);
		expect(body?.parentId).toBe(CLAIM_NODE_UUID.data.id);
		expect(body?.type).toBe("property_claim");
	});

	it("works from a goal, a strategy, or a property claim — the menu can open on any of the three", async () => {
		for (const node of [GOAL_NODE_UUID, STRATEGY_NODE_UUID, CLAIM_NODE_UUID]) {
			const { getReceivedBody } = mockElementsRoute();
			const { result } = setup({ node, linkType: "defeater" });

			await submitDescription(result, "A counter-claim");

			const body = getReceivedBody();
			expect(body?.defeatsElementId).toBe(node.data.id);
		}
	});

	it("shows a destructive toast and does not throw when creation fails", async () => {
		server.use(
			http.post("/api/cases/:caseId/elements", () =>
				HttpResponse.json({ error: "Failed" }, { status: 400 })
			)
		);
		const { result } = setup({ node: CLAIM_NODE_UUID, linkType: "defeater" });

		await submitDescription(result, "This challenges the claim");

		expect(toast).toHaveBeenCalledWith(
			expect.objectContaining({
				variant: "destructive",
				description: "Failed to create defeater",
			})
		);
	});
});
