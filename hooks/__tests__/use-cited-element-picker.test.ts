import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCitedElementPicker } from "../use-cited-element-picker";

vi.mock("@/actions/cited-element-picker", () => ({
	listCitableCases: vi.fn(),
	listCitableGoals: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

import {
	listCitableCases,
	listCitableGoals,
} from "@/actions/cited-element-picker";
import { toast } from "@/lib/toast";

describe("useCitedElementPicker (ADR 0005 D7)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("loads cases on mount", async () => {
		vi.mocked(listCitableCases).mockResolvedValue({
			success: true,
			data: [{ id: "case-1", name: "Case One" }],
		});
		vi.mocked(listCitableGoals).mockResolvedValue({ success: true, data: [] });

		const { result } = renderHook(() => useCitedElementPicker("module"));

		expect(result.current.casesLoading).toBe(true);
		await waitFor(() => expect(result.current.casesLoading).toBe(false));
		expect(result.current.cases).toEqual([{ id: "case-1", name: "Case One" }]);
	});

	it("toasts an error and stops loading when listCitableCases fails", async () => {
		vi.mocked(listCitableCases).mockResolvedValue({
			success: false,
			error: "boom",
		});

		const { result } = renderHook(() => useCitedElementPicker("module"));

		await waitFor(() => expect(result.current.casesLoading).toBe(false));
		expect(result.current.cases).toEqual([]);
		expect(toast).toHaveBeenCalledWith(
			expect.objectContaining({ variant: "destructive" })
		);
	});

	it("fetches goals only for kind=away-goal, once a case is selected", async () => {
		vi.mocked(listCitableCases).mockResolvedValue({
			success: true,
			data: [{ id: "case-1", name: "Case One" }],
		});
		vi.mocked(listCitableGoals).mockResolvedValue({
			success: true,
			data: [{ id: "goal-1", name: "G1", description: "A goal" }],
		});

		const { result } = renderHook(() => useCitedElementPicker("module"));
		await waitFor(() => expect(result.current.casesLoading).toBe(false));

		act(() => {
			result.current.selectCase("case-1");
		});

		// kind is "module" — listCitableGoals must never be called.
		expect(listCitableGoals).not.toHaveBeenCalled();
		expect(result.current.goals).toEqual([]);
	});

	it("fetches and exposes goals for kind=away-goal, clearing them when the case changes", async () => {
		vi.mocked(listCitableCases).mockResolvedValue({
			success: true,
			data: [
				{ id: "case-1", name: "Case One" },
				{ id: "case-2", name: "Case Two" },
			],
		});
		vi.mocked(listCitableGoals).mockResolvedValue({
			success: true,
			data: [{ id: "goal-1", name: "G1", description: "A goal" }],
		});

		const { result } = renderHook(() => useCitedElementPicker("away-goal"));
		await waitFor(() => expect(result.current.casesLoading).toBe(false));

		act(() => {
			result.current.selectCase("case-1");
		});
		await waitFor(() => expect(result.current.goalsLoading).toBe(false));
		expect(result.current.goals).toEqual([
			{ id: "goal-1", name: "G1", description: "A goal" },
		]);

		act(() => {
			result.current.selectGoal("goal-1");
		});
		expect(result.current.selectedGoalDescription).toBe("A goal");

		// Selecting a different case clears the previously-selected goal —
		// a goal id from case A means nothing once case B is selected.
		act(() => {
			result.current.selectCase("case-2");
		});
		expect(result.current.selectedGoalId).toBe("");
		expect(result.current.selectedGoalDescription).toBeNull();
		// The re-fetch for case-2 settles asynchronously — wait it out so it
		// doesn't leak a state update into the next test.
		await waitFor(() => expect(result.current.goalsLoading).toBe(false));
	});

	it("toasts an error when listCitableGoals fails", async () => {
		vi.mocked(listCitableCases).mockResolvedValue({
			success: true,
			data: [{ id: "case-1", name: "Case One" }],
		});
		vi.mocked(listCitableGoals).mockResolvedValue({
			success: false,
			error: "boom",
		});

		const { result } = renderHook(() => useCitedElementPicker("away-goal"));
		await waitFor(() => expect(result.current.casesLoading).toBe(false));

		act(() => {
			result.current.selectCase("case-1");
		});
		await waitFor(() => expect(result.current.goalsLoading).toBe(false));

		expect(result.current.goals).toEqual([]);
		expect(toast).toHaveBeenCalledWith(
			expect.objectContaining({ variant: "destructive" })
		);
	});
});
