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
			// what createAssuranceCaseNode (lib/case/api.ts) expects.
			return HttpResponse.json(
				{
					id: "evidence-1",
					...parsed.data,
					propertyClaimId: body.propertyClaimId,
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

const CASE_WITH_CLAIM = {
	id: "case-1",
	goals: [
		{
			propertyClaims: [{ id: "claim-1", propertyClaims: [], evidence: [] }],
			strategies: [],
		},
	],
} as unknown as AssuranceCaseResponse;

function setup() {
	return renderHook(() =>
		useNewLinkForm({
			node: NODE,
			linkType: "evidence",
			actions: {
				setSelectedLink: vi.fn(),
				setLinkToCreate: vi.fn(),
				handleClose: vi.fn(),
			},
			setUnresolvedChanges: vi.fn(),
		})
	);
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
