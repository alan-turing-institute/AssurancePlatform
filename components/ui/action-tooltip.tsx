import * as React from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Forwards ref and any extra props (e.g. from an outer `PopoverTrigger
 * asChild`) through to the actual trigger element, so ActionTooltip can be
 * composed inside another Radix `asChild` chain — see node-add-popover.tsx.
 */
const ActionTooltip = React.forwardRef<
	HTMLButtonElement,
	{
		children: React.ReactNode;
		label: string;
	} & React.HTMLAttributes<HTMLButtonElement>
>(({ children, label, ...rest }, ref) => (
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger asChild ref={ref} {...rest}>
				{children}
			</TooltipTrigger>
			<TooltipContent>
				<p>{label}</p>
			</TooltipContent>
		</Tooltip>
	</TooltipProvider>
));
ActionTooltip.displayName = "ActionTooltip";

export default ActionTooltip;
