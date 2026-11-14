import { describe, expect, it, vi } from "vitest";
import { getCaseOutcomes } from "../suggestion-outcomes";

describe("getCaseOutcomes", () => {
	it("keeps what was recorded for the same user and case, and starts a different user or case empty", () => {
		getCaseOutcomes("outcomes-user-a", "outcomes-case-1").record(
			"call-1",
			"applied"
		);

		expect(
			getCaseOutcomes("outcomes-user-a", "outcomes-case-1").snapshot()
		).toEqual({
			"call-1": "applied",
		});
		expect(
			getCaseOutcomes("outcomes-user-b", "outcomes-case-1").snapshot()
		).toEqual({});
		expect(
			getCaseOutcomes("outcomes-user-a", "outcomes-case-2").snapshot()
		).toEqual({});
	});

	it("tells subscribers when an outcome is recorded or cleared, and not when there was nothing to clear", () => {
		const outcomes = getCaseOutcomes("outcomes-user-c", "outcomes-case-3");
		const listener = vi.fn();
		const unsubscribe = outcomes.subscribe(listener);
		const before = outcomes.version();

		outcomes.record("call-1", "dismissed");
		outcomes.clear();
		outcomes.clear();
		unsubscribe();
		outcomes.record("call-2", "applied");

		expect(listener).toHaveBeenCalledTimes(2);
		expect(outcomes.version()).toBe(before + 3);
		expect(outcomes.get("call-2")).toBe("applied");
	});
});
