import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseInformation } from "@/hooks/use-case-information";
import { CaseInformationSection } from "../case-information-section";

vi.mock("@/hooks/use-case-information", () => ({
	useCaseInformation: vi.fn(),
}));

const mockedUseCaseInformation = vi.mocked(useCaseInformation);
const SAVE_BUTTON_PATTERN = /save/i;
const SAVE_CASE_INFORMATION_BUTTON_PATTERN = /save case information/i;

function stubHook(overrides: Partial<ReturnType<typeof useCaseInformation>>) {
	mockedUseCaseInformation.mockReturnValue({
		information: null,
		loading: false,
		saving: false,
		uploadingImage: false,
		save: vi.fn().mockResolvedValue(true),
		uploadFeatureImage: vi.fn().mockResolvedValue(true),
		removeFeatureImage: vi.fn().mockResolvedValue(true),
		...overrides,
	});
}

describe("CaseInformationSection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows a loading skeleton while the record is being fetched", () => {
		stubHook({ loading: true });

		render(<CaseInformationSection canEdit={true} caseId="case-1" />);

		expect(screen.getByTestId("case-information-loading")).toBeInTheDocument();
	});

	it("renders a read-only view for a user without EDIT permission", () => {
		stubHook({
			information: {
				description: "A worked example",
				authors: "Ada Lovelace",
				sector: "Healthcare",
				featureImageUrl: null,
			},
		});

		render(<CaseInformationSection canEdit={false} caseId="case-1" />);

		expect(screen.getByTestId("case-information-view")).toBeInTheDocument();
		expect(screen.getByText("A worked example")).toBeInTheDocument();
		expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
		expect(screen.getByText("Healthcare")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: SAVE_BUTTON_PATTERN })
		).not.toBeInTheDocument();
	});

	it("renders placeholder copy for empty fields in the read-only view", () => {
		stubHook({ information: null });

		render(<CaseInformationSection canEdit={false} caseId="case-1" />);

		expect(screen.getByText("No description provided.")).toBeInTheDocument();
	});

	it("renders an editable form for a user with EDIT permission and saves on submit", async () => {
		const save = vi.fn().mockResolvedValue(true);
		stubHook({
			information: {
				description: "Original description",
				authors: "Grace Hopper",
				sector: "Defence",
				featureImageUrl: null,
			},
			save,
		});
		const user = userEvent.setup();

		render(<CaseInformationSection canEdit={true} caseId="case-1" />);

		const form = await screen.findByTestId("case-information-form");
		expect(form).toBeInTheDocument();

		const descriptionField = screen.getByLabelText("Description");
		await user.clear(descriptionField);
		await user.type(descriptionField, "Updated description");
		await user.click(
			screen.getByRole("button", {
				name: SAVE_CASE_INFORMATION_BUTTON_PATTERN,
			})
		);

		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({ description: "Updated description" })
		);
	});
});
