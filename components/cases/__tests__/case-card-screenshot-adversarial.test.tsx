import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CaseCard, { type CaseCardData } from "../case-card";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

/**
 * A card makes no image request for a case that has no screenshot, shows the
 * default image, and still fetches and shows a stored screenshot.
 */

const DEFAULT_IMAGE = "/images/assurance-case-medium.png";
const STORED = "data:image/png;base64,AAAA";
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn().mockResolvedValue({
		ok: true,
		status: 200,
		json: async () => ({ image: STORED }),
	});
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function imageRequests(): string[] {
	return fetchMock.mock.calls
		.map((call) => String(call[0]))
		.filter((url) => url.endsWith("/image"));
}

function card(overrides: Partial<CaseCardData>) {
	return (
		<CaseCard
			assuranceCase={{
				id: 7,
				name: "Shot case",
				permissions: "view",
				...overrides,
			}}
		/>
	);
}

describe("CaseCard screenshot", () => {
	it.each([
		"view",
		"owner",
	])("makes no image request when there is no screenshot (%s)", async (permissions) => {
		render(card({ hasScreenshot: false, permissions }));

		await waitFor(() =>
			expect(screen.getByRole("img").getAttribute("src")).toContain(
				"assurance-case-medium"
			)
		);
		expect(imageRequests()).toEqual([]);
	});

	it("requests and shows the stored screenshot when there is one", async () => {
		render(card({ hasScreenshot: true }));

		await waitFor(() =>
			expect(screen.getByRole("img").getAttribute("src")).toContain("AAAA")
		);
		expect(imageRequests()).toEqual(["/api/cases/7/image"]);
	});

	it("still requests the screenshot when the flag is absent", async () => {
		render(card({}));

		await waitFor(() => expect(imageRequests()).toHaveLength(1));
	});

	it("goes back to the default image, with no request, when the screenshot is removed", async () => {
		const { rerender } = render(card({ hasScreenshot: true }));
		await waitFor(() =>
			expect(screen.getByRole("img").getAttribute("src")).toContain("AAAA")
		);
		fetchMock.mockClear();

		rerender(card({ hasScreenshot: false }));

		await waitFor(() =>
			expect(screen.getByRole("img").getAttribute("src")).toContain(
				"assurance-case-medium"
			)
		);
		expect(imageRequests()).toEqual([]);
		expect(DEFAULT_IMAGE).toContain("assurance-case-medium");
	});
});
