import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAssuranceCase } from "@/actions/assurance-cases";
import {
	createCaseFromPattern,
	fetchViewablePatterns,
} from "@/actions/case-from-pattern";
import type { ViewablePattern } from "@/lib/services/case-from-pattern-service";
import {
	mockPush,
	resetNavigationMocks,
} from "@/src/__tests__/mocks/next-navigation-mocks";
import { CaseCreateModal } from "../case-create-modal";

/**
 * The new-case dialog's three starts: a blank case, a blank pattern, and a
 * case copied from a pattern the user can view. The actions are mocked; what
 * is checked is which one the dialog calls, with what, and where it goes next.
 */
const mockOnClose = vi.fn();

vi.mock("@/hooks/modal-hooks", () => ({
	useCreateCaseModal: () => ({ isOpen: true, onClose: mockOnClose }),
}));

vi.mock("@/actions/assurance-cases", () => ({
	createAssuranceCase: vi.fn(),
}));

vi.mock("@/actions/case-from-pattern", () => ({
	createCaseFromPattern: vi.fn(),
	fetchViewablePatterns: vi.fn(),
}));

const A_BLANK_CASE = /^A blank case/;
const A_BLANK_PATTERN = /^A blank pattern/;
const A_PATTERN = /^A pattern/;
const CLEARED_WARNING = /AG1: cited case not available/;
const CHOOSE_HOW_TO_START =
	"Choose how to start, then enter a name and description.";

const OWN_PATTERN: ViewablePattern = {
	key: "case:pattern-1",
	name: "Own pattern",
	description: "What the own pattern is for",
	origin: "own",
	source: { patternCaseId: "pattern-1" },
};
const PUBLISHED_PATTERN: ViewablePattern = {
	key: "published:a-pattern",
	name: "Published pattern",
	description: "",
	origin: "published",
	source: { publishedSlug: "a-pattern" },
};

async function fillDetails(user: ReturnType<typeof userEvent.setup>) {
	await user.type(screen.getByLabelText("Name"), "My new case");
	await user.type(screen.getByLabelText("Description"), "About the new case");
}

async function startFromPattern(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole("radio", { name: A_PATTERN }));
}

beforeEach(() => {
	vi.clearAllMocks();
	resetNavigationMocks();
	vi.mocked(createAssuranceCase).mockResolvedValue({
		success: true,
		data: { id: "new-case" },
	});
});

describe("CaseCreateModal", () => {
	it("starts a blank case by default and opens it", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);

		expect(screen.getByRole("radio", { name: A_BLANK_CASE })).toBeChecked();
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith("/case/new-case")
		);
		expect(createAssuranceCase).toHaveBeenCalledWith({
			name: "My new case",
			description: "About the new case",
			kind: "CASE",
		});
		expect(mockOnClose).toHaveBeenCalled();
		expect(fetchViewablePatterns).not.toHaveBeenCalled();
	});

	it("starts a blank pattern when asked", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);

		await user.click(screen.getByRole("radio", { name: A_BLANK_PATTERN }));
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith("/case/new-case")
		);
		expect(createAssuranceCase).toHaveBeenCalledWith({
			name: "My new case",
			description: "About the new case",
			kind: "PATTERN",
		});
	});

	it("shows the error an action returns and stays open", async () => {
		const user = userEvent.setup();
		vi.mocked(createAssuranceCase).mockResolvedValue({
			success: false,
			error: "Case name is required",
		});
		render(<CaseCreateModal />);

		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		expect(await screen.findByText("Case name is required")).toBeVisible();
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("lists the patterns, shows the chosen one's description, and starts a case from it", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockResolvedValue([
			OWN_PATTERN,
			PUBLISHED_PATTERN,
		]);
		vi.mocked(createCaseFromPattern).mockResolvedValue({
			success: true,
			data: { id: "copied-case", warnings: [] },
		});
		render(<CaseCreateModal />);

		await startFromPattern(user);
		await user.click(await screen.findByRole("combobox", { name: "Pattern" }));
		expect(screen.getByText("Your patterns")).toBeVisible();
		expect(screen.getByText("Published on Discover")).toBeVisible();
		await user.click(screen.getByRole("option", { name: "Own pattern" }));
		expect(screen.getByText("What the own pattern is for")).toBeVisible();
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith("/case/copied-case")
		);
		expect(createCaseFromPattern).toHaveBeenCalledWith(
			{ patternCaseId: "pattern-1" },
			"My new case",
			"About the new case"
		);
		expect(createAssuranceCase).not.toHaveBeenCalled();
	});

	it("holds the dialog open on what was left out of a copy, and opens the case when asked", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockResolvedValue([PUBLISHED_PATTERN]);
		vi.mocked(createCaseFromPattern).mockResolvedValue({
			success: true,
			data: {
				id: "copied-case",
				warnings: [
					"AG1: cited case not available in this environment; the reference has been cleared",
				],
			},
		});
		render(<CaseCreateModal />);

		await startFromPattern(user);
		await user.click(await screen.findByRole("combobox", { name: "Pattern" }));
		await user.click(screen.getByRole("option", { name: "Published pattern" }));
		expect(screen.getByText("This pattern has no description.")).toBeVisible();
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		expect(await screen.findByText(CLEARED_WARNING)).toBeVisible();
		expect(screen.getByRole("status")).toHaveTextContent(
			"Some things were changed in the copy:"
		);
		expect(screen.queryByText(CHOOSE_HOW_TO_START)).not.toBeInTheDocument();
		expect(mockPush).not.toHaveBeenCalled();
		expect(createCaseFromPattern).toHaveBeenCalledWith(
			{ publishedSlug: "a-pattern" },
			"My new case",
			"About the new case"
		);

		await user.click(screen.getByRole("button", { name: "Continue to case" }));
		expect(mockPush).toHaveBeenCalledWith("/case/copied-case");
	});

	it("asks for a pattern when none is chosen, without creating anything", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockResolvedValue([OWN_PATTERN]);
		render(<CaseCreateModal />);

		await startFromPattern(user);
		await screen.findByRole("combobox", { name: "Pattern" });
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		expect(
			await screen.findByText("Choose a pattern to start from")
		).toBeVisible();
		const picker = screen.getByRole("combobox", { name: "Pattern" });
		expect(picker).toHaveAttribute("aria-invalid", "true");
		expect(picker).toHaveFocus();
		expect(createCaseFromPattern).not.toHaveBeenCalled();
		expect(createAssuranceCase).not.toHaveBeenCalled();
	});

	it("submits on Enter in the Name field instead of cancelling", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);

		await user.type(screen.getByLabelText("Description"), "About the new case");
		await user.type(screen.getByLabelText("Name"), "My new case{Enter}");

		await waitFor(() =>
			expect(createAssuranceCase).toHaveBeenCalledWith({
				name: "My new case",
				description: "About the new case",
				kind: "CASE",
			})
		);
	});

	it("labels an archived published pattern in the picker", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockResolvedValue([
			{ ...PUBLISHED_PATTERN, archived: true },
		]);
		render(<CaseCreateModal />);

		await startFromPattern(user);
		await user.click(await screen.findByRole("combobox", { name: "Pattern" }));

		expect(
			screen.getByRole("option", { name: "Published pattern Archived" })
		).toBeVisible();
	});

	it("says so when the patterns cannot be loaded and again when there are none", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockRejectedValueOnce(
			new Error("Failed to fetch")
		);
		render(<CaseCreateModal />);

		await startFromPattern(user);
		expect(
			await screen.findByText("Patterns could not be loaded.")
		).toBeVisible();

		vi.mocked(fetchViewablePatterns).mockResolvedValueOnce(null);
		await user.click(screen.getByRole("button", { name: "Try again" }));
		expect(
			await screen.findByText("Patterns could not be loaded.")
		).toBeVisible();

		vi.mocked(fetchViewablePatterns).mockResolvedValueOnce([]);
		await user.click(screen.getByRole("button", { name: "Try again" }));
		expect(
			await screen.findByText("You have no patterns to start from yet.")
		).toBeVisible();
	});
});
