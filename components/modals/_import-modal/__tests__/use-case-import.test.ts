import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	mockPush,
	resetNavigationMocks,
} from "@/src/__tests__/mocks/next-navigation-mocks";
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

/**
 * A successful import that ALSO carries warnings (e.g. a legacy defeater
 * name renumbered on the way in) used to close the modal and navigate in
 * the same tick `warnings` was set — the "Import warnings" banner never
 * had a chance to render before the modal (and its DOM) were gone (QA
 * finding, 2026-09-15). Navigation must now wait for `continueToCase`.
 */
describe("useCaseImport — warnings hold navigation open (QA finding, 2026-09-15)", () => {
	beforeEach(() => {
		resetNavigationMocks();
	});

	it("does not navigate or close when a successful import also carries warnings", async () => {
		const onClose = vi.fn();
		server.use(
			http.post("/api/cases/import", () =>
				HttpResponse.json(
					{
						id: "case-1",
						name: "Imported Case",
						warnings: ["A legacy defeater name was renumbered on import."],
					},
					{ status: 200 }
				)
			)
		);

		const { result } = renderHook(() =>
			useCaseImport({ isOpen: true, onClose })
		);

		await act(async () => {
			await result.current.importCase({ some: "json" });
		});

		await waitFor(() =>
			expect(result.current.warnings).toEqual([
				"A legacy defeater name was renumbered on import.",
			])
		);
		expect(result.current.pendingCaseId).toBe("case-1");
		expect(onClose).not.toHaveBeenCalled();
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("navigates and closes only once continueToCase is called", async () => {
		const onClose = vi.fn();
		server.use(
			http.post("/api/cases/import", () =>
				HttpResponse.json(
					{ id: "case-1", name: "Imported Case", warnings: ["A warning."] },
					{ status: 200 }
				)
			)
		);

		const { result } = renderHook(() =>
			useCaseImport({ isOpen: true, onClose })
		);

		await act(async () => {
			await result.current.importCase({ some: "json" });
		});
		await waitFor(() => expect(result.current.pendingCaseId).toBe("case-1"));

		act(() => {
			result.current.continueToCase();
		});

		expect(onClose).toHaveBeenCalled();
		expect(mockPush).toHaveBeenCalledWith("/case/case-1");
	});

	it("navigates immediately when a successful import carries no warnings", async () => {
		const onClose = vi.fn();
		server.use(
			http.post("/api/cases/import", () =>
				HttpResponse.json(
					{ id: "case-2", name: "Imported Case" },
					{ status: 200 }
				)
			)
		);

		const { result } = renderHook(() =>
			useCaseImport({ isOpen: true, onClose })
		);

		await act(async () => {
			await result.current.importCase({ some: "json" });
		});

		await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/case/case-2"));
		expect(onClose).toHaveBeenCalled();
		expect(result.current.pendingCaseId).toBeNull();
	});
});
