import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAssuranceCase } from "@/actions/assurance-cases";
import {
	createCaseFromPattern,
	fetchViewablePatterns,
} from "@/actions/case-from-pattern";
import {
	type PublishedPatternPreset,
	useCreateCaseModal,
} from "@/hooks/modal-hooks";
import type { ViewablePattern } from "@/lib/services/case-from-pattern-service";
import {
	mockPush,
	resetNavigationMocks,
} from "@/src/__tests__/mocks/next-navigation-mocks";
import { CaseCreateModal } from "../case-create-modal";

/**
 * The new-case dialog opened from a published pattern's page, against the
 * real dialog store. The actions are mocked; what is checked is what the dialog
 * shows and chooses before and after the list of patterns loads, what it
 * sends, and what it forgets when it closes. The chosen pattern is read from
 * the description the dialog shows for it and from the picker's selected entry.
 */

vi.mock(
	"@/hooks/modal-hooks",
	async (importOriginal) => await importOriginal()
);

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
const FAILED = "Patterns could not be loaded.";

const PRESET: PublishedPatternPreset = {
	slug: "fairness-pattern",
	title: "Title on the page",
	description: "Description on the page",
};
const OTHER_PRESET: PublishedPatternPreset = {
	slug: "privacy-pattern",
	title: "Privacy on the page",
	description: "Privacy description on the page",
};

const OWN_PATTERN: ViewablePattern = {
	key: "case:pattern-1",
	name: "Own pattern",
	description: "What the own pattern is for",
	origin: "own",
	source: { patternCaseId: "pattern-1" },
};
const LISTED_ENTRY: ViewablePattern = {
	key: "published:fairness-pattern",
	name: "Name in the list",
	description: "Description in the list",
	origin: "published",
	source: { publishedSlug: "fairness-pattern" },
};
const STALE_PATTERN: ViewablePattern = {
	key: "case:stale-1",
	name: "Stale pattern",
	description: "From an earlier opening",
	origin: "own",
	source: { patternCaseId: "stale-1" },
};

type User = ReturnType<typeof userEvent.setup>;
type Load = ReturnType<typeof deferred<ViewablePattern[]>>;

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

/** Lets a load that the dialog is waiting on finish, with React told of it. */
async function finishLoad(load: Load, patterns: ViewablePattern[]) {
	await act(async () => {
		load.resolve(patterns);
		await load.promise;
	});
}

function openWith(preset: PublishedPatternPreset) {
	act(() => {
		useCreateCaseModal.getState().onOpenWith(preset);
	});
}

function openPlainly() {
	act(() => {
		useCreateCaseModal.getState().onOpen();
	});
}

const picker = () => screen.findByRole("combobox", { name: "Pattern" });

async function fillDetails(user: User) {
	await user.type(screen.getByLabelText("Name"), "My new case");
	await user.type(screen.getByLabelText("Description"), "About the new case");
}

/** The entries the opened picker offers, and which is selected. The list is left open. */
async function openedOptions(user: User) {
	await user.click(await picker());
	return screen.getAllByRole("option").map((option) => ({
		name: option.textContent?.trim(),
		selected: option.getAttribute("aria-selected") === "true",
	}));
}

beforeEach(() => {
	vi.clearAllMocks();
	resetNavigationMocks();
	vi.mocked(createAssuranceCase).mockReset();
	vi.mocked(createCaseFromPattern).mockReset();
	vi.mocked(fetchViewablePatterns).mockReset();
	vi.mocked(createAssuranceCase).mockResolvedValue({
		success: true,
		data: { id: "new-case" },
	});
	vi.mocked(createCaseFromPattern).mockResolvedValue({
		success: true,
		data: { id: "copied-case", warnings: [] },
	});
	vi.mocked(fetchViewablePatterns).mockResolvedValue([]);
	act(() => {
		useCreateCaseModal.getState().onClose();
	});
});

describe("the new-case dialog opened with a published pattern", () => {
	it("starts from a pattern with that pattern chosen while the list is still loading", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockReturnValue(
			deferred<ViewablePattern[]>().promise
		);
		render(<CaseCreateModal />);

		openWith(PRESET);

		expect(await screen.findByRole("radio", { name: A_PATTERN })).toBeChecked();
		expect(screen.getByRole("radio", { name: A_BLANK_CASE })).not.toBeChecked();
		expect(screen.getByText("Description on the page")).toBeVisible();
		expect(screen.queryByText("Loading patterns")).not.toBeInTheDocument();
		expect(await openedOptions(user)).toEqual([
			{ name: "Title on the page", selected: true },
		]);
	});

	it("creates the case from the pattern's slug alone, before the list has loaded", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockReturnValue(
			deferred<ViewablePattern[]>().promise
		);
		render(<CaseCreateModal />);
		openWith(PRESET);
		await picker();

		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith("/case/copied-case")
		);
		expect(createCaseFromPattern).toHaveBeenCalledTimes(1);
		expect(createCaseFromPattern).toHaveBeenCalledWith(
			{ publishedSlug: "fairness-pattern" },
			"My new case",
			"About the new case"
		);
		expect(createAssuranceCase).not.toHaveBeenCalled();
	});

	it("shows a refusal from the server and creates nothing, keeping the pattern chosen", async () => {
		const user = userEvent.setup();
		vi.mocked(createCaseFromPattern).mockResolvedValue({
			success: false,
			error: "Pattern not found",
		});
		render(<CaseCreateModal />);
		openWith(PRESET);
		await picker();

		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		expect(await screen.findByText("Pattern not found")).toBeVisible();
		expect(mockPush).not.toHaveBeenCalled();
		expect(createAssuranceCase).not.toHaveBeenCalled();
		expect(screen.getByText("Description on the page")).toBeVisible();
	});

	it("uses the list's own entry for the pattern once the list has loaded, and offers it once", async () => {
		const user = userEvent.setup();
		const list = deferred<ViewablePattern[]>();
		vi.mocked(fetchViewablePatterns).mockReturnValue(list.promise);
		render(<CaseCreateModal />);
		openWith(PRESET);
		await picker();

		await finishLoad(list, [OWN_PATTERN, LISTED_ENTRY]);

		expect(await screen.findByText("Description in the list")).toBeVisible();
		expect(
			screen.queryByText("Description on the page")
		).not.toBeInTheDocument();
		expect(await openedOptions(user)).toEqual([
			{ name: "Own pattern", selected: false },
			{ name: "Name in the list", selected: true },
		]);
	});

	it("keeps the pattern chosen, and offered once, when the loaded list does not contain it", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockResolvedValue([OWN_PATTERN]);
		render(<CaseCreateModal />);
		openWith(PRESET);
		await waitFor(() => expect(fetchViewablePatterns).toHaveBeenCalled());

		expect(await screen.findByText("Description on the page")).toBeVisible();
		const options = await openedOptions(user);
		expect(options).toHaveLength(2);
		expect(options).toContainEqual({ name: "Own pattern", selected: false });
		expect(options).toContainEqual({
			name: "Title on the page",
			selected: true,
		});
	});

	it("loads the list once for the opening, however often the dialog re-renders", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockResolvedValue([OWN_PATTERN]);
		render(<CaseCreateModal />);
		openWith(PRESET);
		await picker();

		await fillDetails(user);

		expect(fetchViewablePatterns).toHaveBeenCalledTimes(1);
	});

	it("starts from the pattern the user picks instead", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockResolvedValue([
			OWN_PATTERN,
			LISTED_ENTRY,
		]);
		render(<CaseCreateModal />);
		openWith(PRESET);
		await screen.findByText("Description in the list");

		await user.click(await picker());
		await user.click(screen.getByRole("option", { name: "Own pattern" }));
		expect(screen.getByText("What the own pattern is for")).toBeVisible();
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() =>
			expect(createCaseFromPattern).toHaveBeenCalledWith(
				{ patternCaseId: "pattern-1" },
				"My new case",
				"About the new case"
			)
		);
	});

	it("starts a blank pattern when the user picks that start instead", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);
		openWith(PRESET);
		await picker();

		await user.click(screen.getByRole("radio", { name: A_BLANK_PATTERN }));
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() =>
			expect(createAssuranceCase).toHaveBeenCalledWith({
				name: "My new case",
				description: "About the new case",
				kind: "PATTERN",
			})
		);
		expect(createCaseFromPattern).not.toHaveBeenCalled();
	});

	it("starts a blank case when the user picks that start instead, and returns to the pattern when asked", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);
		openWith(PRESET);
		await picker();

		await user.click(screen.getByRole("radio", { name: A_BLANK_CASE }));
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
		await user.click(screen.getByRole("radio", { name: A_PATTERN }));

		expect(await screen.findByText("Description on the page")).toBeVisible();
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));
		await waitFor(() =>
			expect(createCaseFromPattern).toHaveBeenCalledWith(
				{ publishedSlug: "fairness-pattern" },
				"My new case",
				"About the new case"
			)
		);
	});
});

describe("the new-case dialog closed and opened again", () => {
	it("opens plainly on a blank case, with no pattern chosen and no list fetched", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockResolvedValue([OWN_PATTERN]);
		render(<CaseCreateModal />);
		openWith(PRESET);
		await picker();
		expect(fetchViewablePatterns).toHaveBeenCalledTimes(1);

		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(useCreateCaseModal.getState().isOpen).toBe(false);
		openPlainly();

		expect(
			await screen.findByRole("radio", { name: A_BLANK_CASE })
		).toBeChecked();
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
		expect(fetchViewablePatterns).toHaveBeenCalledTimes(1);

		await user.click(screen.getByRole("radio", { name: A_PATTERN }));
		expect(await picker()).toHaveTextContent("Choose a pattern");
		expect(
			screen.queryByText("Description on the page")
		).not.toBeInTheDocument();
		expect(fetchViewablePatterns).toHaveBeenCalledTimes(2);
	});

	it("closes after a case is created from the pattern and opens plainly on a blank case the next time", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);
		openWith(PRESET);
		await picker();
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));
		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith("/case/copied-case")
		);

		expect(useCreateCaseModal.getState().isOpen).toBe(false);
		expect(useCreateCaseModal.getState().preset).toBeUndefined();
		openPlainly();
		expect(
			await screen.findByRole("radio", { name: A_BLANK_CASE })
		).toBeChecked();
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
	});

	it("creates a blank case, not a copy, after a plain opening that follows a preset one", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);
		openWith(PRESET);
		await picker();
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		openPlainly();
		await screen.findByRole("radio", { name: A_BLANK_CASE });

		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() =>
			expect(createAssuranceCase).toHaveBeenCalledWith({
				name: "My new case",
				description: "About the new case",
				kind: "CASE",
			})
		);
		expect(createCaseFromPattern).not.toHaveBeenCalled();
	});

	it("opens with the pattern it is given the second time, not the first", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);
		openWith(PRESET);
		expect(await screen.findByText("Description on the page")).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		openWith(OTHER_PRESET);

		expect(
			await screen.findByText("Privacy description on the page")
		).toBeVisible();
		expect(
			screen.queryByText("Description on the page")
		).not.toBeInTheDocument();
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));
		await waitFor(() =>
			expect(createCaseFromPattern).toHaveBeenCalledWith(
				{ publishedSlug: "privacy-pattern" },
				"My new case",
				"About the new case"
			)
		);
	});

	it("forgets what the user picked, and chooses the pattern again, the next time it opens with one", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockResolvedValue([OWN_PATTERN]);
		render(<CaseCreateModal />);
		openWith(PRESET);
		await waitFor(() => expect(fetchViewablePatterns).toHaveBeenCalled());
		await user.click(await picker());
		await user.click(screen.getByRole("option", { name: "Own pattern" }));
		expect(screen.getByText("What the own pattern is for")).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		openWith(PRESET);

		expect(await screen.findByRole("radio", { name: A_PATTERN })).toBeChecked();
		expect(await screen.findByText("Description on the page")).toBeVisible();
		expect(
			screen.queryByText("What the own pattern is for")
		).not.toBeInTheDocument();
		await waitFor(() => expect(fetchViewablePatterns).toHaveBeenCalledTimes(2));
	});

	it("forgets a start the user picked the next time it opens with a pattern", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);
		openWith(PRESET);
		await picker();
		await user.click(screen.getByRole("radio", { name: A_BLANK_PATTERN }));
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		openWith(PRESET);

		expect(await screen.findByRole("radio", { name: A_PATTERN })).toBeChecked();
		expect(await screen.findByText("Description on the page")).toBeVisible();
	});
});

describe("a list of patterns that finishes loading after the dialog was closed", () => {
	async function pickAPatternAndListWhatIsOffered(user: User) {
		vi.mocked(fetchViewablePatterns).mockResolvedValue([OWN_PATTERN]);
		await user.click(screen.getByRole("radio", { name: A_PATTERN }));
		const options = await openedOptions(user);
		return options.map((option) => option.name);
	}

	it("does not change the next plain opening, when the dialog was opened with a preset", async () => {
		const user = userEvent.setup();
		const late = deferred<ViewablePattern[]>();
		vi.mocked(fetchViewablePatterns).mockReturnValueOnce(late.promise);
		render(<CaseCreateModal />);
		openWith(PRESET);
		await picker();
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		await finishLoad(late, [STALE_PATTERN]);
		openPlainly();
		expect(
			await screen.findByRole("radio", { name: A_BLANK_CASE })
		).toBeChecked();

		const offered = await pickAPatternAndListWhatIsOffered(user);

		expect(offered).toEqual(["Own pattern"]);
		expect(fetchViewablePatterns).toHaveBeenCalledTimes(2);
	});

	it("does not change the next plain opening, when the dialog was opened plainly", async () => {
		const user = userEvent.setup();
		const late = deferred<ViewablePattern[]>();
		vi.mocked(fetchViewablePatterns).mockReturnValueOnce(late.promise);
		render(<CaseCreateModal />);
		openPlainly();
		await user.click(await screen.findByRole("radio", { name: A_PATTERN }));
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		await finishLoad(late, [STALE_PATTERN]);
		openPlainly();
		expect(
			await screen.findByRole("radio", { name: A_BLANK_CASE })
		).toBeChecked();

		const offered = await pickAPatternAndListWhatIsOffered(user);

		expect(offered).toEqual(["Own pattern"]);
		expect(fetchViewablePatterns).toHaveBeenCalledTimes(2);
	});
});

describe("the new-case dialog opened with a pattern when the list cannot be loaded", () => {
	it.each([
		["the action throws", () => Promise.reject(new Error("Failed to fetch"))],
		["the action returns nothing", () => Promise.resolve(null)],
	])("says so and offers Try again, when %s", async (_label, outcome) => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockImplementationOnce(outcome);
		render(<CaseCreateModal />);

		openWith(PRESET);

		expect(await screen.findByText(FAILED)).toBeVisible();
		const retry = screen.getByRole("button", { name: "Try again" });
		vi.mocked(fetchViewablePatterns).mockResolvedValueOnce([OWN_PATTERN]);
		await user.click(retry);
		expect(await screen.findByText("Description on the page")).toBeVisible();
		expect(screen.queryByText(FAILED)).not.toBeInTheDocument();
	});
});
