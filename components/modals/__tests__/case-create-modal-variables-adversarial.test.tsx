import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAssuranceCase } from "@/actions/assurance-cases";
import {
	createCaseFromPattern,
	fetchPatternVariables,
	fetchViewablePatterns,
} from "@/actions/case-from-pattern";
import {
	type PublishedPatternPreset,
	useCreateCaseModal,
} from "@/hooks/modal-hooks";
import type { PatternVariable } from "@/lib/case/pattern-variables";
import type { PatternSource } from "@/lib/schemas/case-from-pattern";
import type { ViewablePattern } from "@/lib/services/case-from-pattern-service";
import {
	mockPush,
	resetNavigationMocks,
} from "@/src/__tests__/mocks/next-navigation-mocks";
import { CaseCreateModal } from "../case-create-modal";

/**
 * The variables part of the new-case dialog, against the real dialog store.
 * The actions are mocked; what is checked is which fields the dialog shows
 * for the chosen pattern, what they start with, what the dialog sends when
 * the case is created, and what it forgets or ignores as the user changes
 * pattern, as loads finish out of order, and as the dialog closes.
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
	fetchPatternVariables: vi.fn(),
	fetchViewablePatterns: vi.fn(),
}));

const A_PATTERN = /^A pattern/;
const SYSTEM_OR_OWNER = /^(system|owner)$/;
const A_NUMBERED_VARIABLE = /^variable /;
const A_BLANK_CASE = /^A blank case/;
const LOADING_VARIABLES = "Loading variables";
const VARIABLES_FAILED = "Variables could not be loaded.";

const SYSTEM = "k3f9x2m7qa";
const OWNER = "p4n8c2d6xz";
const REGION = "q1w2e3r4t5";

const PATTERN_A: ViewablePattern = {
	key: "case:pattern-a",
	name: "Pattern A",
	description: "The first pattern",
	origin: "own",
	source: { patternCaseId: "pattern-a" },
};
const PATTERN_B: ViewablePattern = {
	key: "case:pattern-b",
	name: "Pattern B",
	description: "The second pattern",
	origin: "own",
	source: { patternCaseId: "pattern-b" },
};
/** A copy of pattern A: its variables keep the ids they had. */
const PATTERN_COPY: ViewablePattern = {
	key: "case:pattern-copy",
	name: "Copy of A",
	description: "A copy of the first pattern",
	origin: "own",
	source: { patternCaseId: "pattern-copy" },
};

const VARIABLES_A: PatternVariable[] = [
	{ id: SYSTEM, name: "system", meaning: "the system under test" },
	{
		id: OWNER,
		name: "owner",
		meaning: "who answers for it",
		value: "Default Owner",
	},
];
const VARIABLES_B: PatternVariable[] = [
	{ id: REGION, name: "region", meaning: "where it runs" },
];

type User = ReturnType<typeof userEvent.setup>;

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const keyOf = (source: PatternSource) =>
	"patternCaseId" in source ? source.patternCaseId : source.publishedSlug;

/** Makes the variables read answer from a table by pattern, or null for none. */
function answerWith(table: Record<string, PatternVariable[] | null>) {
	vi.mocked(fetchPatternVariables).mockImplementation((source) => {
		const key = keyOf(source);
		return Promise.resolve(key in table ? (table[key] ?? null) : []);
	});
}

function openPlainly() {
	act(() => {
		useCreateCaseModal.getState().onOpen();
	});
}

function openWith(preset: PublishedPatternPreset) {
	act(() => {
		useCreateCaseModal.getState().onOpenWith(preset);
	});
}

async function startFromPattern(user: User) {
	await user.click(screen.getByRole("radio", { name: A_PATTERN }));
}

async function choose(user: User, name: string) {
	await user.click(await screen.findByRole("combobox", { name: "Pattern" }));
	await user.click(await screen.findByRole("option", { name }));
}

async function fillDetails(user: User) {
	await user.clear(screen.getByLabelText("Name"));
	await user.type(screen.getByLabelText("Name"), "My new case");
	await user.clear(screen.getByLabelText("Description"));
	await user.type(screen.getByLabelText("Description"), "About the new case");
}

const submit = (user: User) =>
	user.click(screen.getByRole("button", { name: "Submit" }));

/** The value field for a variable, by the name it is labelled with. */
const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

/** Opens the dialog on a pattern: the list has `patterns`; `chosen` is picked. */
async function openOnPattern(
	user: User,
	patterns: ViewablePattern[],
	chosen: ViewablePattern
) {
	vi.mocked(fetchViewablePatterns).mockResolvedValue(patterns);
	render(<CaseCreateModal />);
	openPlainly();
	await startFromPattern(user);
	await choose(user, chosen.name);
}

function lastValuesSent() {
	const calls = vi.mocked(createCaseFromPattern).mock.calls;
	return calls.at(-1)?.[3];
}

beforeEach(() => {
	vi.clearAllMocks();
	resetNavigationMocks();
	vi.mocked(createAssuranceCase).mockReset();
	vi.mocked(createCaseFromPattern).mockReset();
	vi.mocked(fetchViewablePatterns).mockReset();
	vi.mocked(fetchPatternVariables).mockReset();
	vi.mocked(createAssuranceCase).mockResolvedValue({
		success: true,
		data: { id: "new-case" },
	});
	vi.mocked(createCaseFromPattern).mockResolvedValue({
		success: true,
		data: { id: "copied-case", warnings: [] },
	});
	vi.mocked(fetchViewablePatterns).mockResolvedValue([]);
	vi.mocked(fetchPatternVariables).mockResolvedValue([]);
	act(() => {
		useCreateCaseModal.getState().onClose();
	});
});

describe("the fields for a pattern's variables", () => {
	it("shows one labelled field for each variable, with its meaning, and the pattern's value only where it has one", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A });

		await openOnPattern(user, [PATTERN_A, PATTERN_B], PATTERN_A);

		expect(await screen.findByLabelText("system")).toHaveValue("");
		expect(screen.getByLabelText("system")).toHaveAccessibleDescription(
			"the system under test"
		);
		expect(field("owner")).toHaveValue("Default Owner");
		expect(field("owner")).toHaveAccessibleDescription("who answers for it");
		expect(
			screen.getAllByRole("textbox", { name: SYSTEM_OR_OWNER })
		).toHaveLength(2);
	});

	it("shows no fields before a pattern is chosen, for a blank case, a blank pattern, or a pattern with none", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A, "pattern-b": [] });
		vi.mocked(fetchViewablePatterns).mockResolvedValue([PATTERN_A, PATTERN_B]);
		render(<CaseCreateModal />);
		openPlainly();

		expect(screen.queryByLabelText("system")).not.toBeInTheDocument();
		await startFromPattern(user);
		await screen.findByRole("combobox", { name: "Pattern" });
		expect(screen.queryByLabelText("system")).not.toBeInTheDocument();
		expect(fetchPatternVariables).not.toHaveBeenCalled();

		await choose(user, "Pattern B");
		await waitFor(() => expect(fetchPatternVariables).toHaveBeenCalled());
		expect(screen.queryByText(LOADING_VARIABLES)).not.toBeInTheDocument();
		expect(
			screen.queryByRole("group", { name: "Variables" })
		).not.toBeInTheDocument();

		await choose(user, "Pattern A");
		expect(await screen.findByLabelText("system")).toBeVisible();
		await user.click(screen.getByRole("radio", { name: A_BLANK_CASE }));
		expect(screen.queryByLabelText("system")).not.toBeInTheDocument();
	});

	it("shows markup in a name, meaning or value as text", async () => {
		const user = userEvent.setup();
		answerWith({
			"pattern-a": [
				{
					id: SYSTEM,
					name: "<b>bold</b>",
					meaning: "<img src=x onerror=alert(1)>",
					value: "<script>alert(2)</script>",
				},
			],
		});

		await openOnPattern(user, [PATTERN_A], PATTERN_A);

		expect(
			await screen.findByText("<img src=x onerror=alert(1)>")
		).toBeVisible();
		const group = screen.getByRole("group", { name: "Variables" });
		expect(within(group).getByLabelText("<b>bold</b>")).toHaveValue(
			"<script>alert(2)</script>"
		);
		expect(group.querySelector("img")).toBeNull();
		expect(group.querySelector("b")).toBeNull();
		expect(group.querySelector("script")).toBeNull();
	});

	it("labels two variables of the same name separately and keeps what is typed in each apart", async () => {
		const user = userEvent.setup();
		answerWith({
			"pattern-a": [
				{ id: SYSTEM, name: "system", meaning: "the outer system" },
				{ id: OWNER, name: "system", meaning: "the nested system" },
			],
		});
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		await screen.findAllByLabelText("system");

		const [outer, nested] = screen.getAllByLabelText(
			"system"
		) as HTMLInputElement[];
		expect(outer?.id).not.toBe(nested?.id);
		expect(outer).toHaveAccessibleDescription("the outer system");
		expect(nested).toHaveAccessibleDescription("the nested system");
		await user.type(outer as HTMLInputElement, "One");
		await user.type(nested as HTMLInputElement, "Two");
		await fillDetails(user);
		await submit(user);

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(lastValuesSent()).toEqual({ [SYSTEM]: "One", [OWNER]: "Two" });
	});

	it("leaves out the description of a variable with no meaning, and points at none", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": [{ id: SYSTEM, name: "system", meaning: "" }] });

		await openOnPattern(user, [PATTERN_A], PATTERN_A);

		const input = await screen.findByLabelText("system");
		expect(input).not.toHaveAttribute("aria-describedby");
		expect(input).toHaveAccessibleDescription("");
	});

	it("limits a field to 500 characters, so a longer value cannot be typed or pasted", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A });
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		const input = await screen.findByLabelText("system");

		expect(input).toHaveAttribute("maxlength", "500");
		await user.click(input);
		await user.paste("x".repeat(600));
		expect((input as HTMLInputElement).value).toHaveLength(500);
	});

	it("shows many variables, each with its own value", async () => {
		const user = userEvent.setup();
		const many = Array.from({ length: 60 }, (_, index) => ({
			id: `v${String(index).padStart(9, "0")}`,
			name: `variable ${index}`,
			meaning: `meaning ${index}`,
			value: `default ${index}`,
		}));
		answerWith({ "pattern-a": many });

		await openOnPattern(user, [PATTERN_A], PATTERN_A);

		expect(await screen.findByLabelText("variable 59")).toHaveValue(
			"default 59"
		);
		expect(screen.getByLabelText("variable 0")).toHaveValue("default 0");
		expect(
			screen.getAllByRole("textbox", { name: A_NUMBERED_VARIABLE })
		).toHaveLength(60);
	});
});

describe("what the dialog sends", () => {
	it("sends only the fields the user typed in, and leaves a default alone when its field is untouched", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A });
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		await user.type(await screen.findByLabelText("system"), "AcmeBot");
		await fillDetails(user);

		await submit(user);

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalledTimes(1));
		expect(createCaseFromPattern).toHaveBeenCalledWith(
			{ patternCaseId: "pattern-a" },
			"My new case",
			"About the new case",
			{ [SYSTEM]: "AcmeBot" }
		);
		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith("/case/copied-case")
		);
	});

	it("sends nothing when no field was touched", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A });
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		await screen.findByLabelText("system");
		await fillDetails(user);

		await submit(user);

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(lastValuesSent()).toEqual({});
	});

	it("sends an empty value for a default the user cleared, so that the variable is left unset", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A });
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		await user.clear(await screen.findByLabelText("owner"));
		await fillDetails(user);

		await submit(user);

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(lastValuesSent()).toEqual({ [OWNER]: "" });
	});

	it("sends a default the user typed over and then restored by hand, as the value they typed", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A });
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		const owner = await screen.findByLabelText("owner");
		await user.clear(owner);
		await user.type(owner, "Default Owner");
		await fillDetails(user);

		await submit(user);

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(lastValuesSent()).toEqual({ [OWNER]: "Default Owner" });
	});

	it("sends a value of spaces as typed, for the server to treat as unset", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A });
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		await user.type(await screen.findByLabelText("system"), "   ");
		await fillDetails(user);

		await submit(user);

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(lastValuesSent()).toEqual({ [SYSTEM]: "   " });
	});

	it("sends a 500-character value whole", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A });
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		const input = await screen.findByLabelText("system");
		await user.click(input);
		await user.paste("y".repeat(500));
		await fillDetails(user);

		await submit(user);

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(lastValuesSent()).toEqual({ [SYSTEM]: "y".repeat(500) });
	});

	it("sends no values, and reads no variables, for a blank case or a blank pattern", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A });
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		await user.type(await screen.findByLabelText("system"), "AcmeBot");
		await user.click(screen.getByRole("radio", { name: A_BLANK_CASE }));
		await fillDetails(user);

		await submit(user);

		await waitFor(() => expect(createAssuranceCase).toHaveBeenCalled());
		expect(createAssuranceCase).toHaveBeenCalledWith({
			name: "My new case",
			description: "About the new case",
			kind: "CASE",
		});
		expect(createCaseFromPattern).not.toHaveBeenCalled();
	});

	it("does not read the variables again as the user types", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A });
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		await user.type(
			await screen.findByLabelText("system"),
			"a long value typed"
		);
		await user.type(screen.getByLabelText("owner"), " and more");
		await fillDetails(user);

		expect(fetchPatternVariables).toHaveBeenCalledTimes(1);
		expect(fetchPatternVariables).toHaveBeenCalledWith({
			patternCaseId: "pattern-a",
		});
	});

	it("keeps what was typed when the server refuses, shows its message, and does not leave", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A });
		vi.mocked(createCaseFromPattern).mockResolvedValue({
			success: false,
			error: "That pattern has no variable to give that value to",
		});
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		await user.type(await screen.findByLabelText("system"), "AcmeBot");
		await fillDetails(user);

		await submit(user);

		expect(
			await screen.findByText(
				"That pattern has no variable to give that value to"
			)
		).toBeVisible();
		expect(field("system")).toHaveValue("AcmeBot");
		expect(mockPush).not.toHaveBeenCalled();
	});
});

describe("changing the pattern", () => {
	it("shows the new pattern's fields and none of the old pattern's", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A, "pattern-b": VARIABLES_B });
		await openOnPattern(user, [PATTERN_A, PATTERN_B], PATTERN_A);
		await user.type(await screen.findByLabelText("system"), "AcmeBot");

		await choose(user, "Pattern B");

		expect(await screen.findByLabelText("region")).toHaveValue("");
		expect(screen.queryByLabelText("system")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("owner")).not.toBeInTheDocument();
	});

	it("sends nothing the user typed for the old pattern, and what they typed for the new one", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A, "pattern-b": VARIABLES_B });
		await openOnPattern(user, [PATTERN_A, PATTERN_B], PATTERN_A);
		await user.type(await screen.findByLabelText("system"), "AcmeBot");
		await user.clear(screen.getByLabelText("owner"));
		await choose(user, "Pattern B");
		await user.type(await screen.findByLabelText("region"), "EU");
		await fillDetails(user);

		await submit(user);

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(createCaseFromPattern).toHaveBeenCalledWith(
			{ patternCaseId: "pattern-b" },
			"My new case",
			"About the new case",
			{ [REGION]: "EU" }
		);
	});

	it("does not carry a typed value to a pattern whose variable has the same id", async () => {
		const user = userEvent.setup();
		answerWith({
			"pattern-a": VARIABLES_A,
			"pattern-copy": [
				{ id: SYSTEM, name: "system", meaning: "the system under test" },
			],
		});
		await openOnPattern(user, [PATTERN_A, PATTERN_COPY], PATTERN_A);
		await user.type(await screen.findByLabelText("system"), "AcmeBot");

		await choose(user, "Copy of A");

		await waitFor(() =>
			expect(fetchPatternVariables).toHaveBeenCalledWith({
				patternCaseId: "pattern-copy",
			})
		);
		expect(await screen.findByLabelText("system")).toHaveValue("");
		await fillDetails(user);
		await submit(user);
		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(lastValuesSent()).toEqual({});
	});

	it("does not carry a cleared default to a pattern whose variable has the same id", async () => {
		const user = userEvent.setup();
		answerWith({
			"pattern-a": VARIABLES_A,
			"pattern-copy": [
				{ id: OWNER, name: "owner", meaning: "who", value: "Copy Owner" },
			],
		});
		await openOnPattern(user, [PATTERN_A, PATTERN_COPY], PATTERN_A);
		await user.clear(await screen.findByLabelText("owner"));

		await choose(user, "Copy of A");

		expect(await screen.findByLabelText("owner")).toHaveValue("Copy Owner");
		await fillDetails(user);
		await submit(user);
		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(lastValuesSent()).toEqual({});
	});

	it("shows the loading message and no fields while the new pattern's variables load", async () => {
		const user = userEvent.setup();
		const slow = deferred<PatternVariable[] | null>();
		vi.mocked(fetchPatternVariables).mockImplementation(async (source) =>
			keyOf(source) === "pattern-a" ? VARIABLES_A : await slow.promise
		);
		await openOnPattern(user, [PATTERN_A, PATTERN_B], PATTERN_A);
		await screen.findByLabelText("system");

		await choose(user, "Pattern B");

		expect(await screen.findByText(LOADING_VARIABLES)).toBeVisible();
		expect(screen.queryByLabelText("system")).not.toBeInTheDocument();
		await act(async () => {
			slow.resolve(VARIABLES_B);
			await slow.promise;
		});
		expect(await screen.findByLabelText("region")).toBeVisible();
		expect(screen.queryByText(LOADING_VARIABLES)).not.toBeInTheDocument();
	});
});

describe("loads that finish out of order", () => {
	it("uses the latest pattern's variables when an earlier pattern's load finishes last", async () => {
		const user = userEvent.setup();
		const first = deferred<PatternVariable[] | null>();
		const second = deferred<PatternVariable[] | null>();
		vi.mocked(fetchPatternVariables).mockImplementation(async (source) =>
			keyOf(source) === "pattern-a" ? await first.promise : await second.promise
		);
		await openOnPattern(user, [PATTERN_A, PATTERN_B], PATTERN_A);
		await choose(user, "Pattern B");

		await act(async () => {
			second.resolve(VARIABLES_B);
			await second.promise;
		});
		expect(await screen.findByLabelText("region")).toBeVisible();
		await act(async () => {
			first.resolve(VARIABLES_A);
			await first.promise;
		});

		expect(screen.getByLabelText("region")).toBeVisible();
		expect(screen.queryByLabelText("system")).not.toBeInTheDocument();
		await fillDetails(user);
		await submit(user);
		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(createCaseFromPattern).toHaveBeenCalledWith(
			{ patternCaseId: "pattern-b" },
			expect.any(String),
			expect.any(String),
			{}
		);
	});

	it("uses the latest pattern's variables when the earlier load fails after it", async () => {
		const user = userEvent.setup();
		const first = deferred<PatternVariable[] | null>();
		vi.mocked(fetchPatternVariables).mockImplementation(async (source) =>
			keyOf(source) === "pattern-a" ? await first.promise : VARIABLES_B
		);
		await openOnPattern(user, [PATTERN_A, PATTERN_B], PATTERN_A);
		await choose(user, "Pattern B");
		expect(await screen.findByLabelText("region")).toBeVisible();

		await act(async () => {
			first.reject(new Error("network"));
			await first.promise.catch(() => undefined);
		});

		expect(screen.getByLabelText("region")).toBeVisible();
		expect(screen.queryByText(VARIABLES_FAILED)).not.toBeInTheDocument();
	});

	it("shows a slow first load's variables only if it is still the chosen pattern", async () => {
		const user = userEvent.setup();
		const first = deferred<PatternVariable[] | null>();
		vi.mocked(fetchPatternVariables).mockImplementation(async (source) =>
			keyOf(source) === "pattern-a" ? await first.promise : null
		);
		await openOnPattern(user, [PATTERN_A, PATTERN_B], PATTERN_A);
		await choose(user, "Pattern B");
		expect(await screen.findByText(VARIABLES_FAILED)).toBeVisible();

		await act(async () => {
			first.resolve(VARIABLES_A);
			await first.promise;
		});

		expect(screen.getByText(VARIABLES_FAILED)).toBeVisible();
		expect(screen.queryByLabelText("system")).not.toBeInTheDocument();
	});

	it("ignores a load that finishes after the dialog was closed and opened again", async () => {
		const user = userEvent.setup();
		const slow = deferred<PatternVariable[] | null>();
		vi.mocked(fetchPatternVariables).mockImplementation(async (source) =>
			keyOf(source) === "pattern-a" ? await slow.promise : VARIABLES_B
		);
		await openOnPattern(user, [PATTERN_A, PATTERN_B], PATTERN_A);
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		openPlainly();
		await startFromPattern(user);
		await choose(user, "Pattern B");
		expect(await screen.findByLabelText("region")).toBeVisible();

		await act(async () => {
			slow.resolve(VARIABLES_A);
			await slow.promise;
		});

		expect(screen.queryByLabelText("system")).not.toBeInTheDocument();
		expect(screen.getByLabelText("region")).toBeVisible();
	});
});

describe("submitting while the variables load", () => {
	it("keeps Submit disabled until they have loaded, then creates with what was typed", async () => {
		const user = userEvent.setup();
		const slow = deferred<PatternVariable[] | null>();
		vi.mocked(fetchPatternVariables).mockReturnValue(slow.promise);
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		await fillDetails(user);

		expect(await screen.findByText(LOADING_VARIABLES)).toBeVisible();
		expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
		await user.click(screen.getByRole("button", { name: "Submit" }));
		await user.type(screen.getByLabelText("Name"), "{Enter}");
		expect(createCaseFromPattern).not.toHaveBeenCalled();

		await act(async () => {
			slow.resolve(VARIABLES_A);
			await slow.promise;
		});
		await user.type(await screen.findByLabelText("system"), "AcmeBot");
		expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
		await submit(user);

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalledTimes(1));
		expect(lastValuesSent()).toEqual({ [SYSTEM]: "AcmeBot" });
	});

	it("does not disable Submit for a blank case, whatever the earlier pattern was doing", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchPatternVariables).mockReturnValue(
			deferred<PatternVariable[] | null>().promise
		);
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		expect(await screen.findByText(LOADING_VARIABLES)).toBeVisible();

		await user.click(screen.getByRole("radio", { name: A_BLANK_CASE }));
		await fillDetails(user);

		expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
		await submit(user);
		await waitFor(() => expect(createAssuranceCase).toHaveBeenCalled());
	});
});

describe("when the variables cannot be loaded", () => {
	it.each([
		["the read answers nothing", () => Promise.resolve(null)],
		["the read throws", () => Promise.reject(new Error("network down"))],
	])("says so and offers to try again when %s", async (_label, fail) => {
		const user = userEvent.setup();
		let attempt = 0;
		vi.mocked(fetchPatternVariables).mockImplementation(() => {
			attempt += 1;
			return attempt === 1 ? fail() : Promise.resolve(VARIABLES_A);
		});
		await openOnPattern(user, [PATTERN_A], PATTERN_A);

		expect(await screen.findByText(VARIABLES_FAILED)).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Try again" }));

		expect(await screen.findByLabelText("system")).toBeVisible();
		expect(screen.queryByText(VARIABLES_FAILED)).not.toBeInTheDocument();
		expect(fetchPatternVariables).toHaveBeenCalledTimes(2);
	});

	it("still lets the user create the case, sending no values", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchPatternVariables).mockResolvedValue(null);
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		expect(await screen.findByText(VARIABLES_FAILED)).toBeVisible();
		await fillDetails(user);

		await submit(user);

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(lastValuesSent()).toEqual({});
	});

	it("keeps what the user typed for other patterns out of a failed pattern's request", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A, "pattern-b": null });
		await openOnPattern(user, [PATTERN_A, PATTERN_B], PATTERN_A);
		await user.type(await screen.findByLabelText("system"), "AcmeBot");

		await choose(user, "Pattern B");
		expect(await screen.findByText(VARIABLES_FAILED)).toBeVisible();
		await fillDetails(user);
		await submit(user);

		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(lastValuesSent()).toEqual({});
	});

	it("does not leave the failure message showing once another pattern loads", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": null, "pattern-b": VARIABLES_B });
		await openOnPattern(user, [PATTERN_A, PATTERN_B], PATTERN_A);
		expect(await screen.findByText(VARIABLES_FAILED)).toBeVisible();

		await choose(user, "Pattern B");

		expect(await screen.findByLabelText("region")).toBeVisible();
		expect(screen.queryByText(VARIABLES_FAILED)).not.toBeInTheDocument();
	});
});

describe("the dialog opened from a published pattern's page", () => {
	const PRESET: PublishedPatternPreset = {
		slug: "fairness-pattern",
		title: "Fairness pattern",
		description: "About fairness",
	};

	it("pre-fills the published pattern's values and asks for the variables of its slug", async () => {
		const user = userEvent.setup();
		vi.mocked(fetchViewablePatterns).mockReturnValue(
			deferred<ViewablePattern[]>().promise
		);
		answerWith({ "fairness-pattern": VARIABLES_A });
		render(<CaseCreateModal />);

		openWith(PRESET);

		expect(await screen.findByLabelText("owner")).toHaveValue("Default Owner");
		expect(fetchPatternVariables).toHaveBeenCalledWith({
			publishedSlug: "fairness-pattern",
		});
		expect(screen.getByLabelText("system")).toHaveValue("");
		await user.type(screen.getByLabelText("system"), "AcmeBot");
		await fillDetails(user);
		await submit(user);
		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(createCaseFromPattern).toHaveBeenCalledWith(
			{ publishedSlug: "fairness-pattern" },
			"My new case",
			"About the new case",
			{ [SYSTEM]: "AcmeBot" }
		);
	});

	it("keeps the pre-filled fields when the list of patterns loads without the published pattern", async () => {
		const list = deferred<ViewablePattern[]>();
		vi.mocked(fetchViewablePatterns).mockReturnValue(list.promise);
		answerWith({ "fairness-pattern": VARIABLES_A });
		render(<CaseCreateModal />);
		openWith(PRESET);
		expect(await screen.findByLabelText("owner")).toHaveValue("Default Owner");

		await act(async () => {
			list.resolve([PATTERN_A]);
			await list.promise;
		});

		expect(await screen.findByLabelText("owner")).toHaveValue("Default Owner");
		expect(fetchPatternVariables).toHaveBeenCalledTimes(1);
	});

	it("keeps what was typed when the list replaces the published entry with the pattern case it came from", async () => {
		const user = userEvent.setup();
		const list = deferred<ViewablePattern[]>();
		vi.mocked(fetchViewablePatterns).mockReturnValue(list.promise);
		answerWith({ "fairness-pattern": VARIABLES_A, "pattern-a": VARIABLES_A });
		render(<CaseCreateModal />);
		openWith(PRESET);
		await user.type(await screen.findByLabelText("system"), "AcmeBot");

		await act(async () => {
			list.resolve([{ ...PATTERN_A, publishedSlug: "fairness-pattern" }]);
			await list.promise;
		});

		await waitFor(() =>
			expect(fetchPatternVariables).toHaveBeenCalledWith({
				patternCaseId: "pattern-a",
			})
		);
		expect(await screen.findByLabelText("system")).toHaveValue("AcmeBot");
		await fillDetails(user);
		await submit(user);
		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(createCaseFromPattern).toHaveBeenCalledWith(
			{ patternCaseId: "pattern-a" },
			"My new case",
			"About the new case",
			{ [SYSTEM]: "AcmeBot" }
		);
	});
});

describe("closing and opening the dialog again", () => {
	it("forgets what was typed and loads the variables afresh", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A });
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		await user.type(await screen.findByLabelText("system"), "AcmeBot");
		await user.clear(screen.getByLabelText("owner"));
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		openPlainly();
		await startFromPattern(user);
		await choose(user, "Pattern A");

		expect(await screen.findByLabelText("system")).toHaveValue("");
		expect(screen.getByLabelText("owner")).toHaveValue("Default Owner");
		await fillDetails(user);
		await submit(user);
		await waitFor(() => expect(createCaseFromPattern).toHaveBeenCalled());
		expect(lastValuesSent()).toEqual({});
	});

	it("forgets what was typed after a case was created and the dialog opened again", async () => {
		const user = userEvent.setup();
		answerWith({ "pattern-a": VARIABLES_A });
		await openOnPattern(user, [PATTERN_A], PATTERN_A);
		await user.type(await screen.findByLabelText("system"), "AcmeBot");
		await fillDetails(user);
		await submit(user);
		await waitFor(() => expect(mockPush).toHaveBeenCalled());

		openPlainly();
		await startFromPattern(user);
		await choose(user, "Pattern A");

		expect(await screen.findByLabelText("system")).toHaveValue("");
	});
});
