import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAssuranceCase } from "@/actions/assurance-cases";
import {
	createCaseFromPattern,
	fetchViewablePatterns,
} from "@/actions/case-from-pattern";
import type { PublishedPatternPreset } from "@/hooks/modal-hooks";
import type { ViewablePattern } from "@/lib/services/case-from-pattern-service";
import {
	mockPush,
	resetNavigationMocks,
} from "@/src/__tests__/mocks/next-navigation-mocks";
import { CaseCreateModal } from "../case-create-modal";

/**
 * Choosing a pattern in the new-case dialog asks for no variable values: the
 * dialog shows the picker, Name and Description, and creates the case with the
 * pattern's own values.
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

// The variable reader is listed so that a call to it would be seen.
const mockFetchPatternVariables = vi.fn();
vi.mock("@/actions/case-from-pattern", () => ({
	createCaseFromPattern: vi.fn(),
	fetchPatternVariables: (...args: unknown[]) =>
		mockFetchPatternVariables(...args),
	fetchViewablePatterns: vi.fn(),
}));

const A_PATTERN = /^A pattern/;
const VARIABLES = /variables/i;
const A_BLANK_CASE = /^A blank case/;
const A_BLANK_PATTERN = /^A blank pattern/;
const OWN_PATTERN: ViewablePattern = {
	key: "case:pattern-1",
	name: "Own pattern",
	description: "",
	origin: "own",
	source: { patternCaseId: "pattern-1" },
};
const OTHER_PATTERN: ViewablePattern = {
	key: "case:pattern-2",
	name: "Other pattern",
	description: "",
	origin: "own",
	source: { patternCaseId: "pattern-2" },
};
const PRESET: PublishedPatternPreset = {
	slug: "a-pattern",
	title: "Published pattern",
	description: "",
};
const REFUSAL = "That pattern can no longer be copied.";

type User = ReturnType<typeof userEvent.setup>;

async function fillDetails(user: User) {
	await user.type(screen.getByLabelText("Name"), "My new case");
	await user.type(screen.getByLabelText("Description"), "About the new case");
}

async function choosePattern(user: User, name: string) {
	await user.click(screen.getByRole("combobox"));
	await user.click(await screen.findByRole("option", { name }));
}

async function startFromPattern(user: User) {
	await user.click(screen.getByRole("radio", { name: A_PATTERN }));
	await choosePattern(user, OWN_PATTERN.name);
}

/** The dialog's variables heading, if shown, and its text fields. */
function variablesUi() {
	return {
		heading: screen.queryByText(VARIABLES),
		fields: screen.getAllByRole("textbox"),
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	resetNavigationMocks();
	mockModal.preset = undefined;
	mockFetchPatternVariables.mockResolvedValue([
		{ id: "k3f9x2m7qa", name: "system", meaning: "The system", value: "A" },
	]);
	vi.mocked(fetchViewablePatterns).mockResolvedValue([
		OWN_PATTERN,
		OTHER_PATTERN,
	]);
	vi.mocked(createAssuranceCase).mockResolvedValue({
		success: true,
		data: { id: "new-case" },
	});
	vi.mocked(createCaseFromPattern).mockResolvedValue({
		success: true,
		data: { id: "from-pattern", warnings: [] },
	});
});

describe("CaseCreateModal without pattern variables", () => {
	it("shows no variable fields for a chosen pattern and sends only source, name and description", async () => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);

		await startFromPattern(user);
		await fillDetails(user);
		expect(variablesUi().heading).not.toBeInTheDocument();
		expect(variablesUi().fields).toHaveLength(2);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith("/case/from-pattern")
		);
		expect(createCaseFromPattern).toHaveBeenCalledTimes(1);
		const args = vi.mocked(createCaseFromPattern).mock.calls[0];
		expect(args).toEqual([
			{ patternCaseId: "pattern-1" },
			"My new case",
			"About the new case",
		]);
		expect(args).toHaveLength(3);
	});

	it("requests no variables when choosing, switching patterns or reopening", async () => {
		const user = userEvent.setup();
		const first = render(<CaseCreateModal />);

		await startFromPattern(user);
		await choosePattern(user, OTHER_PATTERN.name);
		await choosePattern(user, OWN_PATTERN.name);
		first.unmount();
		render(<CaseCreateModal />);
		await startFromPattern(user);

		expect(mockFetchPatternVariables).not.toHaveBeenCalled();
	});

	it("shows no variable fields for a preset pattern and creates from it", async () => {
		mockModal.preset = PRESET;
		const user = userEvent.setup();
		render(<CaseCreateModal />);

		expect(screen.getByRole("radio", { name: A_PATTERN })).toBeChecked();
		await fillDetails(user);
		expect(variablesUi().heading).not.toBeInTheDocument();
		expect(variablesUi().fields).toHaveLength(2);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(vi.mocked(createCaseFromPattern).mock.calls[0]).toEqual([
			{ publishedSlug: "a-pattern" },
			"My new case",
			"About the new case",
		]);
		expect(mockFetchPatternVariables).not.toHaveBeenCalled();
	});

	it("shows a refusal from the action as worded", async () => {
		vi.mocked(createCaseFromPattern).mockResolvedValue({
			success: false,
			error: REFUSAL,
		});
		const user = userEvent.setup();
		render(<CaseCreateModal />);

		await startFromPattern(user);
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		expect(await screen.findByText(REFUSAL)).toBeInTheDocument();
		expect(mockPush).not.toHaveBeenCalled();
	});

	it.each([
		["blank case", A_BLANK_CASE, "CASE"],
		["blank pattern", A_BLANK_PATTERN, "PATTERN"],
	])("still creates a %s with its kind", async (_label, radio, kind) => {
		const user = userEvent.setup();
		render(<CaseCreateModal />);

		await user.click(screen.getByRole("radio", { name: radio }));
		await fillDetails(user);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() =>
			expect(createAssuranceCase).toHaveBeenCalledWith({
				name: "My new case",
				description: "About the new case",
				kind,
			})
		);
		expect(createCaseFromPattern).not.toHaveBeenCalled();
	});
});
