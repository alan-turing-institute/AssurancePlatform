import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
	IntegrationListItem,
	IssuedTokenResult,
	RotatedTokenResult,
} from "@/lib/schemas/integration";
import { server } from "@/src/__tests__/mocks/server";
import { useIntegrations } from "../use-integrations";

const SECRET_KEY_REGEX = /secret/i;

afterEach(() => {
	vi.restoreAllMocks();
});

function makeIntegration(
	overrides: Partial<IntegrationListItem> = {}
): IntegrationListItem {
	return {
		id: "integration-1",
		name: "darter-evidence-pipeline",
		description: null,
		scopes: ["case:read"],
		status: "ACTIVE",
		createdAt: "2026-06-01T00:00:00.000Z",
		updatedAt: "2026-06-01T00:00:00.000Z",
		lastSeenAt: null,
		tokens: [],
		...overrides,
	};
}

describe("useIntegrations", () => {
	it("starts loading, then resolves to the fetched integrations list", async () => {
		server.use(
			http.get("/api/integrations", () =>
				HttpResponse.json({ integrations: [makeIntegration()] })
			)
		);

		const { result } = renderHook(() => useIntegrations());

		expect(result.current.loading).toBe(true);

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.integrations).toHaveLength(1);
		expect(result.current.integrations[0]?.name).toBe(
			"darter-evidence-pipeline"
		);
		expect(result.current.error).toBeNull();
	});

	it("surfaces the envelope error message when the GET fails", async () => {
		server.use(
			http.get("/api/integrations", () =>
				HttpResponse.json(
					{ error: "Failed to list integrations" },
					{ status: 500 }
				)
			)
		);

		const { result } = renderHook(() => useIntegrations());

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.error).toBe("Failed to list integrations");
		expect(result.current.integrations).toEqual([]);
	});

	describe("registerIntegration", () => {
		it("posts the input, refetches, and resolves true on success", async () => {
			let registered = false;
			server.use(
				http.get("/api/integrations", () =>
					HttpResponse.json({
						integrations: registered ? [makeIntegration()] : [],
					})
				),
				http.post("/api/integrations", async ({ request }) => {
					const body = (await request.json()) as { name: string };
					expect(body.name).toBe("darter-evidence-pipeline");
					registered = true;
					return HttpResponse.json(
						{ integration: makeIntegration() },
						{
							status: 201,
						}
					);
				})
			);

			const { result } = renderHook(() => useIntegrations());
			await waitFor(() => expect(result.current.loading).toBe(false));
			expect(result.current.integrations).toHaveLength(0);

			let success: boolean | undefined;
			await act(async () => {
				success = await result.current.registerIntegration({
					name: "darter-evidence-pipeline",
					scopes: ["case:read"],
				});
			});

			expect(success).toBe(true);
			expect(result.current.integrations).toHaveLength(1);
		});

		it("resolves false and leaves the list unchanged on a 409 name conflict", async () => {
			server.use(
				http.get("/api/integrations", () =>
					HttpResponse.json({ integrations: [] })
				),
				http.post("/api/integrations", () =>
					HttpResponse.json(
						{ error: "An integration with this name already exists" },
						{ status: 409 }
					)
				)
			);

			const { result } = renderHook(() => useIntegrations());
			await waitFor(() => expect(result.current.loading).toBe(false));

			let success: boolean | undefined;
			await act(async () => {
				success = await result.current.registerIntegration({
					name: "darter-evidence-pipeline",
					scopes: ["case:read"],
				});
			});

			expect(success).toBe(false);
			expect(result.current.integrations).toHaveLength(0);
		});
	});

	describe("lifecycle actions", () => {
		it("marks pendingIntegrationId during suspend and clears it after refetch", async () => {
			let status: "ACTIVE" | "SUSPENDED" = "ACTIVE";
			server.use(
				http.get("/api/integrations", () =>
					HttpResponse.json({ integrations: [makeIntegration({ status })] })
				),
				http.post("/api/integrations/integration-1/suspend", () => {
					status = "SUSPENDED";
					return HttpResponse.json({
						integration: makeIntegration({ status }),
					});
				})
			);

			const { result } = renderHook(() => useIntegrations());
			await waitFor(() => expect(result.current.loading).toBe(false));

			expect(result.current.pendingIntegrationId).toBeNull();

			let settled!: Promise<void>;
			act(() => {
				settled = result.current.suspendIntegration("integration-1");
			});

			// The state update from `setPendingIntegrationId` inside the async
			// action only reaches `result.current` once React commits a render —
			// not synchronously on the line after calling it — so this has to be
			// polled rather than read immediately.
			await waitFor(() =>
				expect(result.current.pendingIntegrationId).toBe("integration-1")
			);

			await act(() => settled);

			expect(result.current.pendingIntegrationId).toBeNull();
			expect(result.current.integrations[0]?.status).toBe("SUSPENDED");
		});
	});

	describe("token actions", () => {
		it("issueToken resolves the secret and refetches, without ever storing the secret on the hook's own state", async () => {
			server.use(
				http.get("/api/integrations", () =>
					HttpResponse.json({ integrations: [makeIntegration()] })
				),
				http.post("/api/integrations/integration-1/tokens", () =>
					HttpResponse.json(
						{
							secret: "tea_live_secretvalue",
							token: {
								id: "token-1",
								tokenPrefix: "tea_live_",
								createdAt: "2026-07-05T00:00:00.000Z",
								expiresAt: null,
							},
						},
						{ status: 201 }
					)
				)
			);

			const { result } = renderHook(() => useIntegrations());
			await waitFor(() => expect(result.current.loading).toBe(false));

			let issued!: IssuedTokenResult | null;
			await act(async () => {
				issued = await result.current.issueToken("integration-1");
			});

			expect(issued).not.toBeNull();
			expect(issued?.secret).toBe("tea_live_secretvalue");
			// The hook's own public surface has no field that could hold the
			// secret across renders — it is handed back through the resolved
			// promise only, never assigned to hook state.
			expect(result.current).not.toHaveProperty("secret");
			expect(JSON.stringify(Object.keys(result.current))).not.toMatch(
				SECRET_KEY_REGEX
			);
		});

		it("rotateToken resolves the new secret plus the old token's overlap window", async () => {
			server.use(
				http.get("/api/integrations", () =>
					HttpResponse.json({
						integrations: [
							makeIntegration({
								tokens: [
									{
										id: "token-1",
										tokenPrefix: "tea_live_",
										createdAt: "2026-06-01T00:00:00.000Z",
										lastUsedAt: null,
										expiresAt: null,
										revokedAt: null,
									},
								],
							}),
						],
					})
				),
				http.post("/api/integrations/integration-1/tokens/token-1/rotate", () =>
					HttpResponse.json({
						secret: "tea_live_newsecret",
						token: {
							id: "token-2",
							tokenPrefix: "tea_live_",
							createdAt: "2026-07-05T00:00:00.000Z",
							expiresAt: null,
						},
						oldTokenId: "token-1",
						overlapUntil: "2026-07-05T01:00:00.000Z",
					})
				)
			);

			const { result } = renderHook(() => useIntegrations());
			await waitFor(() => expect(result.current.loading).toBe(false));

			let rotated!: RotatedTokenResult | null;
			await act(async () => {
				rotated = await result.current.rotateToken("integration-1", "token-1");
			});

			expect(rotated?.oldTokenId).toBe("token-1");
			expect(rotated?.overlapUntil).toBe("2026-07-05T01:00:00.000Z");
			expect(rotated?.secret).toBe("tea_live_newsecret");
		});

		it("revokeToken issues the DELETE and refetches", async () => {
			let revokedAt: string | null = null;
			server.use(
				http.get("/api/integrations", () =>
					HttpResponse.json({
						integrations: [
							makeIntegration({
								tokens: [
									{
										id: "token-1",
										tokenPrefix: "tea_live_",
										createdAt: "2026-06-01T00:00:00.000Z",
										lastUsedAt: null,
										expiresAt: null,
										revokedAt,
									},
								],
							}),
						],
					})
				),
				http.delete("/api/integrations/integration-1/tokens/token-1", () => {
					revokedAt = "2026-07-05T00:00:00.000Z";
					return HttpResponse.json({ success: true });
				})
			);

			const { result } = renderHook(() => useIntegrations());
			await waitFor(() => expect(result.current.loading).toBe(false));

			await act(async () => {
				await result.current.revokeToken("integration-1", "token-1");
			});

			expect(result.current.integrations[0]?.tokens[0]?.revokedAt).toBe(
				"2026-07-05T00:00:00.000Z"
			);
		});
	});
});
