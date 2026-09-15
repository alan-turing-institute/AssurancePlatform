import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { extractErrorMessage, useCaseImport } from "../use-case-import";

/**
 * The import dialog's error surfacing (walkthrough finding 16): a
 * schema-rejected file must show the validator's path and message, not
 * only "not a valid case". `POST /api/cases/import` (route.ts) returns
 * `validationErrors` as a top-level array of pre-formatted "path: message"
 * strings; `extractErrorMessage` joins them into the text the modal
 * renders (`components/modals/import-modal.tsx`'s `{error}` block).
 */
describe("extractErrorMessage (import dialog)", () => {
	it("names the offending field and reason when the API returns validationErrors", () => {
		const message = extractErrorMessage({
			error: "Invalid import data",
			validationErrors: [
				"tree.children[0].children[0].children[0].defeatsElementId: Invalid uuid",
			],
		});

		expect(message).toBe(
			"Validation failed: tree.children[0].children[0].children[0].defeatsElementId: Invalid uuid"
		);
	});

	it("falls back to the generic message when there are no validationErrors", () => {
		const message = extractErrorMessage({ error: "not a valid case" });

		expect(message).toBe("not a valid case");
	});
});

describe("useCaseImport (import dialog)", () => {
	it("surfaces the route's validationErrors as the dialog's error state", async () => {
		server.use(
			http.post("/api/cases/import", () =>
				HttpResponse.json(
					{
						error: "Invalid import data",
						code: "VALIDATION",
						validationErrors: [
							"tree.children[0].children[0].children[0].defeatsElementId: Invalid uuid",
						],
					},
					{ status: 400 }
				)
			)
		);

		const { result } = renderHook(() =>
			useCaseImport({ isOpen: true, onClose: () => undefined })
		);

		await act(async () => {
			await result.current.importCase({ some: "json" });
		});

		await waitFor(() =>
			expect(result.current.error).toBe(
				"Validation failed: tree.children[0].children[0].children[0].defeatsElementId: Invalid uuid"
			)
		);
	});
});
