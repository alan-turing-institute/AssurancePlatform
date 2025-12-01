"use client";

import { Indicator, Item, Root } from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
	React.ElementRef<typeof Root>,
	React.ComponentPropsWithoutRef<typeof Root>
>(({ className, ...props }, ref) => (
	<Root className={cn("grid gap-2", className)} {...props} ref={ref} />
));
RadioGroup.displayName = Root.displayName;

const RadioGroupItem = React.forwardRef<
	React.ElementRef<typeof Item>,
	React.ComponentPropsWithoutRef<typeof Item>
>(({ className, ...props }, ref) => (
	<Item
		className={cn(
			"aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
			className
		)}
		ref={ref}
		{...props}
	>
		<Indicator className="flex items-center justify-center">
			<Circle className="h-2.5 w-2.5 fill-current text-current" />
		</Indicator>
	</Item>
));
RadioGroupItem.displayName = Item.displayName;

export { RadioGroup, RadioGroupItem };
