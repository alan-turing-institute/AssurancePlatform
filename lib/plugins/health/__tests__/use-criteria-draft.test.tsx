import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import { draftFromCheck, draftFromStored } from "../criteria-draft";
import type { CheckChoice } from "../criteria-sections";
import type { HealthCriteriaResponse } from "../health-types";
import { useCriteriaDraft } from "../use-criteria-draft";
import {
	checkLists,
	INTEGRATION,
	NO_CRITERIA,
	storedCriteria,
} from "./criteria-test-data";

const PIPELINE = checkLists()[0]?.pipeline ?? "";

function checkNamed(name: string): HealthCheck {
	const found = checkLists()[0]?.checks.find((check) => check.name === name);
	if (!found) {
		throw new Error(`no demo check ${name}`);
	}
	return found;
}

const ITEM = checkNamed(ITEM_CHECK_NAME);
const NUMERIC = checkNamed(NUMERIC_CHECK_NAME);
const ITEM_DRAFT = draftFromCheck(ITEM, INTEGRATION.id);
const NUMERIC_DRAFT = draftFromCheck(NUMERIC, INTEGRATION.id);

function choice(key: string, check: HealthCheck): CheckChoice {
	return { check, integrationId: INTEGRATION.id, key, pipeline: PIPELINE };
}

const CHOICES = [choice("item", ITEM), choice("numeric", NUMERIC)];

type Options = Parameters<typeof useCriteriaDraft>[0];

function options(overrides: Partial<Options> = {}): Options {
	return {
		choices: CHOICES,
		initialCheck: ITEM,
		initialChoiceKey: "item",
		initialDraft: ITEM_DRAFT,
		revision: 1,
		...overrides,
	};
}

function render(initial: Options = options()) {
	return renderHook((props: Options) => useCriteriaDraft(props), {
		initialProps: initial,
	});
}

/** The form after the stored settings moved on under it to a numeric check. */
const MOVED_ON = options({
	initialCheck: NUMERIC,
	initialChoiceKey: "numeric",
	initialDraft: NUMERIC_DRAFT,
	revision: 2,
});

describe("whether the form holds unsaved changes", () => {
	it("holds none at the start", () => {
		const onUnsavedChange = vi.fn();

		const { result } = render(options({ onUnsavedChange }));

		expect(result.current.dirty).toBe(false);
		expect(onUnsavedChange).toHaveBeenLastCalledWith(false);
	});

	it("holds some at the start when told the initial draft is itself unsaved, until it is saved", () => {
		const { result } = render(options({ unsaved: true }));
		expect(result.current.dirty).toBe(true);

		act(() => result.current.saved(NO_CRITERIA));

		expect(result.current.dirty).toBe(false);
	});

	it("tells the caller as edits are made, and that there are none once it is gone", () => {
		const onUnsavedChange = vi.fn();
		const { result, unmount } = render(options({ onUnsavedChange }));

		act(() => result.current.setDraft({ indefinite: !ITEM_DRAFT.indefinite }));
		expect(onUnsavedChange).toHaveBeenLastCalledWith(true);
		unmount();

		expect(onUnsavedChange).toHaveBeenLastCalledWith(false);
	});
});

describe("when the stored settings move under the form", () => {
	it("takes the new settings, check and revision when there are no unsaved changes", () => {
		const { result, rerender } = render();

		rerender(MOVED_ON);

		expect(result.current.draft).toEqual(NUMERIC_DRAFT);
		expect(result.current.draftKey).toBe("numeric");
		expect(result.current.baseRevision).toBe(2);
		expect(result.current.changedElsewhere).toBe(false);
		expect(result.current.dirty).toBe(false);
	});

	it("keeps the unsaved draft, and says the settings changed elsewhere, until it is reloaded", () => {
		const { result, rerender } = render();
		const edited = { indefinite: !ITEM_DRAFT.indefinite };
		act(() => result.current.setDraft(edited));

		rerender(MOVED_ON);

		expect(result.current.draft).toEqual({ ...ITEM_DRAFT, ...edited });
		expect(result.current.changedElsewhere).toBe(true);
		expect(result.current.baseRevision).toBe(1);

		act(() => result.current.reload());

		expect(result.current.draft).toEqual(NUMERIC_DRAFT);
		expect(result.current.draftKey).toBe("numeric");
		expect(result.current.baseRevision).toBe(2);
		expect(result.current.changedElsewhere).toBe(false);
		expect(result.current.dirty).toBe(false);
	});
});

describe("which check the draft is for", () => {
	it("is the one the form was given while its key is the one shown", () => {
		const { result } = render(
			options({ choices: [choice("item", NUMERIC)], initialCheck: ITEM })
		);

		expect(result.current.check).toBe(ITEM);
	});

	it("is the one listed for the picked key", () => {
		const { result } = render();

		act(() => result.current.onPick("numeric"));

		expect(result.current.check).toBe(NUMERIC);
		expect(result.current.draftKey).toBe("numeric");
		expect(result.current.draft).toEqual(NUMERIC_DRAFT);
	});

	it("is the one the form was given when the key shown is no longer listed", () => {
		const { result, rerender } = render(options({ choices: [] }));

		rerender(options({ choices: [], initialChoiceKey: "other" }));

		expect(result.current.check).toBe(ITEM);
	});

	it("does not change when the picked key is not listed", () => {
		const { result } = render();

		act(() => result.current.onPick("missing"));

		expect(result.current.draftKey).toBe("item");
		expect(result.current.draft).toEqual(ITEM_DRAFT);
	});
});

describe("the problems found in the draft", () => {
	it("are none for the check's own recommendation", () => {
		const { result } = render();

		expect(result.current.hasProblems).toBe(false);
	});

	it("are reported once a value cannot be read", () => {
		const { result } = render();

		act(() =>
			result.current.setDraft({ window: { amount: "abc", unit: "minutes" } })
		);

		expect(result.current.hasProblems).toBe(true);
		expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);
	});
});

describe("the server's problems with the draft", () => {
	const PROBLEM = { "server.only": "Refused" };

	function withServerProblem() {
		const hook = render();
		act(() => hook.result.current.setServerErrors(PROBLEM));
		return hook;
	}

	it("are shown with the draft's own problems", () => {
		const { result } = withServerProblem();

		expect(result.current.errors["server.only"]).toBe("Refused");
	});

	it("are cleared by an edit", () => {
		const { result } = withServerProblem();

		act(() => result.current.setDraft({ indefinite: true }));

		expect(result.current.errors).not.toHaveProperty("server.only");
	});

	it("are cleared by picking a check", () => {
		const { result } = withServerProblem();

		act(() => result.current.onPick("numeric"));

		expect(result.current.errors).not.toHaveProperty("server.only");
	});

	it("are cleared, and the first check returns, when the draft is put back", () => {
		const { result } = withServerProblem();
		act(() => result.current.onPick("numeric"));
		act(() => result.current.setServerErrors(PROBLEM));

		act(() => result.current.resetToStored());

		expect(result.current.draftKey).toBe("item");
		expect(result.current.draft).toEqual(ITEM_DRAFT);
		expect(result.current.errors).not.toHaveProperty("server.only");
	});
});

describe("after a save", () => {
	function savedView(
		overrides: Partial<HealthCriteriaResponse> = {}
	): HealthCriteriaResponse {
		return storedCriteria({
			checkName: ITEM_CHECK_NAME,
			revision: 5,
			overrides: { integration: INTEGRATION, ...overrides },
		});
	}

	const STALE_DRAFT = {
		...ITEM_DRAFT,
		window: { amount: "99", unit: "hours" as const },
	};

	/** Edits the form, then saves it as its parent does: the revision it is given follows what the server stored. */
	function saving(view: HealthCriteriaResponse) {
		let props = options({ initialDraft: STALE_DRAFT });
		const { result } = renderHook(() => useCriteriaDraft(props));
		act(() => result.current.setDraft({ indefinite: true }));
		act(() => {
			props = { ...props, revision: view.criteria?.revision ?? null };
			result.current.saved(view);
		});
		return result;
	}

	function storedDraft(view: HealthCriteriaResponse) {
		if (!view.criteria) {
			throw new Error("the view holds no settings");
		}
		return draftFromStored(view.criteria, ITEM, INTEGRATION.id);
	}

	it("shows what the server stored, at its revision, with nothing unsaved", () => {
		const view = savedView();

		const result = saving(view);

		expect(result.current.baseRevision).toBe(5);
		expect(result.current.dirty).toBe(false);
		expect(result.current.draft).toEqual(storedDraft(view));
	});

	it("uses the form's own check when the answer describes none", () => {
		const view = savedView({ check_description: null });

		const result = saving(view);

		expect(result.current.draft).toEqual(storedDraft(view));
	});

	it.each([
		[
			"the integration the answer names",
			{ id: "integration-9", name: "X" },
			"integration-9",
		],
		[
			"the draft's own integration when the answer names none",
			null,
			INTEGRATION.id,
		],
	])("keeps %s", (_name, integration, expected) => {
		const result = saving(savedView({ integration }));

		expect(result.current.draft.integrationId).toBe(expected);
	});

	it("keeps the draft as it is when the answer holds no stored settings", () => {
		const result = saving(NO_CRITERIA);

		expect(result.current.draft).toEqual({ ...STALE_DRAFT, indefinite: true });
		expect(result.current.baseRevision).toBeNull();
		expect(result.current.dirty).toBe(false);
	});

	it("keeps the draft as it is when the stored settings are inactive", () => {
		const result = saving(
			storedCriteria({
				checkName: ITEM_CHECK_NAME,
				revision: 1,
				state: "inactive",
			})
		);

		expect(result.current.draft).toEqual({ ...STALE_DRAFT, indefinite: true });
		expect(result.current.baseRevision).toBe(1);
	});
});
