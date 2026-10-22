import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	fetchShowUnsupportedMarkers,
	saveShowUnsupportedMarkers,
} from "@/actions/unsupported-markers";
import { toast } from "@/lib/toast";
import { useUnsupportedMarkerSwitch } from "../use-unsupported-marker-switch";

vi.mock("@/actions/unsupported-markers", () => ({
	fetchShowUnsupportedMarkers: vi.fn(),
	saveShowUnsupportedMarkers: vi.fn(),
}));

const save = vi.mocked(saveShowUnsupportedMarkers);

interface Deferred {
	reject: (reason: unknown) => void;
	resolve: (value: boolean | null) => void;
}

/** Makes each call to the save action wait until the test settles it, in call order. */
function holdSaves(): Deferred[] {
	const held: Deferred[] = [];
	save.mockImplementation(
		() =>
			new Promise<boolean | null>((resolve, reject) => {
				held.push({ resolve, reject });
			})
	);
	return held;
}

function mount(initial: boolean | null) {
	return renderHook(() => {
		const [value, setValue] = useState<boolean | null>(initial);
		return { value, ...useUnsupportedMarkerSwitch(value, setValue) };
	});
}

async function press(
	hook: ReturnType<typeof mount>,
	next: boolean
): Promise<void> {
	await act(async () => {
		// Not awaited: the save is still waiting when the press returns.
		hook.result.current.onCheckedChange(next);
		await Promise.resolve();
	});
}

async function settle(
	deferred: Deferred | undefined,
	outcome: boolean | null | Error
): Promise<void> {
	if (!deferred) {
		throw new Error("the save being settled was never made");
	}
	await act(async () => {
		if (outcome instanceof Error) {
			deferred.reject(outcome);
		} else {
			deferred.resolve(outcome);
		}
		await Promise.resolve();
		await Promise.resolve();
	});
}

beforeEach(() => {
	vi.mocked(fetchShowUnsupportedMarkers).mockReset();
	// The stored value cannot be read, unless a test says otherwise, so a failed save falls back on the last value known to be stored.
	vi.mocked(fetchShowUnsupportedMarkers).mockResolvedValue(null);
	save.mockReset();
	vi.mocked(toast).mockClear();
});

describe("useUnsupportedMarkerSwitch", () => {
	describe("presses that overlap", () => {
		it("lets an earlier save that fails late leave a later choice alone", async () => {
			const held = holdSaves();
			const hook = mount(true);
			await press(hook, false);
			await press(hook, true);
			expect(hook.result.current.value).toBe(true);

			await settle(held[0], null);

			expect(hook.result.current.value).toBe(true);
		});

		it("lets an earlier save that throws late leave a later choice alone", async () => {
			const held = holdSaves();
			const hook = mount(true);
			await press(hook, false);
			await press(hook, true);

			await settle(held[0], new Error("late"));
			await settle(held[1], true);

			expect(hook.result.current.value).toBe(true);
		});

		it("keeps a later choice when the earlier save fails and the later one works", async () => {
			const held = holdSaves();
			const hook = mount(true);
			await press(hook, false);
			await press(hook, true);

			await settle(held[1], true);
			await settle(held[0], null);

			expect(hook.result.current.value).toBe(true);
			expect(toast).not.toHaveBeenCalled();
		});

		it("lets a later choice that fails put back the last value that was stored", async () => {
			const held = holdSaves();
			const hook = mount(true);
			await press(hook, false);
			await settle(held[0], false);
			await press(hook, true);

			await settle(held[1], null);

			expect(hook.result.current.value).toBe(false);
			expect(toast).toHaveBeenCalledTimes(1);
		});

		it("ends on the stored value when the later press fails first and the earlier one is stored after it", async () => {
			// The server stores the first press's value (off): the second press
			// failed. Whatever order the answers come back in, the switch has to
			// end up showing what was stored.
			const held = holdSaves();
			const hook = mount(true);
			await press(hook, false);
			await press(hook, true);

			await settle(held[1], null);
			await settle(held[0], false);

			expect(hook.result.current.value).toBe(false);
		});

		it("ends on the original value when every overlapping save fails, whatever the order", async () => {
			const held = holdSaves();
			const hook = mount(true);
			await press(hook, false);
			await press(hook, true);
			await press(hook, false);

			await settle(held[1], null);
			await settle(held[2], null);
			await settle(held[0], null);

			expect(hook.result.current.value).toBe(true);
		});

		it("saves each press with its own value", async () => {
			holdSaves();
			const hook = mount(true);

			await press(hook, false);
			await press(hook, true);
			await press(hook, false);

			expect(save.mock.calls.map((call) => call[0])).toEqual([
				false,
				true,
				false,
			]);
		});
	});

	describe("when the page goes away", () => {
		it("does not fail when a save finishes after the switch is gone", async () => {
			const held = holdSaves();
			const hook = mount(true);
			await press(hook, false);
			hook.unmount();

			await expect(
				act(async () => {
					held[0]?.resolve(null);
					await Promise.resolve();
				})
			).resolves.not.toThrow();
		});
	});
});
