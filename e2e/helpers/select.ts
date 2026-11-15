import { expect, type Locator } from "@playwright/test";

/**
 * Opens a Radix Select and waits until it is ready to receive an outside
 * press. The listbox appears before the Select has armed its outside-press
 * listener; Radix moves keyboard focus to the option for the current value
 * only after that step, so focus on that option marks the point from which
 * a press outside the Select closes it.
 */
export async function openSelect(
	trigger: Locator,
	currentOptionName: string
): Promise<void> {
	await trigger.click();
	await expect(
		trigger.page().getByRole("option", { name: currentOptionName, exact: true })
	).toBeFocused();
	// The Select arms its outside-press listener in a zero-delay timer queued
	// when it mounts, which can still be pending when focus lands. Timers of
	// equal delay run in the order they were queued, so a zero-delay timer
	// queued now runs after it.
	await trigger.page().evaluate(
		() =>
			new Promise<void>((resolve) => {
				setTimeout(resolve, 0);
			})
	);
}
