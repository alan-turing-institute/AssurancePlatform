import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useStore from "@/store/store";
import CaseDetails from "../case-details";

// Isolate this test from the case-information data-fetching hook — that
// behaviour has its own dedicated test in case-information-section.test.tsx.
vi.mock("@/hooks/use-case-information", () => ({
	useCaseInformation: () => ({
		information: null,
		loading: false,
		saving: false,
		uploadingImage: false,
		save: vi.fn(),
		uploadFeatureImage: vi.fn(),
		removeFeatureImage: vi.fn(),
	}),
}));

function resetStore(): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test Case",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
		},
	});
}

describe("CaseDetails — shared sheet for both entry points (ADR 0003 §2)", () => {
	beforeEach(() => {
		resetStore();
	});

	it("renders the sheet content, including the Case Information section, when isOpen is true", async () => {
		render(<CaseDetails isOpen={true} setOpen={vi.fn()} />);

		// The skeleton-while-mounting branch resolves on the next tick.
		expect(
			await screen.findByRole("heading", { name: "Case Information" })
		).toBeInTheDocument();
	});
});
