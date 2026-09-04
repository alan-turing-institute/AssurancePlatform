import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

interface DisabledButtonHintProps extends ButtonProps {
	/**
	 * Why the button is inert. Rendered as `sr-only` text linked via
	 * `aria-describedby`, so screen-reader users get the reason a sighted
	 * user would read from a `title` tooltip. Ignored when `disabled` is
	 * false.
	 */
	disabledReason?: string;
}

/**
 * A `Button` that stays focusable and keyboard-reachable when logically
 * disabled, instead of using the native `disabled` attribute — which pulls
 * the control out of the tab order and hides `title` from assistive tech.
 * Uses `aria-disabled` plus a click guard so the button is still inert, and
 * an `aria-describedby`-linked `sr-only` span so the reason is announced.
 */
export const DisabledButtonHint = React.forwardRef<
	HTMLButtonElement,
	DisabledButtonHintProps
>(({ disabled, disabledReason, onClick, id, ...props }, ref) => {
	const generatedId = React.useId();
	const hintId = id ? `${id}-disabled-hint` : generatedId;
	const showHint = !!(disabled && disabledReason);

	return (
		<>
			<Button
				aria-describedby={showHint ? hintId : undefined}
				aria-disabled={disabled || undefined}
				id={id}
				onClick={(event) => {
					if (disabled) {
						event.preventDefault();
						return;
					}
					onClick?.(event);
				}}
				ref={ref}
				{...props}
			/>
			{showHint && (
				<span className="sr-only" id={hintId}>
					{disabledReason}
				</span>
			)}
		</>
	);
});
DisabledButtonHint.displayName = "DisabledButtonHint";
