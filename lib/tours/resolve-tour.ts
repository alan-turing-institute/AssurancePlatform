import type { Step, Tour } from "nextstepjs";

interface ResolveOptions {
	intervalMs?: number;
	timeoutMs?: number;
}

function isLaidOut(selector: string): boolean {
	const element = document.querySelector(selector);
	if (!element) {
		return false;
	}
	const rect = element.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0;
}

function targeted(step: Step): step is Step & { selector: string } {
	return Boolean(step.selector);
}

/**
 * Waits for every step's target to appear on the page, then returns the tour
 * without the steps whose target is still missing. A step with no selector is
 * always kept. Polling stops early once every target is present, and gives up
 * after `timeoutMs` so a target that never renders (a toolbar button the user
 * has no permission for, or a navigation link hidden on a narrow window)
 * costs one short wait rather than a spotlight on the wrong element.
 */
export async function resolveTour(
	tour: Tour,
	{ timeoutMs = 1500, intervalMs = 100 }: ResolveOptions = {}
): Promise<Tour> {
	const selectors = tour.steps.filter(targeted).map((step) => step.selector);
	const deadline = Date.now() + timeoutMs;

	while (!selectors.every(isLaidOut) && Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}

	return {
		...tour,
		steps: tour.steps.filter(
			(step) => !targeted(step) || isLaidOut(step.selector)
		),
	};
}
