/**
 * Enhanced Radix UI component mocks for testing
 * These mocks simulate the behavior of Radix UI components without delays
 */

import type { ReactElement, ReactNode } from "react";
import React, { cloneElement, useEffect, useRef, useState } from "react";

// Common mock prop types
type MockComponentProps = {
	children?: ReactNode;
	[key: string]: unknown;
};

type MockTriggerProps = {
	children?: ReactNode;
	asChild?: boolean;
	[key: string]: unknown;
};

type MockRootProps = {
	children?: ReactNode;
	defaultOpen?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

type MockValueRootProps = {
	children?: ReactNode;
	defaultValue?: string;
	value?: string;
	onValueChange?: (value: string) => void;
	[key: string]: unknown;
};

type MockSelectItemProps = {
	children?: ReactNode;
	value: string;
	disabled?: boolean;
	[key: string]: unknown;
};

// Tooltip Mock with state management
type TooltipContextValue = {
	open: boolean;
	setOpen: (open: boolean) => void;
};

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

export const MockTooltipProvider = ({ children }: { children: ReactNode }) => (
	<>{children}</>
);

type TooltipRootProps = {
	children?: ReactNode;
	defaultOpen?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

export const MockTooltipRoot = ({
	children,
	defaultOpen = false,
	open: controlledOpen,
	onOpenChange,
}: TooltipRootProps) => {
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

type TooltipTriggerProps = {
	children?: ReactNode;
	asChild?: boolean;
	disabled?: boolean;
	[key: string]: unknown;
};

export const MockTooltipTrigger = ({
	children,
	asChild,
	...props
}: TooltipTriggerProps) => {
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
		(React.isValidElement(children) &&
			(children.props as Record<string, unknown>)?.disabled);

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
				<button
					type="button"
					{...triggerProps}
					ref={ref as React.RefObject<HTMLButtonElement>}
				>
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

type TooltipContentProps = {
	children?: ReactNode;
	sideOffset?: number;
	side?: string;
	align?: string;
	[key: string]: unknown;
};

export const MockTooltipContent = ({
	children,
	sideOffset: _sideOffset,
	...props
}: TooltipContentProps) => {
	const context = React.useContext(TooltipContext);

	if (!context?.open) {
		return null;
	}

	// Filter out Radix-specific props that shouldn't be on DOM elements
	const { side: _side, align: _align, ...domProps } = props;

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

export const MockTooltipArrow = () => <div data-testid="tooltip-arrow" />;

// Dialog Mock with state management
type DialogContextValue = {
	open: boolean;
	setOpen: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

export const MockDialogRoot = ({
	children,
	defaultOpen = false,
	open: controlledOpen,
	onOpenChange,
}: MockRootProps) => {
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

export const MockDialogTrigger = ({
	children,
	asChild,
	...props
}: MockTriggerProps) => {
	const context = React.useContext(DialogContext);

	const handleClick = () => {
		context?.setOpen(true);
	};

	const triggerProps = {
		onClick: handleClick,
		"aria-haspopup": "dialog" as const,
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

export const MockDialogOverlay = ({
	children,
	...props
}: MockComponentProps) => (
	<div data-testid="dialog-overlay" {...props}>
		{children}
	</div>
);

export const MockDialogContent = ({
	children,
	...props
}: MockComponentProps) => {
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

type DialogCloseProps = {
	children?: ReactNode;
	asChild?: boolean;
	"aria-label"?: string;
	[key: string]: unknown;
};

export const MockDialogClose = ({
	children,
	asChild,
	...props
}: DialogCloseProps) => {
	const context = React.useContext(DialogContext);

	const handleClick = (evt: React.MouseEvent) => {
		// Call the child's onClick if it exists
		if (asChild && React.isValidElement(children)) {
			const childProps = children.props as Record<string, unknown>;
			if (typeof childProps.onClick === "function") {
				(childProps.onClick as (e: React.MouseEvent) => void)(evt);
			}
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
			...(children.props as Record<string, unknown>),
			onClick: handleClick,
		};
		return cloneElement(children as ReactElement, childProps);
	}

	return <button {...closeProps}>{children}</button>;
};

export const MockDialogTitle = ({ children, ...props }: MockComponentProps) => (
	<h2 data-testid="dialog-title" id="dialog-title" {...props}>
		{children}
	</h2>
);

export const MockDialogDescription = ({
	children,
	...props
}: MockComponentProps) => (
	<p data-testid="dialog-description" id="dialog-description" {...props}>
		{children}
	</p>
);

// Popover Mock (similar to Dialog)
export const MockPopoverRoot = MockDialogRoot;
export const MockPopoverTrigger = MockDialogTrigger;
export const MockPopoverPortal = MockDialogPortal;
export const MockPopoverContent = ({
	children,
	...props
}: MockComponentProps) => {
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
type RadioGroupContextValue = {
	value: string;
	setValue: (value: string) => void;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
	null
);

export const MockRadioGroupRoot = ({
	children,
	defaultValue,
	value: controlledValue,
	onValueChange,
	...props
}: MockValueRootProps) => {
	// For controlled component, use controlledValue directly
	// For uncontrolled, use internal state
	const [internalValue, setInternalValue] = useState(defaultValue ?? "");
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
		<RadioGroupContext.Provider
			value={{ value: currentValue, setValue: handleValueChange }}
		>
			<div
				aria-required={props.required as boolean | undefined}
				role="radiogroup"
				{...props}
			>
				{children}
			</div>
		</RadioGroupContext.Provider>
	);
};

type RadioGroupItemProps = {
	children?: ReactNode;
	value: string;
	disabled?: boolean;
	[key: string]: unknown;
};

export const MockRadioGroupItem = ({
	children,
	value: itemValue,
	disabled,
	...props
}: RadioGroupItemProps) => {
	const context = React.useContext(RadioGroupContext);

	if (!context) {
		throw new Error("RadioGroupItem must be used within a RadioGroup");
	}

	const isChecked = context.value === itemValue;

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!disabled) {
			// Call setValue which will trigger onValueChange in the parent
			context.setValue(itemValue);
		}
	};

	// Render to match Radix UI's actual behavior — use input[type=radio] for correct semantics
	return (
		<input
			aria-checked={isChecked}
			checked={isChecked}
			data-state={isChecked ? "checked" : "unchecked"}
			data-value={itemValue}
			disabled={disabled}
			onChange={() => {
				// onChange required for controlled input; logic handled in onClick
			}}
			onClick={handleClick}
			onMouseDown={(e) => e.preventDefault()}
			type="radio"
			value={itemValue}
			{...props}
		/>
	);
};

// Add the Indicator mock
export const MockRadioGroupIndicator = ({
	children,
}: {
	children: React.ReactNode;
}) => <>{children}</>;

// DropdownMenu Mock with state management
type DropdownMenuContextValue = {
	open: boolean;
	setOpen: (open: boolean) => void;
};

const DropdownMenuContext =
	React.createContext<DropdownMenuContextValue | null>(null);

export const MockDropdownMenuRoot = ({
	children,
	defaultOpen = false,
	open: controlledOpen,
	onOpenChange,
}: MockRootProps) => {
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

export const MockDropdownMenuTrigger = ({
	children,
	asChild,
	...props
}: MockTriggerProps) => {
	const context = React.useContext(DropdownMenuContext);

	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		context?.setOpen(!context.open);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			context?.setOpen(!context.open);
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			context?.setOpen(true);
		}
	};

	const triggerProps = {
		onClick: handleClick,
		onKeyDown: handleKeyDown,
		"aria-haspopup": "menu" as const,
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

export const MockDropdownMenuPortal = ({
	children,
}: {
	children: ReactNode;
}) => {
	const context = React.useContext(DropdownMenuContext);

	if (!context?.open) {
		return null;
	}

	return <>{children}</>;
};

export const MockDropdownMenuContent = ({
	children,
	...props
}: MockComponentProps) => {
	const context = React.useContext(DropdownMenuContext);
	const contentRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!context?.open) {
			return;
		}

		// Focus first menu item when opened
		setTimeout(() => {
			const firstMenuItem = contentRef.current?.querySelector(
				'[role="menuitem"]:not([aria-disabled="true"])'
			) as HTMLElement;
			if (firstMenuItem) {
				firstMenuItem.focus();
			}
		}, 0);

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				context?.setOpen(false);
			} else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				const menuItems = contentRef.current?.querySelectorAll(
					'[role="menuitem"]:not([aria-disabled="true"])'
				) as NodeListOf<HTMLElement>;
				if (!menuItems || menuItems.length === 0) {
					return;
				}

				const currentIndex = Array.from(menuItems).indexOf(
					document.activeElement as HTMLElement
				);
				let nextIndex: number;

				if (event.key === "ArrowDown") {
					nextIndex =
						currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
				} else {
					nextIndex =
						currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
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
	const {
		side: _side,
		align: _align,
		sideOffset: _sideOffset,
		alignOffset: _alignOffset,
		...domProps
	} = props;

	return (
		<div
			data-testid="dropdown-content"
			ref={contentRef}
			role="menu"
			{...domProps}
		>
			{children}
		</div>
	);
};

type DropdownMenuItemProps = {
	children?: ReactNode;
	onSelect?: (event: React.MouseEvent | React.KeyboardEvent) => void;
	disabled?: boolean;
	asChild?: boolean;
	textValue?: string;
	[key: string]: unknown;
};

export const MockDropdownMenuItem = ({
	children,
	onSelect,
	disabled,
	asChild,
	...props
}: DropdownMenuItemProps) => {
	const context = React.useContext(DropdownMenuContext);
	const ref = useRef<HTMLDivElement>(null);

	const handleClick = (e: React.MouseEvent) => {
		if (disabled) {
			return;
		}

		e.preventDefault();
		onSelect?.(e);
		context?.setOpen(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (disabled) {
			return;
		}

		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onSelect?.(e);
			context?.setOpen(false);
		}
	};

	// Filter out Radix-specific props that shouldn't be on DOM elements
	const {
		asChild: _asChild,
		onSelect: _onSelect,
		textValue: _textValue,
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
			aria-disabled={disabled}
			data-disabled={disabled ? "" : undefined}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			ref={ref}
			role="menuitem"
			tabIndex={disabled ? -1 : 0}
			{...domProps}
		>
			{children}
		</div>
	);
};

export const MockDropdownMenuSeparator = ({ ...props }: MockComponentProps) => (
	<hr {...props} />
);

export const MockDropdownMenuLabel = ({
	children,
	...props
}: MockComponentProps) => (
	<div role="none" {...props}>
		{children}
	</div>
);

export const MockDropdownMenuGroup = ({
	children,
	...props
}: MockComponentProps) => <fieldset {...props}>{children}</fieldset>;

export const MockDropdownMenuSub = ({ children }: { children: ReactNode }) => (
	<>{children}</>
);

export const MockDropdownMenuSubTrigger = ({
	children,
	...props
}: MockComponentProps) => (
	<div aria-haspopup="menu" role="menuitem" tabIndex={0} {...props}>
		{children}
	</div>
);

export const MockDropdownMenuSubContent = ({
	children,
	...props
}: MockComponentProps) => (
	<div role="menu" {...props}>
		{children}
	</div>
);

export const MockDropdownMenuRadioGroup = ({
	children,
	...props
}: MockComponentProps) => <fieldset {...props}>{children}</fieldset>;

type DropdownMenuRadioItemProps = {
	children?: ReactNode;
	value: string;
	checked?: boolean;
	onSelect?: (value: string) => void;
	disabled?: boolean;
	[key: string]: unknown;
};

export const MockDropdownMenuRadioItem = ({
	children,
	value,
	checked,
	onSelect,
	disabled,
	...props
}: DropdownMenuRadioItemProps) => {
	const handleClick = (e: React.MouseEvent) => {
		if (disabled) {
			return;
		}
		e.preventDefault();
		onSelect?.(value);
	};

	return (
		<div
			aria-checked={checked}
			aria-disabled={disabled}
			data-disabled={disabled ? "" : undefined}
			onClick={handleClick}
			onKeyDown={(e) => {
				if (disabled || (e.key !== "Enter" && e.key !== " ")) {
					return;
				}
				e.preventDefault();
				onSelect?.(value);
			}}
			role="menuitemradio"
			tabIndex={disabled ? -1 : 0}
			{...props}
		>
			{children}
		</div>
	);
};

type DropdownMenuCheckboxItemProps = {
	children?: ReactNode;
	checked?: boolean;
	onCheckedChange?: (checked: boolean) => void;
	disabled?: boolean;
	[key: string]: unknown;
};

export const MockDropdownMenuCheckboxItem = ({
	children,
	checked,
	onCheckedChange,
	disabled,
	...props
}: DropdownMenuCheckboxItemProps) => {
	const handleClick = (e: React.MouseEvent) => {
		if (disabled) {
			return;
		}
		e.preventDefault();
		onCheckedChange?.(!checked);
	};

	return (
		<div
			aria-checked={checked}
			aria-disabled={disabled}
			data-disabled={disabled ? "" : undefined}
			onClick={handleClick}
			onKeyDown={(e) => {
				if (disabled || (e.key !== "Enter" && e.key !== " ")) {
					return;
				}
				e.preventDefault();
				onCheckedChange?.(!checked);
			}}
			role="menuitemcheckbox"
			tabIndex={disabled ? -1 : 0}
			{...props}
		>
			{children}
		</div>
	);
};

export const MockDropdownMenuItemIndicator = ({
	children,
}: {
	children: React.ReactNode;
}) => <>{children}</>;

// Select Mock with state management
type SelectContextValue = {
	value: string;
	setValue: (value: string) => void;
	open: boolean;
	setOpen: (open: boolean) => void;
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

type SelectRootProps = {
	children?: ReactNode;
	defaultValue?: string;
	value?: string;
	onValueChange?: (value: string) => void;
};

export const MockSelectRoot = ({
	children,
	defaultValue,
	value: controlledValue,
	onValueChange,
}: SelectRootProps) => {
	const [internalValue, setInternalValue] = useState(defaultValue ?? "");
	const [open, setOpen] = useState(false);
	const isControlled = controlledValue !== undefined;
	const currentValue = isControlled ? controlledValue : internalValue;

	const handleValueChange = (newValue: string) => {
		if (!isControlled) {
			setInternalValue(newValue);
		}
		onValueChange?.(newValue);
		setOpen(false);
	};

	return (
		<SelectContext.Provider
			value={{
				value: currentValue,
				setValue: handleValueChange,
				open,
				setOpen,
			}}
		>
			{children}
		</SelectContext.Provider>
	);
};

export const MockSelectTrigger = ({
	children,
	asChild: _asChild,
	...props
}: MockTriggerProps) => {
	const context = React.useContext(SelectContext);

	const handleClick = () => {
		context?.setOpen(!context.open);
	};

	return (
		<button
			aria-controls="mock-select-listbox"
			aria-expanded={context?.open}
			aria-haspopup="listbox"
			data-state={context?.open ? "open" : "closed"}
			onClick={handleClick}
			role="combobox"
			type="button"
			{...props}
		>
			{children}
		</button>
	);
};

export const MockSelectValue = ({ placeholder }: { placeholder?: string }) => {
	const context = React.useContext(SelectContext);
	return <span>{context?.value || placeholder}</span>;
};

type SelectIconProps = {
	children?: ReactNode;
	asChild?: boolean;
};

export const MockSelectIcon = ({ children, asChild }: SelectIconProps) => {
	if (asChild && React.isValidElement(children)) {
		return children;
	}
	return <span>{children}</span>;
};

export const MockSelectPortal = ({ children }: { children: ReactNode }) => (
	<>{children}</>
);

export const MockSelectContent = ({
	children,
	...props
}: MockComponentProps) => {
	const context = React.useContext(SelectContext);

	if (!context?.open) {
		return null;
	}

	const {
		position: _position,
		side: _side,
		align: _align,
		sideOffset: _sideOffset,
		alignOffset: _alignOffset,
		...domProps
	} = props;

	return (
		<div data-testid="select-content" role="listbox" {...domProps}>
			{children}
		</div>
	);
};

export const MockSelectViewport = ({
	children,
	...props
}: MockComponentProps) => <div {...props}>{children}</div>;

export const MockSelectItem = ({
	children,
	value,
	disabled,
	...props
}: MockSelectItemProps) => {
	const context = React.useContext(SelectContext);
	const isSelected = context?.value === value;

	const handleClick = () => {
		if (!disabled) {
			context?.setValue(value);
		}
	};

	return (
		<div
			aria-disabled={disabled}
			aria-selected={isSelected}
			data-state={isSelected ? "checked" : "unchecked"}
			data-value={value}
			onClick={handleClick}
			onKeyDown={(e) => {
				if (disabled || (e.key !== "Enter" && e.key !== " ")) {
					return;
				}
				e.preventDefault();
				context?.setValue(value);
			}}
			role="option"
			tabIndex={disabled ? -1 : 0}
			{...props}
		>
			{children}
		</div>
	);
};

export const MockSelectItemText = ({ children }: { children: ReactNode }) => (
	<span>{children}</span>
);

export const MockSelectItemIndicator = ({
	children,
}: {
	children: ReactNode;
}) => <>{children}</>;

export const MockSelectGroup = ({ children, ...props }: MockComponentProps) => (
	<fieldset {...props}>{children}</fieldset>
);

export const MockSelectLabel = ({ children, ...props }: MockComponentProps) => (
	<div {...props}>{children}</div>
);

export const MockSelectSeparator = ({ ...props }: MockComponentProps) => (
	<hr {...props} />
);

export const MockSelectScrollUpButton = () => null;
export const MockSelectScrollDownButton = () => null;

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
