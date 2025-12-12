"use client";
/**
 * Context Menu Base Component
 *
 * Base context menu with positioning, keyboard navigation, and glassmorphism styling.
 * Handles right-click detection, click-outside, and escape key to close.
 *
 * Based on REACT_FLOW.md Section 4.2 specifications.
 *
 * @module menus/ContextMenu
 */

import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { renderMenuItems } from "./menu-items";

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
	color?: string;
	type?: never;
};

/**
 * Menu item configuration type (union of item or separator)
 */
type MenuItemConfig = MenuItem | MenuSeparator;

/**
 * ContextMenu Component Props
 */
type ContextMenuProps = {
	isOpen?: boolean;
	position?: { x: number; y: number };
	menuItems?: MenuItemConfig[];
	onClose?: () => void;
	onAction?: (
		action: string,
		context: unknown,
		event: React.MouseEvent
	) => void;
	context?: unknown;
	width?: number;
	maxHeight?: number;
	className?: string;
};

/**
 * ContextMenu Component
 *
 * Base context menu with positioning, keyboard navigation, and glassmorphism styling
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({
	isOpen = false,
	position = { x: 0, y: 0 },
	menuItems = [],
	onClose,
	onAction,
	context = {},
	width = 220,
	maxHeight = 400,
	className = "",
}) => {
	const menuRef = useRef<HTMLDivElement>(null);
	const [adjustedPosition, setAdjustedPosition] = useState(position);
	const [selectedIndex, setSelectedIndex] = useState(-1);

	/**
	 * Auto-position menu to stay on screen
	 */
	useEffect(() => {
		if (!(isOpen && menuRef.current)) {
			return;
		}

		const menuRect = menuRef.current.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		let { x, y } = position;

		// Adjust horizontal position
		if (x + menuRect.width > viewportWidth) {
			x = viewportWidth - menuRect.width - 10;
		}
		if (x < 10) {
			x = 10;
		}

		// Adjust vertical position
		if (y + menuRect.height > viewportHeight) {
			y = viewportHeight - menuRect.height - 10;
		}
		if (y < 10) {
			y = 10;
		}

		setAdjustedPosition({ x, y });
	}, [isOpen, position]);

	/**
	 * Handle menu action selection
	 */
	const handleAction = useCallback(
		(action: string | undefined, event: React.MouseEvent) => {
			if (!action) {
				return;
			}

			onAction?.(action, context, event);
			onClose?.();
		},
		[onAction, onClose, context]
	);

	/**
	 * Handle click outside to close
	 */
	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handleClickOutside = (event: MouseEvent): void => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				onClose?.();
			}
		};

		// Small delay to prevent immediate close from the triggering click
		const timer = setTimeout(() => {
			document.addEventListener("mousedown", handleClickOutside);
		}, 100);

		return () => {
			clearTimeout(timer);
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen, onClose]);

	/**
	 * Handle keyboard navigation
	 */
	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent): void => {
			// Get actionable items (exclude separators)
			const actionableItems = menuItems.filter(
				(item) => item.type !== "separator"
			);

			switch (event.key) {
				case "Escape":
					event.preventDefault();
					onClose?.();
					break;

				case "ArrowDown":
					event.preventDefault();
					setSelectedIndex((prev) =>
						prev < actionableItems.length - 1 ? prev + 1 : 0
					);
					break;

				case "ArrowUp":
					event.preventDefault();
					setSelectedIndex((prev) =>
						prev > 0 ? prev - 1 : actionableItems.length - 1
					);
					break;

				case "Enter":
					event.preventDefault();
					if (selectedIndex >= 0 && actionableItems[selectedIndex]) {
						handleAction(
							actionableItems[selectedIndex].action || "",
							event as unknown as React.MouseEvent
						);
					}
					break;

				case "Home":
					event.preventDefault();
					setSelectedIndex(0);
					break;

				case "End":
					event.preventDefault();
					setSelectedIndex(actionableItems.length - 1);
					break;

				default:
					break;
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, menuItems, selectedIndex, onClose, handleAction]);

	/**
	 * Prevent context menu on the context menu itself
	 */
	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	if (!isOpen) {
		return null;
	}

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					animate={{ opacity: 1, scale: 1, y: 0 }}
					className={`f-effect-backdrop-blur-lg fixed z-9999 min-w-[200px] overflow-hidden rounded-lg border border-transparent bg-background-transparent-black-secondary py-1 shadow-3d ${className}
          `}
					exit={{ opacity: 0, scale: 0.95, y: -10 }}
					initial={{ opacity: 0, scale: 0.95, y: -10 }}
					onContextMenu={handleContextMenu}
					ref={menuRef}
					style={{
						left: adjustedPosition.x,
						top: adjustedPosition.y,
						width,
						maxHeight,
					}}
					transition={{ duration: 0.15, ease: "easeOut" }}
				>
					<div className="max-h-full overflow-y-auto">
						{renderMenuItems(menuItems, handleAction)}
					</div>

					{/* Empty state */}
					{menuItems.length === 0 && (
						<div className="px-3 py-2 text-center text-gray-500 text-sm">
							No actions available
						</div>
					)}
				</motion.div>
			)}
		</AnimatePresence>
	);
};

/**
 * Context menu state type
 */
type ContextMenuState = {
	position: { x: number; y: number };
	data?: unknown;
};

/**
 * useContextMenu Hook return type
 */
type UseContextMenuReturn = {
	contextMenu: ContextMenuState | null;
	isOpen: boolean;
	position?: { x: number; y: number };
	data?: unknown;
	openContextMenu: (position: { x: number; y: number }, data?: unknown) => void;
	closeContextMenu: () => void;
	handleContextMenu: (event: React.MouseEvent, data?: unknown) => void;
};

/**
 * useContextMenu Hook
 *
 * React hook for managing context menu state
 */
export function useContextMenu(): UseContextMenuReturn {
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

	const openContextMenu = useCallback(
		(position: { x: number; y: number }, data?: unknown) => {
			setContextMenu({ position, data });
		},
		[]
	);

	const closeContextMenu = useCallback(() => {
		setContextMenu(null);
	}, []);

	const handleContextMenu = useCallback(
		(event: React.MouseEvent, data?: unknown) => {
			event.preventDefault();
			event.stopPropagation();

			openContextMenu({ x: event.clientX, y: event.clientY }, data);
		},
		[openContextMenu]
	);

	return {
		contextMenu,
		isOpen: !!contextMenu,
		position: contextMenu?.position,
		data: contextMenu?.data,
		openContextMenu,
		closeContextMenu,
		handleContextMenu,
	};
}

/**
 * withContextMenu HOC Props
 */
type WithContextMenuProps = {
	data?: unknown;
	onMenuAction?: (
		action: string,
		context: unknown,
		event: React.MouseEvent
	) => void;
	onContextMenu?: (event: React.MouseEvent) => void;
};

/**
 * withContextMenu HOC
 *
 * Higher-order component to add context menu functionality
 */
export function withContextMenu<P extends object>(
	Component: React.ComponentType<
		P & { onContextMenu?: (event: React.MouseEvent) => void }
	>,
	menuConfig: MenuItemConfig[] | ((data: unknown) => MenuItemConfig[])
): React.FC<P & WithContextMenuProps> {
	return function ContextMenuWrapper(props: P & WithContextMenuProps) {
		const {
			isOpen,
			position,
			data,
			closeContextMenu,
			handleContextMenu: handleCtxMenu,
		} = useContextMenu();

		return (
			<>
				<Component
					{...props}
					onContextMenu={(event) => handleCtxMenu(event, props.data)}
				/>
				<ContextMenu
					context={{ ...(data as object), ...props }}
					isOpen={isOpen}
					menuItems={
						typeof menuConfig === "function" ? menuConfig(data) : menuConfig
					}
					onAction={props.onMenuAction}
					onClose={closeContextMenu}
					position={position}
				/>
			</>
		);
	};
}

/**
 * ContextMenuContext
 */
export const ContextMenuContext =
	React.createContext<UseContextMenuReturn | null>(null);

/**
 * ContextMenuProvider Component Props
 */
type ContextMenuProviderProps = {
	children: React.ReactNode;
};

/**
 * ContextMenuProvider Component
 *
 * Provides context menu functionality via React Context
 */
export const ContextMenuProvider: React.FC<ContextMenuProviderProps> = ({
	children,
}) => {
	const contextMenuState = useContextMenu();

	return (
		<ContextMenuContext.Provider value={contextMenuState}>
			{children}
		</ContextMenuContext.Provider>
	);
};

/**
 * useContextMenuContext Hook
 *
 * Hook to access context menu context
 */
export function useContextMenuContext(): UseContextMenuReturn {
	const context = React.useContext(ContextMenuContext);
	if (!context) {
		throw new Error(
			"useContextMenuContext must be used within ContextMenuProvider"
		);
	}
	return context;
}

/**
 * ContextMenuTrigger Component Props
 */
type ContextMenuTriggerProps = {
	children: React.ReactNode;
	menuItems: MenuItemConfig[];
	onAction?: (
		action: string,
		context: unknown,
		event: React.MouseEvent
	) => void;
	data?: unknown;
	disabled?: boolean;
};

/**
 * ContextMenuTrigger Component
 *
 * Component that triggers context menu on right-click
 */
export const ContextMenuTrigger: React.FC<ContextMenuTriggerProps> = ({
	children,
	menuItems,
	onAction,
	data,
	disabled = false,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [position, setPosition] = useState({ x: 0, y: 0 });

	const handleRightClick = useCallback(
		(event: React.MouseEvent) => {
			if (disabled) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			setPosition({ x: event.clientX, y: event.clientY });
			setIsOpen(true);
		},
		[disabled]
	);

	return (
		<>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: Context menu trigger requires onContextMenu handler */}
			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Context menu trigger requires onContextMenu handler */}
			<div onContextMenu={handleRightClick}>{children}</div>
			<ContextMenu
				context={data}
				isOpen={isOpen}
				menuItems={menuItems}
				onAction={onAction}
				onClose={() => setIsOpen(false)}
				position={position}
			/>
		</>
	);
};

/**
 * Debounced menu state type
 */
type DebouncedMenuState = {
	position: { x: number; y: number };
	data?: unknown;
} | null;

/**
 * useDebounceContextMenu Hook return type
 */
type UseDebounceContextMenuReturn = {
	menu: DebouncedMenuState;
	openMenu: (position: { x: number; y: number }, data?: unknown) => void;
	closeMenu: () => void;
};

/**
 * Debounce context menu opening
 * Prevents rapid menu opens on accidental multiple right-clicks
 */
export function useDebounceContextMenu(
	delay = 100
): UseDebounceContextMenuReturn {
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const [debouncedMenu, setDebouncedMenu] = useState<DebouncedMenuState>(null);

	const openMenu = useCallback(
		(position: { x: number; y: number }, data?: unknown) => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			timeoutRef.current = setTimeout(() => {
				setDebouncedMenu({ position, data });
			}, delay);
		},
		[delay]
	);

	const closeMenu = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		setDebouncedMenu(null);
	}, []);

	return {
		menu: debouncedMenu,
		openMenu,
		closeMenu,
	};
}

export default ContextMenu;
