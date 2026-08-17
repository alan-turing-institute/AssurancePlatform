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
const FINANCIAL_SERVICES_OPTION_PATTERN = /^financial services$/i;
const FINANCIAL_SERVICES_PATTERN = /financial services/i;
const HEALTHCARE_LEGACY_OPTION_PATTERN = /healthcare \(legacy value\)/i;
const AUTHOR_HELPER_TEXT_PATTERN = /press enter to add an author as a tag/i;
const REMOVE_ADA_LOVELACE_PATTERN = /remove ada lovelace/i;

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

	it("keeps unsaved Authors and Sector edits intact across a feature-image upload response", async () => {
		const uploadFeatureImage = vi.fn().mockResolvedValue(true);
		const baseHookReturn = {
			information: {
				description: "Original description",
				authors: "Grace Hopper",
				sector: "Defence",
				featureImageUrl: null,
			},
			loading: false,
			saving: false,
			uploadingImage: false,
			save: vi.fn().mockResolvedValue(true),
			uploadFeatureImage,
			removeFeatureImage: vi.fn().mockResolvedValue(true),
		};
		stubHook(baseHookReturn);
		const user = userEvent.setup();

		const { rerender } = render(
			<CaseInformationSection canEdit={true} caseId="case-1" />
		);
		await screen.findByTestId("case-information-form");

		// Edit both fields without saving.
		const authorsInput = screen.getByPlaceholderText("e.g. Ada Lovelace");
		await user.type(authorsInput, "Ada Lovelace{Enter}");
		expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();

		await user.click(screen.getByRole("combobox"));
		await user.click(
			screen.getByRole("option", { name: FINANCIAL_SERVICES_OPTION_PATTERN })
		);
		expect(screen.getByRole("combobox")).toHaveTextContent(
			FINANCIAL_SERVICES_PATTERN
		);

		// Simulate the upload response: `useCaseInformation` sets `information`
		// from the *previous* (pre-upload) server-side authors/sector plus the
		// new feature image URL — this is exactly what wiped the form before
		// the fix, because the component used to `reset()` the whole form
		// whenever `information` changed.
		mockedUseCaseInformation.mockReturnValue({
			...baseHookReturn,
			information: {
				...baseHookReturn.information,
				featureImageUrl: "https://example.com/uploaded.png",
			},
		});
		rerender(<CaseInformationSection canEdit={true} caseId="case-1" />);

		expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
		expect(screen.getByRole("combobox")).toHaveTextContent(
			FINANCIAL_SERVICES_PATTERN
		);
	});

	it("tolerates a legacy free-text sector value not in the canonical list", async () => {
		stubHook({
			information: {
				description: "Original description",
				authors: "Grace Hopper",
				sector: "Healthcare",
				featureImageUrl: null,
			},
		});
		const user = userEvent.setup();

		render(<CaseInformationSection canEdit={true} caseId="case-1" />);
		await screen.findByTestId("case-information-form");

		const trigger = screen.getByRole("combobox");
		expect(trigger).toHaveTextContent("Healthcare");

		await user.click(trigger);
		expect(
			screen.getByRole("option", { name: HEALTHCARE_LEGACY_OPTION_PATTERN })
		).toBeInTheDocument();
	});

	it("adds and removes author chips via Enter and the remove button, with helper text present", async () => {
		stubHook({
			information: {
				description: "Original description",
				authors: "",
				sector: "",
				featureImageUrl: null,
			},
		});
		const user = userEvent.setup();

		render(<CaseInformationSection canEdit={true} caseId="case-1" />);
		await screen.findByTestId("case-information-form");

		expect(screen.getByText(AUTHOR_HELPER_TEXT_PATTERN)).toBeInTheDocument();

		const authorsInput = screen.getByPlaceholderText("e.g. Ada Lovelace");
		await user.type(authorsInput, "Ada Lovelace{Enter}");
		await user.type(authorsInput, "Grace Hopper{Enter}");

		const tagList = screen.getByTestId("authors-tag-list");
		expect(tagList).toHaveTextContent("Ada Lovelace");
		expect(tagList).toHaveTextContent("Grace Hopper");

		await user.click(
			screen.getByRole("button", { name: REMOVE_ADA_LOVELACE_PATTERN })
		);

		expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
		expect(tagList).toHaveTextContent("Grace Hopper");
	});
});
