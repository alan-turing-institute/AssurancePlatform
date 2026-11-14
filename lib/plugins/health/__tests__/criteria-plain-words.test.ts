import { describe, expect, it } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	buildHealthCheckList,
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
	SYSTEM_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import { analyseDraft, draftFromCheck } from "../criteria-draft";
import { plainWords } from "../criteria-plain-words";

const UNSET_THEN_WITHDRAWN =
	/at most \(not set\).*counts until someone withdraws it\./;

const CHECKS = buildHealthCheckList().checks as HealthCheck[];

function demo(name: string): HealthCheck {
	const found = CHECKS.find((check) => check.name === name);
	if (!found) {
		throw new Error(`no demo check ${name}`);
	}
	return found;
}

function wordsFor(check: HealthCheck) {
	const { settings } = analyseDraft(draftFromCheck(check, "i"), check);
	return plainWords(settings, check);
}

describe("the plain words for each demo check's recommended settings", () => {
	it("a yes-or-no check judged per item", () => {
		expect(wordsFor(demo(ITEM_CHECK_NAME)).map((s) => s.text)).toEqual([
			"Each reading is about one item: “Is the surface of the item free of visible marks?”",
			"The check runs with Camera line set to ALL.",
			"A reading passes when the answer is yes and fails when the answer is no.",
			"For each item, the readings in each 1-minute window are combined by taking the average; the average passes when it is at least 80%, is marginal when it is at least 50% but below 80%, and fails when it is below 50%.",
			"If fewer than 80% of an item's readings have an answer, that item has no answer.",
			"The claim passes when at least 95% of the items pass, and fails otherwise.",
			"If fewer than 80% of the items have an answer, the claim has no result.",
			"A result counts for 5 minutes.",
		]);
	});

	it("a numeric check judged per item, with step 2 off", () => {
		expect(wordsFor(demo(NUMERIC_CHECK_NAME)).map((s) => s.text)).toEqual([
			"Each reading is about one item: “How far the edge of the item sits from its expected position.”",
			"The check runs with Tolerance profile set to standard.",
			"A reading passes when it is at most 0.5 mm, is marginal when it is above 0.5 mm but at most 1 mm, and fails when it is above 1 mm.",
			"Each result uses the readings in a 5-minute window.",
			"The claim passes when at least 90% of the items pass, and fails otherwise.",
			"If fewer than 80% of the items have an answer, the claim has no result.",
			"A result counts for 30 minutes.",
		]);
	});

	it.each([
		["PT8H", "an 8-hour window"],
		["PT11H", "an 11-hour window"],
		["PT18M", "an 18-minute window"],
		["PT5M", "a 5-minute window"],
		["PT10M", "a 10-minute window"],
		["PT1H", "a 1-hour window"],
		["PT12H", "a 12-hour window"],
	])("writes the window %s with the right article", (window, phrase) => {
		const check = demo(NUMERIC_CHECK_NAME);
		const draft = draftFromCheck(check, "i");
		const { settings } = analyseDraft(draft, check);
		const text = plainWords({ ...settings, window }, check).map((s) => s.text);
		expect(text).toContain(`Each result uses the readings in ${phrase}.`);
	});

	it("a whole-system check", () => {
		expect(wordsFor(demo(SYSTEM_CHECK_NAME)).map((s) => s.text)).toEqual([
			"Each reading is about the whole system: “How many items the line processes each minute.”",
			"A reading passes when it is at least 40 items/min, is marginal when it is at least 25 items/min but below 40 items/min, and fails when it is below 25 items/min.",
			"The claim takes the latest reading in each 10-minute window as its result.",
			"A result counts for 1 hour.",
		]);
	});
});

describe("plain words follow the form as it changes", () => {
	const numeric = demo(NUMERIC_CHECK_NAME);

	function textFor(change: (draft: ReturnType<typeof draftFromCheck>) => void) {
		const draft = draftFromCheck(numeric, "i");
		change(draft);
		return plainWords(analyseDraft(draft, numeric).settings, numeric)
			.map((sentence) => sentence.text)
			.join(" ");
	}

	it("states the direction of every shape in words", () => {
		expect(
			textFor((d) => {
				d.rule = { ...d.rule, shape: "at-least", pass: "3", marginal: "" };
			})
		).toContain("passes when it is at least 3 mm");
		expect(
			textFor((d) => {
				d.rule = {
					...d.rule,
					shape: "between",
					passLow: "1",
					passHigh: "2",
					marginalLow: "0",
					marginalHigh: "4",
				};
			})
		).toContain(
			"passes when it is between 1 mm and 2 mm, is marginal when it is between 0 mm and 4 mm but not between 1 mm and 2 mm, and fails when it is not between 0 mm and 4 mm"
		);
		expect(
			textFor((d) => {
				d.rule = { ...d.rule, shape: "one-of", passList: "1\n2" };
			})
		).toContain("passes when it is one of 1, 2");
	});

	it("says 'no time limit' as waiting for a withdrawal, and shows a value not yet entered", () => {
		expect(
			textFor((d) => {
				d.indefinite = true;
				d.rule = { ...d.rule, pass: "" };
			})
		).toMatch(UNSET_THEN_WITHDRAWN);
	});

	it("includes the percentile, readings needed and own rule of step 2", () => {
		const text = textFor((d) => {
			d.reductionOn = true;
			d.reduction = {
				...d.reduction,
				kind: "percentile",
				percentile: "95",
				readingsNeeded: "70",
				ownRule: true,
				rule: { ...d.reduction.rule, shape: "at-most", pass: "2" },
			};
		});
		expect(text).toContain(
			"taking the 95th percentile; the 95th percentile passes"
		);
		expect(text).toContain("at most 2 mm");
		expect(text).toContain("fewer than 70% of an item's readings");
	});

	it("uses the check's own words for the subjects, and the scope word when it has none", () => {
		const labelled: HealthCheck = {
			...numeric,
			scope_label: { one: "bridge", many: "bridges" },
		};
		const draft = draftFromCheck(labelled, "i");
		const text = plainWords(analyseDraft(draft, labelled).settings, labelled)
			.map((sentence) => sentence.text)
			.join(" ");
		expect(text).toContain("about one bridge");
		expect(text).toContain("of the bridges pass");
		const unlabelled: HealthCheck = { ...numeric, scope_label: undefined };
		const plain = plainWords(
			analyseDraft(draftFromCheck(unlabelled, "i"), unlabelled).settings,
			unlabelled
		)
			.map((sentence) => sentence.text)
			.join(" ");
		expect(plain).toContain("about one item");
		expect(plain).toContain("of the item subjects pass");
	});
});
