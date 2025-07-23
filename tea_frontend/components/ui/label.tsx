"use client";

import { Root as LabelRoot } from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import React from "react";

import { cn } from "@/lib/utils";

const labelVariants = cva(
	"font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);

const Label = React.forwardRef<
	React.ElementRef<typeof LabelRoot>,
	React.ComponentPropsWithoutRef<typeof LabelRoot> &
		VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
	<LabelRoot className={cn(labelVariants(), className)} ref={ref} {...props} />
));
Label.displayName = LabelRoot.displayName;

export { Label };
