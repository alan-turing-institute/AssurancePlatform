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

// RadioGroup Mock with state management
interface RadioGroupContextValue {
	value: string;
	setValue: (value: string) => void;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

export const MockRadioGroupRoot = ({
	children,
	defaultValue,
	value: controlledValue,
	onValueChange,
	...props
}: any) => {
	// For controlled component, use controlledValue directly
	// For uncontrolled, use internal state
	const [internalValue, setInternalValue] = useState(defaultValue ?? '');
	const isControlled = controlledValue !== undefined;
	const currentValue = isControlled ? controlledValue : internalValue;

	const handleValueChange = (newValue: string) => {
		if (!isControlled) {
			setInternalValue(newValue);
		}
		// Always call onValueChange if provided
		onValueChange?.(newValue);
	};

	return (
		<RadioGroupContext.Provider value={{ value: currentValue, setValue: handleValueChange }}>
			<div role="radiogroup" aria-required={props.required} {...props}>
				{children}
			</div>
		</RadioGroupContext.Provider>
	);
};

export const MockRadioGroupItem = ({
	children,
	value: itemValue,
	disabled,
	...props
}: any) => {
	const context = React.useContext(RadioGroupContext);

	if (!context) {
		throw new Error('RadioGroupItem must be used within a RadioGroup');
	}

	const isChecked = context.value === itemValue;

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!disabled) {
			// Call setValue which will trigger onValueChange in the parent
			context.setValue(itemValue);
		}
	};

	// Render to match Radix UI's actual behavior
	return (
		<button
			type="button"
			role="radio"
			aria-checked={isChecked}
			data-state={isChecked ? "checked" : "unchecked"}
			data-value={itemValue}
			value={itemValue}
			onClick={handleClick}
			onMouseDown={(e) => e.preventDefault()} // Prevent focus issues
			disabled={disabled}
			{...props}
		>
			{children}
		</button>
	);
};

// Add the Indicator mock
export const MockRadioGroupIndicator = ({ children }: { children: React.ReactNode }) => {
	return <>{children}</>;
};

// DropdownMenu Mock with state management
interface DropdownMenuContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

export const MockDropdownMenuRoot = ({
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
		<DropdownMenuContext.Provider value={{ open, setOpen: handleOpenChange }}>
			{children}
		</DropdownMenuContext.Provider>
	);
};

export const MockDropdownMenuTrigger = ({ children, asChild, ...props }: any) => {
	const context = React.useContext(DropdownMenuContext);

	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		context?.setOpen(!context.open);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			context?.setOpen(!context.open);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			context?.setOpen(true);
		}
	};

	const triggerProps = {
		onClick: handleClick,
		onKeyDown: handleKeyDown,
		"aria-haspopup": "menu",
		"aria-expanded": context?.open,
		"data-state": context?.open ? "open" : "closed",
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

export const MockDropdownMenuPortal = ({ children }: { children: ReactNode }) => {
	const context = React.useContext(DropdownMenuContext);

	if (!context?.open) {
		return null;
	}

	return <>{children}</>;
};

export const MockDropdownMenuContent = ({ children, ...props }: any) => {
	const context = React.useContext(DropdownMenuContext);
	const contentRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!context?.open) {
			return;
		}

		// Focus first menu item when opened
		setTimeout(() => {
			const firstMenuItem = contentRef.current?.querySelector('[role="menuitem"]:not([aria-disabled="true"])') as HTMLElement;
			if (firstMenuItem) {
				firstMenuItem.focus();
			}
		}, 0);

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				context?.setOpen(false);
			} else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				const menuItems = contentRef.current?.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])') as NodeListOf<HTMLElement>;
				if (!menuItems || menuItems.length === 0) return;

				const currentIndex = Array.from(menuItems).findIndex(item => item === document.activeElement);
				let nextIndex: number;

				if (event.key === "ArrowDown") {
					nextIndex = currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
				} else {
					nextIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
				}

				menuItems[nextIndex]?.focus();
			}
		};

		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Element;
			if (!target.closest('[data-testid="dropdown-content"]')) {
				context?.setOpen(false);
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("click", handleClickOutside);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("click", handleClickOutside);
		};
	}, [context]);

	if (!context?.open) {
		return null;
	}

	// Filter out Radix-specific props that shouldn't be on DOM elements
	const { side, align, sideOffset, alignOffset, ...domProps } = props;

	return (
		<div
			ref={contentRef}
			data-testid="dropdown-content"
			role="menu"
			{...domProps}
		>
			{children}
		</div>
	);
};

export const MockDropdownMenuItem = ({ children, onSelect, disabled, asChild, ...props }: any) => {
	const context = React.useContext(DropdownMenuContext);
	const ref = useRef<HTMLDivElement>(null);

	const handleClick = (e: React.MouseEvent) => {
		if (disabled) return;

		e.preventDefault();
		onSelect?.(e);
		context?.setOpen(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (disabled) return;

		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onSelect?.(e);
			context?.setOpen(false);
		}
	};

	// Filter out Radix-specific props that shouldn't be on DOM elements
	const {
		asChild: _asChild,
		onSelect: _onSelect,
		textValue,
		...domProps
	} = props;

	if (asChild && React.isValidElement(children)) {
		return cloneElement(children as ReactElement, {
			role: "menuitem",
			tabIndex: disabled ? -1 : 0,
			"aria-disabled": disabled,
			"data-disabled": disabled ? "" : undefined,
			onClick: handleClick,
			onKeyDown: handleKeyDown,
			...domProps,
		});
	}

	return (
		<div
			ref={ref}
			role="menuitem"
			tabIndex={disabled ? -1 : 0}
			aria-disabled={disabled}
			data-disabled={disabled ? "" : undefined}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			{...domProps}
		>
			{children}
		</div>
	);
};

export const MockDropdownMenuSeparator = ({ ...props }: any) => {
	return <div role="separator" aria-orientation="horizontal" {...props} />;
};

export const MockDropdownMenuLabel = ({ children, ...props }: any) => {
	return <div role="none" {...props}>{children}</div>;
};

export const MockDropdownMenuGroup = ({ children, ...props }: any) => {
	return <div role="group" {...props}>{children}</div>;
};

export const MockDropdownMenuSub = ({ children }: { children: ReactNode }) => {
	return <>{children}</>;
};

export const MockDropdownMenuSubTrigger = ({ children, ...props }: any) => {
	return (
		<div role="menuitem" aria-haspopup="menu" {...props}>
			{children}
		</div>
	);
};

export const MockDropdownMenuSubContent = ({ children, ...props }: any) => {
	return (
		<div role="menu" {...props}>
			{children}
		</div>
	);
};

export const MockDropdownMenuRadioGroup = ({ children, ...props }: any) => {
	return (
		<div role="group" {...props}>
			{children}
		</div>
	);
};

export const MockDropdownMenuRadioItem = ({ children, value, onSelect, disabled, ...props }: any) => {
	const handleClick = (e: React.MouseEvent) => {
		if (disabled) return;
		e.preventDefault();
		onSelect?.(value);
	};

	return (
		<div
			role="menuitemradio"
			tabIndex={disabled ? -1 : 0}
			aria-disabled={disabled}
			data-disabled={disabled ? "" : undefined}
			onClick={handleClick}
			{...props}
		>
			{children}
		</div>
	);
};

export const MockDropdownMenuCheckboxItem = ({ children, checked, onCheckedChange, disabled, ...props }: any) => {
	const handleClick = (e: React.MouseEvent) => {
		if (disabled) return;
		e.preventDefault();
		onCheckedChange?.(!checked);
	};

	return (
		<div
			role="menuitemcheckbox"
			aria-checked={checked}
			tabIndex={disabled ? -1 : 0}
			aria-disabled={disabled}
			data-disabled={disabled ? "" : undefined}
			onClick={handleClick}
			{...props}
		>
			{children}
		</div>
	);
};

export const MockDropdownMenuItemIndicator = ({ children }: { children: React.ReactNode }) => {
	return <>{children}</>;
};

// Menu Mock (alias for DropdownMenu components)
export const MockMenuRoot = MockDropdownMenuRoot;
export const MockMenuTrigger = MockDropdownMenuTrigger;
export const MockMenuPortal = MockDropdownMenuPortal;
export const MockMenuContent = MockDropdownMenuContent;
export const MockMenuItem = MockDropdownMenuItem;
export const MockMenuSeparator = MockDropdownMenuSeparator;
export const MockMenuLabel = MockDropdownMenuLabel;
export const MockMenuGroup = MockDropdownMenuGroup;
export const MockMenuSub = MockDropdownMenuSub;
export const MockMenuSubTrigger = MockDropdownMenuSubTrigger;
export const MockMenuSubContent = MockDropdownMenuSubContent;
