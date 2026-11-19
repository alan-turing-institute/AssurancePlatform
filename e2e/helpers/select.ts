import { expect, type Locator } from "@playwright/test";

/**
 * Opens a Radix Select and waits until it is ready to receive an outside
 * press. Radix queues the timer that arms its outside-press listener when the
 * dropdown mounts. It moves focus to the current option only after
 * positioning, which is later, so focus on that option proves the timer is
 * queued; a zero-delay timer queued afterwards then proves it has run.
 */
export async function openSelect(trigger: Locator): Promise<void> {
	await trigger.click();
	await expect(
		trigger.page().getByRole("listbox").getByRole("option", { selected: true })
	).toBeFocused();
	// Timers of equal delay run in the order they were queued, so this timer
	// runs after the one that arms the outside-press listener.
	await trigger.page().evaluate(
		() =>
			new Promise<void>((resolve) => {
				setTimeout(resolve, 0);
			})
	);
}
