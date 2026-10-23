import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applySuggestion } from "@/lib/plugins/assistant/apply-suggestion";
import { SuggestionResult } from "@/lib/plugins/assistant/suggestion-card";
import {
	act,
	renderWithoutProviders,
	screen,
	waitFor,
} from "@/src/__tests__/utils/test-utils";

vi.mock("@/lib/plugins/assistant/apply-suggestion", () => ({
	applySuggestion: vi.fn(),
}));

const CASE_ID = "case-1";
const HOSTILE =
	"[click](https://evil.example/x) ![pixel](https://evil.example/p.png) <img src=x onerror=alert(1)> <script>alert(2)</script> **bold** `code`";
const MARKUP = "a, img, strong, em, code, script, b";

const editResult = {
	suggested: true,
	kind: "edit",
	elementId: "p1",
	elementType: "property_claim",
	label: "P1",
	changes: {
		description: { before: "Old wording", after: "New wording" },
	},
};

const newResult = {
	suggested: true,
	kind: "new",
	parentId: "p1",
	parentLabel: "P1",
	parentType: "property_claim",
	childType: "evidence",
	description: "A test report",
};

function part(output: unknown, overrides: Record<string, unknown> = {}) {
	return {
		type: "tool-suggest_edit",
		toolCallId: "call-1",
		state: "output-available",
		input: {},
		output,
		...overrides,
	} as never;
}

function renderCard(
	output: unknown,
	props: {
		canEdit?: boolean;
		onOutcome?: (id: string, outcome: string) => void;
		outcome?: "applied" | "dismissed" | "changed";
		part?: Record<string, unknown>;
	} = {}
) {
	const onOutcome = props.onOutcome ?? vi.fn();
	const view = renderWithoutProviders(
		<SuggestionResult
			canEdit={props.canEdit ?? true}
			caseId={CASE_ID}
			onOutcome={onOutcome as never}
			outcome={props.outcome}
			part={part(output, props.part)}
		/>
	);
	return { ...view, onOutcome };
}

beforeEach(() => {
	vi.mocked(applySuggestion).mockReset();
});

describe("SuggestionResult: case text is shown as text", () => {
	it("never turns the current or suggested text of a rewording into markup", () => {
		const { container } = renderCard({
			...editResult,
			label: `P1 ${HOSTILE}`,
			changes: {
				description: { before: HOSTILE, after: HOSTILE },
				assumption: { before: "", after: HOSTILE },
				context: { before: [HOSTILE], after: [HOSTILE, HOSTILE] },
			},
		});

		expect(container.querySelectorAll(MARKUP)).toHaveLength(0);
		expect(container).toHaveTextContent("https://evil.example/x");
		expect(container).toHaveTextContent("<script>alert(2)</script>");
	});

	it("never turns the text or parent label of a new element into markup", () => {
		const { container } = renderCard({
			...newResult,
			parentLabel: HOSTILE,
			description: HOSTILE,
		});

		expect(container.querySelectorAll(MARKUP)).toHaveLength(0);
		expect(container).toHaveTextContent("[click](https://evil.example/x)");
	});

	it("shows an empty current text as empty, not as a blank space", () => {
		renderCard({
			...editResult,
			changes: { assumption: { before: "", after: "A first assumption" } },
		});

		expect(screen.getByText("(empty)")).toBeInTheDocument();
	});
});

describe("SuggestionResult: after Apply found a change", () => {
	it.each([
		["a rewording", editResult],
		["a new element", newResult],
	])("says %s has changed since, with no buttons left", (_what, result) => {
		renderCard(result, { outcome: "changed" });

		expect(screen.queryAllByRole("button")).toHaveLength(0);
		expect(screen.getByTestId("assistant-suggestion")).toHaveTextContent(
			"changed since"
		);
	});
});

describe("SuggestionResult: Apply and Dismiss", () => {
	it("starts one save however many times Apply is clicked while it runs, and holds both buttons", async () => {
		let finish: (value: { status: "applied" }) => void = () => undefined;
		vi.mocked(applySuggestion).mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		const { onOutcome } = renderCard(newResult);
		const apply = screen.getByRole("button", { name: "Apply" });

		act(() => {
			apply.click();
			apply.click();
			apply.click();
		});
		await waitFor(() => expect(apply).toBeDisabled());

		expect(applySuggestion).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("button", { name: "Dismiss" })).toBeDisabled();
		await act(() => {
			finish({ status: "applied" });
			return Promise.resolve();
		});
		await waitFor(() => expect(onOutcome).toHaveBeenCalledTimes(1));
	});

	it("shows why a save failed, records no outcome, and lets the user try again", async () => {
		vi.mocked(applySuggestion)
			.mockResolvedValueOnce({ status: "failed", message: "No permission." })
			.mockResolvedValueOnce({ status: "applied" });
		const { onOutcome } = renderCard(editResult);

		await userEvent.click(screen.getByRole("button", { name: "Apply" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"No permission."
		);
		expect(onOutcome).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();

		await userEvent.click(screen.getByRole("button", { name: "Apply" }));

		await waitFor(() =>
			expect(onOutcome).toHaveBeenCalledWith("call-1", "applied")
		);
		expect(applySuggestion).toHaveBeenCalledTimes(2);
		expect(screen.queryByRole("alert")).toBeNull();
	});
});

describe("SuggestionResult: what it will not draw", () => {
	it.each([
		"tool-read_case",
		"tool-read_element",
		"tool-lint_case",
		"tool-suggest_techniques",
		"tool-something_else",
	])("draws no card for a suggestion-shaped result of %s", (type) => {
		const { container } = renderCard(editResult, { part: { type } });

		expect(container).toBeEmptyDOMElement();
	});

	it.each([
		"input-streaming",
		"input-available",
		"output-error",
	])("draws nothing while the call is %s", (state) => {
		const { container } = renderCard(editResult, { part: { state } });

		expect(container).toBeEmptyDOMElement();
	});

	it.each([
		["a case read", { found: true, tree: {} }],
		["nothing", undefined],
		["a bare flag", { suggested: true }],
		[
			"a rewording without its changes",
			{ suggested: true, kind: "edit", elementId: "p1" },
		],
		["a rewording with a non-text id", { ...editResult, elementId: 7 }],
		[
			"a new element of a type that cannot be suggested",
			{ ...newResult, childType: "goal" },
		],
		["a new element of an away goal", { ...newResult, childType: "away_goal" }],
		["a refusal with no reason", { suggested: false }],
	])("draws nothing for %s", (_what, output) => {
		const { container } = renderCard(output);

		expect(container).toBeEmptyDOMElement();
	});
});
