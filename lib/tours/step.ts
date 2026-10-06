import type { Step } from "nextstepjs";

interface StepInput {
	content: string;
	final?: boolean;
	side: NonNullable<Step["side"]>;
	/** Value of the `data-tour` attribute to spotlight; omit for a centred step. */
	target?: string;
	title: string;
}

/**
 * Builds a tour step with the platform's shared defaults: controls shown,
 * skip offered on every step except the final one, and a padded rounded
 * spotlight around a target (none for a centred step).
 */
export function tourStep({
	content,
	final = false,
	side,
	target,
	title,
}: StepInput): Step {
	return {
		title,
		content,
		...(target ? { selector: `[data-tour='${target}']` } : {}),
		side,
		showControls: true,
		showSkip: !final,
		pointerPadding: target ? 10 : 0,
		pointerRadius: target ? 8 : 0,
	};
}
