/**
 * Enhanced Radix UI component mocks for testing
 * These mocks simulate the behavior of Radix UI components without delays
 */

import type { ReactElement, ReactNode } from "react";
import React, { cloneElement, useEffect, useRef, useState } from "react";

// Tooltip Mock with state management
interface TooltipContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

export const MockTooltipProvider = ({ children }: { children: ReactNode }) => {
	return <>{children}</>;
};

export const MockTooltipRoot = ({
	children,
	defaultOpen = false,
	open: controlledOpen,
	onOpenChange,
}: any) => {
	const [open, setOpen] = useState(controlledOpen ?? defaultOpen);

	useEffect(() => {
		if (controlledOpen !== undefined) {
			setOpen(controlledOpen);
		}
	}, [controlledOpen]);

	const handleOpenChange = (newOpen: boolean) => {
		if (controlledOpen === undefined) {
			setOpen(newOpen);
		}
		onOpenChange?.(newOpen);
	};

	return (
		<TooltipContext.Provider value={{ open, setOpen: handleOpenChange }}>
			{children}
		</TooltipContext.Provider>
	);
};

export const MockTooltipTrigger = ({ children, asChild, ...props }: any) => {
	const context = React.useContext(TooltipContext);
	const ref = useRef<HTMLElement>(null);

	const handleMouseEnter = () => {
		context?.setOpen(true);
	};

	const handleMouseLeave = () => {
		context?.setOpen(false);
	};

	const handleFocus = () => {
		context?.setOpen(true);
	};

	const handleBlur = () => {
		context?.setOpen(false);
	};

	// For disabled elements, we need to use pointer events on a wrapper
	const isDisabled =
		props.disabled ||
		(React.isValidElement(children) && (children.props as any)?.disabled);

	const triggerProps = {
		onMouseEnter: isDisabled ? undefined : handleMouseEnter,
		onMouseLeave: isDisabled ? undefined : handleMouseLeave,
		onFocus: isDisabled ? undefined : handleFocus,
		onBlur: isDisabled ? undefined : handleBlur,
		"aria-describedby": context?.open ? "tooltip" : undefined,
		...props,
	};

	// For disabled elements, wrap in a span that can capture pointer events
	if (isDisabled) {
		const wrapperProps = {
			onMouseEnter: handleMouseEnter,
			onMouseLeave: handleMouseLeave,
			style: { display: "inline-block" },
		};

		if (asChild && React.isValidElement(children)) {
			return (
				<span {...wrapperProps}>
					{cloneElement(children as ReactElement, { ...triggerProps, ref })}
				</span>
			);
		}

		return (
			<span {...wrapperProps}>
				<button type="button" {...triggerProps} ref={ref as any}>
					{children}
				</button>
			</span>
		);
	}

	if (asChild && React.isValidElement(children)) {
		return cloneElement(children as ReactElement, triggerProps);
	}

	return (
		<button type="button" {...triggerProps}>
			{children}
		</button>
	);
};

export const MockTooltipContent = ({ children, sideOffset, ...props }: any) => {
	const context = React.useContext(TooltipContext);

	if (!context?.open) {
		return null;
	}

	// Filter out Radix-specific props that shouldn't be on DOM elements
	const { side, align, ...domProps } = props;

	return (
		<div
			data-testid="tooltip-content"
			id="tooltip"
			role="tooltip"
			{...domProps}
		>
			{children}
		</div>
	);
};

export const MockTooltipArrow = () => {
	return <div data-testid="tooltip-arrow" />;
};

// Dialog Mock with state management
interface DialogContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

export const MockDialogRoot = ({
	children,
	defaultOpen = false,
	open: controlledOpen,
	onOpenChange,
}: any) => {
	const [open, setOpen] = useState(controlledOpen ?? defaultOpen);

	useEffect(() => {
		if (controlledOpen !== undefined) {
			setOpen(controlledOpen);
		}
	}, [controlledOpen]);

	const handleOpenChange = (newOpen: boolean) => {
		if (controlledOpen === undefined) {
			setOpen(newOpen);
		}
		onOpenChange?.(newOpen);
	};

	return (
		<DialogContext.Provider value={{ open, setOpen: handleOpenChange }}>
			{children}
		</DialogContext.Provider>
	);
};

export const MockDialogTrigger = ({ children, asChild, ...props }: any) => {
	const context = React.useContext(DialogContext);

	const handleClick = () => {
		context?.setOpen(true);
	};

	const triggerProps = {
		onClick: handleClick,
		"aria-haspopup": "dialog",
		"aria-expanded": context?.open,
		...props,
	};

	if (asChild && React.isValidElement(children)) {
		return cloneElement(children as ReactElement, triggerProps);
	}

	return (
		<button type="button" {...triggerProps}>
			{children}
		</button>
	);
};

export const MockDialogPortal = ({ children }: { children: ReactNode }) => {
	const context = React.useContext(DialogContext);

	if (!context?.open) {
		return null;
	}

	return <>{children}</>;
};

export const MockDialogOverlay = ({ children, ...props }: any) => {
	return (
		<div data-testid="dialog-overlay" {...props}>
			{children}
		</div>
	);
};

export const MockDialogContent = ({ children, ...props }: any) => {
	const context = React.useContext(DialogContext);
	const contentRef = useRef<HTMLDivElement>(null);

	// Handle Escape key
	useEffect(() => {
		if (!context?.open) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				context?.setOpen(false);
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [context]);

	if (!context?.open) {
		return null;
	}

	// Find title and description IDs from children
	const titleId = "dialog-title";
	const descriptionId = "dialog-description";

	return (
		<div
			aria-describedby={descriptionId}
			aria-labelledby={titleId}
			aria-modal="true"
			data-testid="dialog-content"
			ref={contentRef}
			role="dialog"
			{...props}
		>
			{children}
		</div>
	);
};

export const MockDialogClose = ({ children, asChild, ...props }: any) => {
	const context = React.useContext(DialogContext);

	const handleClick = (e: React.MouseEvent) => {
		// Call the child's onClick if it exists
		if (
			asChild &&
			React.isValidElement(children) &&
			(children.props as any).onClick
		) {
			(children.props as any).onClick(e);
		}
		context?.setOpen(false);
	};

	const closeProps = {
		onClick: handleClick,
		type: "button" as const,
		"aria-label": props["aria-label"] || "Close",
		...props,
	};

	if (asChild && React.isValidElement(children)) {
		// Merge props correctly, preserving the child's existing props
		const childProps = {
			...(children.props as any),
			onClick: handleClick,
		};
		return cloneElement(children as ReactElement, childProps);
	}

	return <button {...closeProps}>{children}</button>;
};

export const MockDialogTitle = ({ children, ...props }: any) => {
	return (
		<h2 data-testid="dialog-title" id="dialog-title" {...props}>
			{children}
		</h2>
	);
};

export const MockDialogDescription = ({ children, ...props }: any) => {
	return (
		<p data-testid="dialog-description" id="dialog-description" {...props}>
			{children}
		</p>
	);
};

// Popover Mock (similar to Dialog)
export const MockPopoverRoot = MockDialogRoot;
export const MockPopoverTrigger = MockDialogTrigger;
export const MockPopoverPortal = MockDialogPortal;
export const MockPopoverContent = ({ children, ...props }: any) => {
	const context = React.useContext(DialogContext);

	if (!context?.open) {
		return null;
	}

	return (
		<div data-testid="popover-content" role="dialog" {...props}>
			{children}
		</div>
	);
};
export const MockPopoverArrow = () => <div data-testid="popover-arrow" />;
export const MockPopoverClose = MockDialogClose;
export const MockPopoverAnchor = ({ children }: { children: ReactNode }) => (
	<>{children}</>
);
