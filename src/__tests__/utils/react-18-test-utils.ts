/**
 * React 18 test utilities to handle concurrent features and prevent act() warnings
 */

import { act, waitFor } from "@testing-library/react";

/**
 * Wait for React to finish rendering and handle concurrent features
 */
export async function waitForComponentToLoad() {
	// Allow React to finish any pending updates
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

/**
 * Wrapper for userEvent interactions that handles React 18 concurrent features
 */
export async function userEventWithAct(
	callback: () => Promise<void> | void
): Promise<void> {
	await act(async () => {
		await callback();
		// Give React time to process the event
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

/**
 * Enhanced waitFor that handles React 18 better
 */
export function waitForWithRetry<T>(
	callback: () => T | Promise<T>,
	options?: {
		timeout?: number;
		interval?: number;
	}
): Promise<T> {
	const { timeout = 5000, interval = 50 } = options || {};

	return waitFor(callback, {
		timeout,
		interval,
		onTimeout: (error) => error,
	});
}

/**
 * Helper to wait for async component updates
 */
export async function waitForAsyncUpdates(ms = 100): Promise<void> {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, ms));
	});
}

/**
 * Helper to flush all pending promises and microtasks
 */
export async function flushPromises(): Promise<void> {
	await act(async () => {
		await new Promise((resolve) => {
			setTimeout(resolve, 0);
			if (typeof process !== "undefined" && process.nextTick) {
				process.nextTick(resolve);
			}
		});
	});
}

/**
 * Render helper that waits for initial render to complete
 */
export async function renderAndWait<T>(renderFn: () => T): Promise<T> {
	let result: T | undefined;

	await act(() => {
		result = renderFn();
	});

	await waitForComponentToLoad();

	if (result === undefined) {
		throw new Error("renderFn did not return a value");
	}

	return result;
}

/**
 * Helper to handle tooltip and popover delays in tests
 */
export async function waitForTooltip(delayMs = 700): Promise<void> {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	});
}

/**
 * Helper to properly unmount components in React 18
 */
export async function unmountComponentWithAct(
	unmountFn: () => void
): Promise<void> {
	await act(() => {
		unmountFn();
	});
}
