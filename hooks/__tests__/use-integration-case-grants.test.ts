import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IntegrationCaseGrant } from "@/lib/schemas/integration";
import { server } from "@/src/__tests__/mocks/server";
import { useIntegrationCaseGrants } from "../use-integration-case-grants";

const INTEGRATION_ID = "integration-1";
const CASE_GRANTS_PATH = `/api/integrations/${INTEGRATION_ID}/case-grants`;

afterEach(() => {
	vi.restoreAllMocks();
});

function makeGrant(
	overrides: Partial<IntegrationCaseGrant> = {}
): IntegrationCaseGrant {
	return {
		caseId: "case-1",
		caseName: "DARTER Demo — Automated Inspection",
		permission: "EDIT",
		grantedAt: "2026-07-10T00:00:00.000Z",
		...overrides,
	};
}

describe("useIntegrationCaseGrants", () => {
	it("starts loading, then resolves to the fetched grants list", async () => {
		server.use(
			http.get(CASE_GRANTS_PATH, () =>
				HttpResponse.json({ grants: [makeGrant()] })
			)
		);

		const { result } = renderHook(() =>
			useIntegrationCaseGrants(INTEGRATION_ID)
		);

		expect(result.current.loading).toBe(true);

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.grants).toHaveLength(1);
		expect(result.current.grants[0]?.caseName).toBe(
			"DARTER Demo — Automated Inspection"
		);
		expect(result.current.loadError).toBeNull();
	});

	it("surfaces the envelope error message when the GET fails", async () => {
		server.use(
			http.get(CASE_GRANTS_PATH, () =>
				HttpResponse.json(
					{ error: "Failed to list case grants" },
					{ status: 500 }
				)
			)
		);

		const { result } = renderHook(() =>
			useIntegrationCaseGrants(INTEGRATION_ID)
		);

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.loadError).toBe("Failed to list case grants");
		expect(result.current.grants).toEqual([]);
	});

	describe("grantAccess", () => {
		it("posts the grant, refetches, and resolves true on success", async () => {
			let granted = false;
			server.use(
				http.get(CASE_GRANTS_PATH, () =>
					HttpResponse.json({ grants: granted ? [makeGrant()] : [] })
				),
				http.post(CASE_GRANTS_PATH, async ({ request }) => {
					const body = (await request.json()) as {
						caseId: string;
						permission: string;
					};
					expect(body).toEqual({ caseId: "case-1", permission: "EDIT" });
					granted = true;
					return HttpResponse.json(
						{ grant: { ...makeGrant(), alreadyGranted: false } },
						{ status: 201 }
					);
				})
			);

			const { result } = renderHook(() =>
				useIntegrationCaseGrants(INTEGRATION_ID)
			);
			await waitFor(() => expect(result.current.loading).toBe(false));
			expect(result.current.grants).toHaveLength(0);

			let success: boolean | undefined;
			await act(async () => {
				success = await result.current.grantAccess("case-1", "EDIT");
			});

			expect(success).toBe(true);
			expect(result.current.grants).toHaveLength(1);
			expect(result.current.grantError).toBeNull();
		});

		it("maps a 409 to a fixed, faithful 'integration must be ACTIVE' message", async () => {
			server.use(
				http.get(CASE_GRANTS_PATH, () => HttpResponse.json({ grants: [] })),
				http.post(CASE_GRANTS_PATH, () =>
					HttpResponse.json(
						{ error: "Cannot grant case access for a non-active integration" },
						{ status: 409 }
					)
				)
			);

			const { result } = renderHook(() =>
				useIntegrationCaseGrants(INTEGRATION_ID)
			);
			await waitFor(() => expect(result.current.loading).toBe(false));

			let success: boolean | undefined;
			await act(async () => {
				success = await result.current.grantAccess("case-1", "EDIT");
			});

			expect(success).toBe(false);
			expect(result.current.grantError).toBe(
				"This integration must be ACTIVE before it can be granted access to a case. Reactivate it, then try again."
			);
			expect(result.current.grants).toHaveLength(0);
		});

		it("maps a 404 to a generic 'case not found' message, whatever the server's own wording", async () => {
			server.use(
				http.get(CASE_GRANTS_PATH, () => HttpResponse.json({ grants: [] })),
				http.post(CASE_GRANTS_PATH, () =>
					HttpResponse.json({ error: "Case not found" }, { status: 404 })
				)
			);

			const { result } = renderHook(() =>
				useIntegrationCaseGrants(INTEGRATION_ID)
			);
			await waitFor(() => expect(result.current.loading).toBe(false));

			let success: boolean | undefined;
			await act(async () => {
				success = await result.current.grantAccess("case-1", "EDIT");
			});

			expect(success).toBe(false);
			expect(result.current.grantError).toBe(
				"Case not found. Check that the case still exists and that you hold admin access to it."
			);
		});

		it("clears a previous grantError at the start of the next attempt", async () => {
			let attempt = 0;
			server.use(
				http.get(CASE_GRANTS_PATH, () => HttpResponse.json({ grants: [] })),
				http.post(CASE_GRANTS_PATH, () => {
					attempt += 1;
					if (attempt === 1) {
						return HttpResponse.json(
							{ error: "Case not found" },
							{ status: 404 }
						);
					}
					return HttpResponse.json(
						{ grant: { ...makeGrant(), alreadyGranted: false } },
						{ status: 201 }
					);
				})
			);

			const { result } = renderHook(() =>
				useIntegrationCaseGrants(INTEGRATION_ID)
			);
			await waitFor(() => expect(result.current.loading).toBe(false));

			await act(async () => {
				await result.current.grantAccess("case-1", "EDIT");
			});
			expect(result.current.grantError).not.toBeNull();

			await act(async () => {
				await result.current.grantAccess("case-1", "EDIT");
			});
			expect(result.current.grantError).toBeNull();
		});
	});

	describe("removeAccess", () => {
		it("issues the DELETE and refetches", async () => {
			let grants = [makeGrant()];
			server.use(
				http.get(CASE_GRANTS_PATH, () => HttpResponse.json({ grants })),
				http.delete(`${CASE_GRANTS_PATH}/case-1`, () => {
					grants = [];
					return HttpResponse.json({ success: true });
				})
			);

			const { result } = renderHook(() =>
				useIntegrationCaseGrants(INTEGRATION_ID)
			);
			await waitFor(() => expect(result.current.loading).toBe(false));
			expect(result.current.grants).toHaveLength(1);

			await act(async () => {
				await result.current.removeAccess("case-1");
			});

			expect(result.current.grants).toHaveLength(0);
			expect(result.current.removingCaseId).toBeNull();
		});

		it("leaves the grant in place when the DELETE fails — the row persists through a failed removal cycle (nanaki G3 probe)", async () => {
			server.use(
				http.get(CASE_GRANTS_PATH, () =>
					HttpResponse.json({ grants: [makeGrant()] })
				),
				http.delete(`${CASE_GRANTS_PATH}/case-1`, () =>
					HttpResponse.json(
						{ error: "Failed to remove case access" },
						{ status: 500 }
					)
				)
			);

			const { result } = renderHook(() =>
				useIntegrationCaseGrants(INTEGRATION_ID)
			);
			await waitFor(() => expect(result.current.loading).toBe(false));
			expect(result.current.grants).toHaveLength(1);

			await act(async () => {
				await result.current.removeAccess("case-1");
			});

			// No refetch was ever triggered by the failed DELETE (`load()` only
			// runs in the `try` block, on success), so the grant that was never
			// actually removed server-side stays visible rather than vanishing
			// from a state the client never confirmed.
			expect(result.current.grants).toHaveLength(1);
			expect(result.current.grants[0]?.caseId).toBe("case-1");
			expect(result.current.removingCaseId).toBeNull();
		});
	});
});
