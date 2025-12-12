"use client";

/**
 * Menu Items Component
 *
 * Reusable menu item components for context menus.
 * Supports icons, shortcuts, disabled states, separators, and sub-menus.
 *
 * @module menus/MenuItems
 */

import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import React, { useState } from "react";

/**
 * Menu separator type
 */
type MenuSeparator = {
	type: "separator";
};

/**
 * Regular menu item type
 */
type MenuItem = {
	label: string;
	icon?: LucideIcon;
	action?: string;
	shortcut?: string;
	description?: string;
	submenu?: MenuItemConfig[];
	disabled?: boolean | string | ((context: unknown) => boolean);
	dangerous?: boolean;
	color?: string | null;
	type?: never;
};

/**
 * Menu item config type (union of item or separator)
 */
type MenuItemConfig = MenuItem | MenuSeparator;

/**
 * MenuItem Component Props
 */
type MenuItemProps = {
	label: string;
	icon?: LucideIcon;
	shortcut?: string;
	description?: string;
	action?: string;
	onClick?: (action: string | undefined, event: React.MouseEvent) => void;
	disabled?: boolean | string | ((context: unknown) => boolean);
	dangerous?: boolean;
	submenu?: MenuItemConfig[] | null;
	color?: string | null;
	className?: string;
};

/**
 * MenuItem Component
 *
 * Single menu item with icon, label, shortcut, and optional submenu
 */
export const MenuItem = ({
	label,
	icon: Icon,
	shortcut,
	description,
	action,
	onClick,
	disabled = false,
	dangerous = false,
	submenu = null,
	color = null,
	className = "",
}: MenuItemProps) => {
	const [showSubmenu, setShowSubmenu] = useState(false);
	const [submenuPosition, setSubmenuPosition] = useState<"left" | "right">(
		"right"
	);
	const itemRef = React.useRef<HTMLDivElement>(null);

	// Compute actual disabled state (string/function disabled is handled elsewhere)
	const isDisabled = typeof disabled === "boolean" ? disabled : !!disabled;

	const handleClick = (e: React.MouseEvent) => {
		if (isDisabled) {
			return;
		}

		if (submenu) {
			setShowSubmenu(!showSubmenu);
		} else if (onClick) {
			onClick(action, e);
		}
	};

	const handleMouseEnter = () => {
		if (submenu && !isDisabled) {
			// Calculate submenu position to avoid overflow
			if (itemRef.current) {
				const rect = itemRef.current.getBoundingClientRect();
				const spaceRight = window.innerWidth - rect.right;
				const spaceLeft = rect.left;

				setSubmenuPosition(
					spaceRight < 250 && spaceLeft > spaceRight ? "left" : "right"
				);
			}
			setShowSubmenu(true);
		}
	};

	const handleMouseLeave = () => {
		if (submenu) {
			// Delay hiding to allow mouse to move to submenu
			setTimeout(() => setShowSubmenu(false), 100);
		}
	};

	const colorClasses = color
		? {
				red: "text-red-400",
				orange: "text-orange-400",
				yellow: "text-yellow-400",
				green: "text-green-400",
				blue: "text-blue-400",
				purple: "text-purple-400",
				cyan: "text-cyan-400",
				gray: "text-gray-400",
			}[color]
		: "";

	// Determine button style classes
	let buttonStyleClasses: string;
	if (isDisabled) {
		buttonStyleClasses = "cursor-not-allowed text-gray-500 opacity-50";
	} else if (dangerous) {
		buttonStyleClasses = "text-red-400 hover:bg-red-500/10 hover:text-red-300";
	} else {
		buttonStyleClasses =
			"text-text-light hover:bg-background-transparent-white-hover";
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: MenuItem container with interactive button child
		<div
			className={`relative ${className}`}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			ref={itemRef}
			role="presentation"
		>
			<button
				className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-all duration-200 ${buttonStyleClasses}
          ${submenu ? "justify-between" : ""}rounded`}
				disabled={isDisabled}
				onClick={handleClick}
				title={description}
				type="button"
			>
				<div className="flex min-w-0 flex-1 items-center gap-3">
					{/* Icon */}
					{Icon && (
						<Icon
							className={`h-4 w-4 shrink-0 ${colorClasses || (dangerous ? "text-red-400" : "text-icon-light-secondary")}`}
							strokeWidth={2}
						/>
					)}

					{/* Label */}
					<span className="truncate">{label}</span>
				</div>

				{/* Shortcut or Submenu Indicator */}
				{shortcut && !submenu && (
					<span className="ml-auto shrink-0 font-mono text-gray-500 text-xs">
						{shortcut}
					</span>
				)}

				{submenu && (
					<ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
				)}
			</button>

			{/* Submenu */}
			{submenu && (
				<AnimatePresence>
					{showSubmenu && (
						<motion.div
							animate={{ opacity: 1, scale: 1 }}
							className={`absolute top-0 ${submenuPosition === "right" ? "left-full ml-1" : "right-full mr-1"}min-w-[200px] f-effect-backdrop-blur-lg z-50 max-w-[250px] rounded-lg border border-transparent bg-background-transparent-black-secondary py-1 shadow-3d`}
							exit={{ opacity: 0, scale: 0.95 }}
							initial={{ opacity: 0, scale: 0.95 }}
							onMouseEnter={() => setShowSubmenu(true)}
							onMouseLeave={() => setShowSubmenu(false)}
							transition={{ duration: 0.15 }}
						>
							{submenu.map((item, index) => {
								if (item.type === "separator") {
									// biome-ignore lint/suspicious/noArrayIndexKey: separators have no unique identifier
									return <MenuSeparator key={`separator-${index}`} />;
								}
								return (
									<MenuItem
										key={item.action || index}
										{...item}
										onClick={onClick}
									/>
								);
							})}
						</motion.div>
					)}
				</AnimatePresence>
			)}
		</div>
	);
};

/**
 * MenuSeparator Component Props
 */
type MenuSeparatorProps = {
	className?: string;
};

/**
 * MenuSeparator Component
 *
 * Visual separator between menu sections
 */
export const MenuSeparator = ({ className = "" }: MenuSeparatorProps) => (
	<div className={`my-1 h-px bg-border-transparent ${className}`} />
);

/**
 * MenuHeader Component Props
 */
type MenuHeaderProps = {
	label: string;
	className?: string;
};

/**
 * MenuHeader Component
 *
 * Section header within menu
 */
export const MenuHeader = ({ label, className = "" }: MenuHeaderProps) => (
	<div
		className={`px-3 py-2 font-semibold text-gray-500 text-xs uppercase tracking-wider ${className}
      `}
	>
		{label}
	</div>
);

/**
 * MenuFooter Component Props
 */
type MenuFooterProps = {
	children: React.ReactNode;
	className?: string;
};

/**
 * MenuFooter Component
 *
 * Footer section with additional info or actions
 */
export const MenuFooter = ({ children, className = "" }: MenuFooterProps) => (
	<div
		className={`border-transparent border-t px-3 py-2 ${className}
      `}
	>
		{children}
	</div>
);

/**
 * Recent actions menu item type
 */
type RecentActionItem = MenuItemConfig;

/**
 * RecentActionsMenu Component Props
 */
type RecentActionsMenuProps = {
	recentActions?: RecentActionItem[];
	onClick?: (action: string | undefined, event: React.MouseEvent) => void;
	maxItems?: number;
};

/**
 * RecentActionsMenu Component
 *
 * Shows recently used actions for quick access
 */
export const RecentActionsMenu = ({
	recentActions = [],
	onClick,
	maxItems = 3,
}: RecentActionsMenuProps) => {
	if (!recentActions || recentActions.length === 0) {
		return null;
	}

	return (
		<>
			<MenuHeader label="Recent Actions" />
			{recentActions.slice(0, maxItems).map((item, index) => {
				if (item.type === "separator") {
					// biome-ignore lint/suspicious/noArrayIndexKey: separators have no unique identifier
					return <MenuSeparator key={`separator-${index}`} />;
				}
				return (
					<MenuItem
						key={item.action || item.label}
						{...item}
						onClick={onClick}
					/>
				);
			})}
			<MenuSeparator />
		</>
	);
};

/**
 * Keyboard shortcut type
 */
type KeyboardShortcut = {
	label: string;
	key: string;
};

/**
 * KeyboardShortcutsHint Component Props
 */
type KeyboardShortcutsHintProps = {
	shortcuts?: KeyboardShortcut[];
};

/**
 * KeyboardShortcutsHint Component
 *
 * Shows keyboard shortcut hints at bottom of menu
 */
export const KeyboardShortcutsHint = ({
	shortcuts = [],
}: KeyboardShortcutsHintProps) => {
	if (!shortcuts || shortcuts.length === 0) {
		return null;
	}

	return (
		<MenuFooter>
			<div className="space-y-1 text-gray-600 text-xs">
				{shortcuts.map((shortcut) => (
					<div className="flex items-center justify-between" key={shortcut.key}>
						<span>{shortcut.label}</span>
						<kbd className="rounded bg-background-transparent-white-hover px-1.5 py-0.5 font-mono text-xs">
							{shortcut.key}
						</kbd>
					</div>
				))}
			</div>
		</MenuFooter>
	);
};

/**
 * SearchableMenu Component Props
 */
type SearchableMenuProps = {
	items?: MenuItemConfig[];
	onClick?: (action: string | undefined, event: React.MouseEvent) => void;
	placeholder?: string;
};

/**
 * SearchableMenu Component
 *
 * Menu with search/filter capability for long lists
 */
export const SearchableMenu = ({
	items = [],
	onClick,
	placeholder = "Search...",
}: SearchableMenuProps) => {
	const [searchTerm, setSearchTerm] = useState("");

	// Filter out separators and search through actual menu items
	const filteredItems = items.filter((item) => {
		if (item.type === "separator") {
			return false;
		}
		return (
			item.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			item.description?.toLowerCase().includes(searchTerm.toLowerCase())
		);
	});

	return (
		<>
			<div className="px-3 py-2">
				<input
					autoFocus
					className={
						"w-full rounded border border-transparent bg-background-transparent-white-hover px-2 py-1 text-sm text-text-light placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/50"
					}
					onChange={(e) => setSearchTerm(e.target.value)}
					placeholder={placeholder}
					type="text"
					value={searchTerm}
				/>
			</div>
			<MenuSeparator />
			<div className="max-h-64 overflow-y-auto">
				{filteredItems.length > 0 ? (
					filteredItems.map((item) => {
						if (item.type === "separator") {
							return null;
						}
						return (
							<MenuItem
								key={item.action || item.label}
								{...item}
								onClick={onClick}
							/>
						);
					})
				) : (
					<div className="px-3 py-2 text-center text-gray-500 text-sm">
						No matches found
					</div>
				)}
			</div>
		</>
	);
};

/**
 * renderMenuItems
 *
 * Helper function to render a list of menu items from config
 */
export function renderMenuItems(
	menuConfig: MenuItemConfig[],
	onClick?: (action: string | undefined, event: React.MouseEvent) => void
): React.ReactNode {
	let separatorCount = 0;
	return menuConfig.map((item) => {
		if (item.type === "separator") {
			separatorCount++;
			return <MenuSeparator key={`separator-${separatorCount}`} />;
		}

		return (
			<MenuItem key={item.action || item.label} {...item} onClick={onClick} />
		);
	});
}

/**
 * MenuItemGroup Component Props
 */
type MenuItemGroupProps = {
	label?: string;
	items?: MenuItemConfig[];
	onClick?: (action: string | undefined, event: React.MouseEvent) => void;
};

/**
 * MenuItemGroup Component
 *
 * Groups related menu items with optional header
 */
export const MenuItemGroup = ({
	label,
	items = [],
	onClick,
}: MenuItemGroupProps) => {
	let separatorCount = 0;
	return (
		<>
			{label && <MenuHeader label={label} />}
			{items.map((item) => {
				if (item.type === "separator") {
					separatorCount++;
					return <MenuSeparator key={`separator-${separatorCount}`} />;
				}
				return (
					<MenuItem
						key={item.action || item.label}
						{...item}
						onClick={onClick}
					/>
				);
			})}
		</>
	);
};

/**
 * ConditionalMenuItem Component Props
 */
type ConditionalMenuItemProps = {
	condition: boolean;
	children: React.ReactNode;
	fallback?: React.ReactNode;
};

/**
 * ConditionalMenuItem Component
 *
 * Only renders if condition is met
 */
export const ConditionalMenuItem = ({
	condition,
	children,
	fallback = null,
}: ConditionalMenuItemProps) => (condition ? children : fallback);

export default {
	MenuItem,
	MenuSeparator,
	MenuHeader,
	MenuFooter,
	RecentActionsMenu,
	KeyboardShortcutsHint,
	SearchableMenu,
	renderMenuItems,
	MenuItemGroup,
	ConditionalMenuItem,
};
