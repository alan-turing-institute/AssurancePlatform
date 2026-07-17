import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { useCaseInformation } from "../use-case-information";

const CASE_ID = "case-1";
const INFORMATION_PATH = `/api/cases/${CASE_ID}/information`;
const IMAGE_PATH = `/api/cases/${CASE_ID}/information/image`;

afterEach(() => {
	vi.restoreAllMocks();
});

describe("useCaseInformation", () => {
	it("starts loading, then resolves the fetched record", async () => {
		server.use(
			http.get(INFORMATION_PATH, () =>
				HttpResponse.json({
					description: "A worked example",
					authors: "Ada Lovelace",
					sector: "Healthcare",
					featureImageUrl: null,
				})
			)
		);

		const { result } = renderHook(() => useCaseInformation(CASE_ID));

		expect(result.current.loading).toBe(true);
		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.information?.description).toBe("A worked example");
	});

	it("resolves to null information when the case has none yet", async () => {
		server.use(http.get(INFORMATION_PATH, () => HttpResponse.json(null)));

		const { result } = renderHook(() => useCaseInformation(CASE_ID));

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.information).toBeNull();
	});

	it("does not fetch when caseId is undefined", async () => {
		const { result } = renderHook(() => useCaseInformation(undefined));

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.information).toBeNull();
	});

	it("save() PUTs the values and updates local state on success", async () => {
		server.use(
			http.get(INFORMATION_PATH, () => HttpResponse.json(null)),
			http.put(INFORMATION_PATH, () =>
				HttpResponse.json({
					description: "New description",
					authors: null,
					sector: null,
					featureImageUrl: null,
				})
			)
		);

		const { result } = renderHook(() => useCaseInformation(CASE_ID));
		await waitFor(() => expect(result.current.loading).toBe(false));

		let saveResult: boolean | undefined;
		await act(async () => {
			saveResult = await result.current.save({
				description: "New description",
			});
		});

		expect(saveResult).toBe(true);
		expect(result.current.information?.description).toBe("New description");
	});

	it("save() returns false and leaves state untouched when the PUT fails", async () => {
		server.use(
			http.get(INFORMATION_PATH, () => HttpResponse.json(null)),
			http.put(INFORMATION_PATH, () =>
				HttpResponse.json({ error: "Permission denied" }, { status: 403 })
			)
		);

		const { result } = renderHook(() => useCaseInformation(CASE_ID));
		await waitFor(() => expect(result.current.loading).toBe(false));

		let saveResult: boolean | undefined;
		await act(async () => {
			saveResult = await result.current.save({ description: "x" });
		});

		expect(saveResult).toBe(false);
		expect(result.current.information).toBeNull();
	});

	it("uploadFeatureImage() POSTs the file and merges the returned URL into state", async () => {
		server.use(
			http.get(INFORMATION_PATH, () =>
				HttpResponse.json({
					description: "Existing",
					authors: null,
					sector: null,
					featureImageUrl: null,
				})
			),
			http.post(IMAGE_PATH, () =>
				HttpResponse.json({ featureImageUrl: "/uploads/cases/new.png" })
			)
		);

		const { result } = renderHook(() => useCaseInformation(CASE_ID));
		await waitFor(() => expect(result.current.loading).toBe(false));

		const file = new File(["x"], "feature.png", { type: "image/png" });
		let uploadResult: boolean | undefined;
		await act(async () => {
			uploadResult = await result.current.uploadFeatureImage(file);
		});

		expect(uploadResult).toBe(true);
		expect(result.current.information?.featureImageUrl).toBe(
			"/uploads/cases/new.png"
		);
		// Fields untouched by the image upload are preserved.
		expect(result.current.information?.description).toBe("Existing");
	});

	it("removeFeatureImage() DELETEs and clears the URL from state", async () => {
		server.use(
			http.get(INFORMATION_PATH, () =>
				HttpResponse.json({
					description: null,
					authors: null,
					sector: null,
					featureImageUrl: "/uploads/cases/old.png",
				})
			),
			http.delete(IMAGE_PATH, () => HttpResponse.json({ success: true }))
		);

		const { result } = renderHook(() => useCaseInformation(CASE_ID));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.information?.featureImageUrl).toBe(
			"/uploads/cases/old.png"
		);

		let removeResult: boolean | undefined;
		await act(async () => {
			removeResult = await result.current.removeFeatureImage();
		});

		expect(removeResult).toBe(true);
		expect(result.current.information?.featureImageUrl).toBeNull();
	});
});
