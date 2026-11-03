import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAssuranceCase } from "@/actions/assurance-cases";
import {
	createCaseFromPattern,
	fetchPatternVariables,
	fetchViewablePatterns,
} from "@/actions/case-from-pattern";
import type { PublishedPatternPreset } from "@/hooks/modal-hooks";
import type { PatternVariable } from "@/lib/case/pattern-variables";
import { NOT_A_VARIABLE } from "@/lib/schemas/case-from-pattern";
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
const mockModal: { preset?: PublishedPatternPreset } = {};

vi.mock("@/hooks/modal-hooks", () => ({
	useCreateCaseModal: () => ({
		isOpen: true,
		onClose: mockOnClose,
		preset: mockModal.preset,
	}),
}));

vi.mock("@/actions/assurance-cases", () => ({
	createAssuranceCase: vi.fn(),
}));

vi.mock("@/actions/case-from-pattern", () => ({
	createCaseFromPattern: vi.fn(),
	fetchPatternVariables: vi.fn(),
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
const SYSTEM_ID = "k3f9x2m7qa";
const OWNER_ID = "p4n8c2d6xz";
const TWO_VARIABLES: PatternVariable[] = [
	{
		id: SYSTEM_ID,
		name: "system",
		meaning: "The system this case is about",
		value: "AcmeBot",
	},
	{ id: OWNER_ID, name: "owner", meaning: "Who is responsible for it" },
];
const CHARACTERS_OF_500 = /of 500 characters/;
const CUT_OFF =
	"500 of 500 characters, the most a value can hold. Longer text is cut off.";
const PATTERN_CHANGED =
	"The pattern has changed since its variables were shown. They have been reloaded: check the fields, then submit again.";
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
	mockModal.preset = undefined;
	vi.mocked(fetchPatternVariables).mockResolvedValue([]);
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
			"About the new case",
			{}
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
			"About the new case",
			{}
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

	it("opened with a published pattern, shows it chosen before the list loads and starts a case from it", async () => {
		const user = userEvent.setup();
		mockModal.preset = {
			slug: "a-pattern",
			title: "Published pattern",
			description: "What the page says it is for",
		};
		vi.mocked(fetchViewablePatterns).mockReturnValue(
			new Promise(() => undefined)
		);
		vi.mocked(createCaseFromPattern).mockResolvedValue({
			success: true,
			data: { id: "copied-case", warnings: [] },
		});
		render(<CaseCreateModal />);

		expect(screen.getByRole("radio", { name: A_PATTERN })).toBeChecked();
		expect(
			await screen.findByRole("combobox", { name: "Pattern" })
		).not.toHaveTextContent("Choose a pattern");
		expect(screen.getByText("What the page says it is for")).toBeVisible();
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith("/case/copied-case")
		);
		expect(createCaseFromPattern).toHaveBeenCalledWith(
			{ publishedSlug: "a-pattern" },
			"My new case",
			"About the new case",
			{}
		);
	});

	it("adds the preset pattern to a list that lacks it, and lets another pattern be chosen", async () => {
		const user = userEvent.setup();
		mockModal.preset = {
			slug: "a-pattern",
			title: "Published pattern",
			description: "What the page says it is for",
		};
		vi.mocked(fetchViewablePatterns).mockResolvedValue([OWN_PATTERN]);
		vi.mocked(createCaseFromPattern).mockResolvedValue({
			success: true,
			data: { id: "copied-case", warnings: [] },
		});
		render(<CaseCreateModal />);

		const picker = await screen.findByRole("combobox", { name: "Pattern" });
		await user.click(picker);
		await screen.findByRole("option", { name: "Own pattern" });
		expect(
			screen.getByRole("option", { name: "Published pattern" })
		).toBeVisible();
		await user.click(screen.getByRole("option", { name: "Own pattern" }));
		expect(screen.getByText("What the own pattern is for")).toBeVisible();
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(createCaseFromPattern).toHaveBeenCalledWith(
			{ patternCaseId: "pattern-1" },
			"My new case",
			"About the new case",
			{}
		);
	});

	it("uses the list's own entry for the preset pattern when the list has it", async () => {
		const user = userEvent.setup();
		mockModal.preset = {
			slug: "a-pattern",
			title: "Published pattern",
			description: "What the page says it is for",
		};
		vi.mocked(fetchViewablePatterns).mockResolvedValue([
			{ ...PUBLISHED_PATTERN, description: "What the list says it is for" },
		]);
		render(<CaseCreateModal />);

		expect(
			await screen.findByText("What the list says it is for")
		).toBeVisible();
		await user.click(screen.getByRole("combobox", { name: "Pattern" }));
		expect(
			screen.getAllByRole("option", { name: "Published pattern" })
		).toHaveLength(1);
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

describe("CaseCreateModal variables", () => {
	async function chooseOwnPattern(user: ReturnType<typeof userEvent.setup>) {
		await startFromPattern(user);
		await user.click(await screen.findByRole("combobox", { name: "Pattern" }));
		await user.click(screen.getByRole("option", { name: "Own pattern" }));
	}

	beforeEach(() => {
		vi.mocked(fetchViewablePatterns).mockResolvedValue([
			OWN_PATTERN,
			PUBLISHED_PATTERN,
		]);
		vi.mocked(fetchPatternVariables).mockResolvedValue(TWO_VARIABLES);
		vi.mocked(createCaseFromPattern).mockResolvedValue({
			success: true,
			data: { id: "copied-case", warnings: [] },
		});
	});

	it("asks for each variable of the chosen pattern, filled with the value the pattern gives it, and sends what was typed", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);

		await startFromPattern(user);
		expect(fetchPatternVariables).not.toHaveBeenCalled();
		await user.click(await screen.findByRole("combobox", { name: "Pattern" }));
		await user.click(screen.getByRole("option", { name: "Own pattern" }));

		expect(await screen.findByLabelText("system")).toHaveValue("AcmeBot");
		expect(screen.getByLabelText("owner")).toHaveValue("");
		expect(screen.getByText("The system this case is about")).toBeVisible();
		expect(screen.getByText("Who is responsible for it")).toBeVisible();
		expect(fetchPatternVariables).toHaveBeenCalledWith({
			patternCaseId: "pattern-1",
		});

		await user.type(screen.getByLabelText("owner"), "  Dana  ");
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith("/case/copied-case")
		);
		expect(createCaseFromPattern).toHaveBeenCalledWith(
			{ patternCaseId: "pattern-1" },
			"My new case",
			"About the new case",
			{ [OWNER_ID]: "  Dana  " }
		);
	});

	it("sends an empty value for a variable the user clears, so the new case leaves it unset", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);

		await chooseOwnPattern(user);
		await user.clear(await screen.findByLabelText("system"));
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(createCaseFromPattern).toHaveBeenCalledWith(
			{ patternCaseId: "pattern-1" },
			"My new case",
			"About the new case",
			{ [SYSTEM_ID]: "" }
		);
	});

	it("limits a value to the length a variable can hold", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);

		await chooseOwnPattern(user);

		expect(await screen.findByLabelText("owner")).toHaveAttribute(
			"maxlength",
			"500"
		);
	});

	it("sends nothing typed for a pattern that was chosen earlier", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);

		await chooseOwnPattern(user);
		await user.type(await screen.findByLabelText("owner"), "Dana");

		vi.mocked(fetchPatternVariables).mockResolvedValue([
			{ id: "q1w2e3r4t5", name: "region", meaning: "" },
		]);
		await user.click(screen.getByRole("combobox", { name: "Pattern" }));
		await user.click(screen.getByRole("option", { name: "Published pattern" }));
		expect(await screen.findByLabelText("region")).toHaveValue("");
		expect(screen.queryByLabelText("owner")).not.toBeInTheDocument();
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(createCaseFromPattern).toHaveBeenCalledWith(
			{ publishedSlug: "a-pattern" },
			"My new case",
			"About the new case",
			{}
		);
	});

	it("shows what the action refuses and keeps the values typed", async () => {
		const user = userEvent.setup();
		vi.mocked(createCaseFromPattern).mockResolvedValue({
			success: false,
			error: "Variable values must be at most 500 characters",
		});
		render(<CaseCreateModal />);

		await chooseOwnPattern(user);
		await user.type(await screen.findByLabelText("owner"), "Dana");
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		expect(
			await screen.findByText("Variable values must be at most 500 characters")
		).toBeVisible();
		expect(mockPush).not.toHaveBeenCalled();
		expect(screen.getByLabelText("owner")).toHaveValue("Dana");
	});

	it("holds Submit back while the variables load, and says so when they cannot be loaded", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchPatternVariables).mockRejectedValueOnce(
			new Error("Failed to fetch")
		);
		render(<CaseCreateModal />);

		await chooseOwnPattern(user);
		expect(
			await screen.findByText("Variables could not be loaded.")
		).toBeVisible();
		expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();

		let finish: (variables: PatternVariable[]) => void = () => undefined;
		vi.mocked(fetchPatternVariables).mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		await user.click(screen.getByRole("button", { name: "Try again" }));
		expect(await screen.findByText("Loading variables")).toBeVisible();
		expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();

		await act(async () => {
			finish(TWO_VARIABLES);
			await Promise.resolve();
		});
		expect(await screen.findByLabelText("system")).toBeVisible();
		expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
	});

	it("asks for no values for a blank case or a pattern with no variables", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchPatternVariables).mockResolvedValue([]);
		render(<CaseCreateModal />);

		expect(fetchPatternVariables).not.toHaveBeenCalled();
		await chooseOwnPattern(user);
		await waitFor(() => expect(fetchPatternVariables).toHaveBeenCalled());
		expect(screen.queryByText("Variables")).not.toBeInTheDocument();
	});

	it("announces that the variables are loading, and that they could not be loaded", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchPatternVariables).mockRejectedValueOnce(
			new Error("Failed to fetch")
		);
		render(<CaseCreateModal />);

		await chooseOwnPattern(user);

		expect(await screen.findByRole("status")).toHaveTextContent(
			"Variables could not be loaded."
		);
		vi.mocked(fetchPatternVariables).mockReturnValueOnce(
			new Promise(() => undefined)
		);
		await user.click(screen.getByRole("button", { name: "Try again" }));
		expect(await screen.findByRole("status")).toHaveTextContent(
			"Loading variables"
		);
	});

	it("says when a pasted value was cut to the limit, and counts as a value nears it", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);
		await chooseOwnPattern(user);
		const owner = await screen.findByLabelText("owner");

		await user.click(owner);
		await user.paste("x".repeat(100));
		expect(screen.queryByText(CHARACTERS_OF_500)).not.toBeInTheDocument();
		expect(owner).not.toHaveAccessibleDescription(CHARACTERS_OF_500);

		await user.paste("y".repeat(360));
		expect(owner).toHaveAccessibleDescription(
			"Who is responsible for it 460 of 500 characters."
		);

		await user.paste("z".repeat(200));
		expect(owner).toHaveValue(
			`${"x".repeat(100)}${"y".repeat(360)}${"z".repeat(40)}`
		);
		expect(owner).toHaveAccessibleDescription(
			`Who is responsible for it ${CUT_OFF}`
		);
		expect(screen.getByRole("status")).toHaveTextContent(CUT_OFF);
	});

	it("keeps the fields, what was typed and the focus while the list replaces the published pattern with its case", async () => {
		const user = userEvent.setup();
		mockModal.preset = {
			slug: "a-pattern",
			title: "Published pattern",
			description: "What the page says it is for",
		};
		const list = Promise.withResolvers<ViewablePattern[]>();
		const fresh = Promise.withResolvers<PatternVariable[]>();
		vi.mocked(fetchViewablePatterns).mockReturnValue(list.promise);
		vi.mocked(fetchPatternVariables).mockImplementation((source) =>
			"publishedSlug" in source ? Promise.resolve(TWO_VARIABLES) : fresh.promise
		);
		render(<CaseCreateModal />);
		const owner = await screen.findByLabelText("owner");
		await user.type(owner, "Dana");

		await act(async () => {
			list.resolve([{ ...OWN_PATTERN, publishedSlug: "a-pattern" }]);
			await list.promise;
		});

		await waitFor(() =>
			expect(fetchPatternVariables).toHaveBeenCalledWith({
				patternCaseId: "pattern-1",
			})
		);
		expect(screen.queryByText("Loading variables")).not.toBeInTheDocument();
		expect(screen.getByLabelText("owner")).toBe(owner);
		expect(owner).toHaveFocus();
		expect(owner).toHaveValue("Dana");
		await act(async () => {
			fresh.resolve(TWO_VARIABLES);
			await fresh.promise;
		});
		expect(screen.getByLabelText("owner")).toBe(owner);
		expect(owner).toHaveFocus();
		expect(owner).toHaveValue("Dana");
	});

	it("reloads the variables when the server says the pattern has changed, keeping what is typed for the ones that remain", async () => {
		const user = userEvent.setup();
		vi.mocked(createCaseFromPattern).mockResolvedValue({
			success: false,
			error: NOT_A_VARIABLE,
		});
		render(<CaseCreateModal />);
		await chooseOwnPattern(user);
		await user.type(await screen.findByLabelText("owner"), "Dana");
		await user.type(screen.getByLabelText("system"), "AcmeBot");
		vi.mocked(fetchPatternVariables).mockResolvedValue([
			TWO_VARIABLES[1] as PatternVariable,
			{ id: "q1w2e3r4t5", name: "region", meaning: "Where it runs" },
		]);
		await user.type(screen.getByLabelText("Name"), "My new case");
		await user.type(screen.getByLabelText("Description"), "About it");

		await user.click(screen.getByRole("button", { name: "Submit" }));

		expect(await screen.findByText(NOT_A_VARIABLE)).toBeVisible();
		expect(screen.getByText(PATTERN_CHANGED)).toBeVisible();
		expect(await screen.findByLabelText("region")).toHaveValue("");
		expect(screen.queryByLabelText("system")).not.toBeInTheDocument();
		expect(screen.getByLabelText("owner")).toHaveValue("Dana");
		expect(fetchPatternVariables).toHaveBeenCalledTimes(2);
		expect(mockPush).not.toHaveBeenCalled();

		vi.mocked(createCaseFromPattern).mockResolvedValue({
			success: true,
			data: { id: "copied-case", warnings: [] },
		});
		await user.click(screen.getByRole("button", { name: "Submit" }));
		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith("/case/copied-case")
		);
		expect(vi.mocked(createCaseFromPattern).mock.calls.at(-1)?.[3]).toEqual({
			[OWNER_ID]: "Dana",
		});
	});

	it("does not carry what was typed to another pattern whose variable has the same id", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockResolvedValue([
			OWN_PATTERN,
			PUBLISHED_PATTERN,
		]);
		render(<CaseCreateModal />);
		await chooseOwnPattern(user);
		await user.type(await screen.findByLabelText("owner"), "Dana");

		await user.click(screen.getByRole("combobox", { name: "Pattern" }));
		await user.click(screen.getByRole("option", { name: "Published pattern" }));

		expect(await screen.findByLabelText("owner")).toHaveValue("");
	});
});
