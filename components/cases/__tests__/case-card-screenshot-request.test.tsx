import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CaseCard from "../case-card";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	fetchMock.mockResolvedValue({
		ok: true,
		status: 200,
		json: () => Promise.resolve({ image: "/shot.png" }),
	});
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("CaseCard — the screenshot request", () => {
	it("makes no image request for a case without a screenshot, and shows the default image", async () => {
		const { container } = render(
			<CaseCard
				assuranceCase={{ id: "c1", name: "Plain", hasScreenshot: false }}
			/>
		);

		await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
		expect(container.querySelector("img")?.getAttribute("src")).toContain(
			"assurance-case-medium.png"
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("requests the image for a case that has a screenshot", async () => {
		render(
			<CaseCard
				assuranceCase={{ id: "c2", name: "Shot", hasScreenshot: true }}
			/>
		);

		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith("/api/cases/c2/image")
		);
	});
});
