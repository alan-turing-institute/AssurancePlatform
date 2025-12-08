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

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { renderMenuItems } from './MenuItems';

/**
 * ContextMenu Component
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether menu is visible
 * @param {Object} props.position - { x, y } position for menu
 * @param {Array} props.menuItems - Array of menu item configurations
 * @param {Function} props.onClose - Callback when menu closes
 * @param {Function} props.onAction - Callback when action is selected
 * @param {Object} props.context - Additional context passed to actions
 * @param {number} props.width - Menu width in pixels (default: 220)
 * @param {number} props.maxHeight - Max menu height before scrolling
 * @param {string} props.className - Additional CSS classes
 */
export const ContextMenu = ({
  isOpen = false,
  position = { x: 0, y: 0 },
  menuItems = [],
  onClose,
  onAction,
  context = {},
  width = 220,
  maxHeight = 400,
  className = '',
}) => {
  const menuRef = useRef(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  /**
   * Auto-position menu to stay on screen
   */
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

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
   * Handle click outside to close
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    // Small delay to prevent immediate close from the triggering click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  /**
   * Handle keyboard navigation
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      // Get actionable items (exclude separators)
      const actionableItems = menuItems.filter(item => item.type !== 'separator');

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onClose?.();
          break;

        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev =>
            prev < actionableItems.length - 1 ? prev + 1 : 0
          );
          break;

        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : actionableItems.length - 1
          );
          break;

        case 'Enter':
          event.preventDefault();
          if (selectedIndex >= 0 && actionableItems[selectedIndex]) {
            handleAction(actionableItems[selectedIndex].action, event);
          }
          break;

        case 'Home':
          event.preventDefault();
          setSelectedIndex(0);
          break;

        case 'End':
          event.preventDefault();
          setSelectedIndex(actionableItems.length - 1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, menuItems, selectedIndex, onClose]);

  /**
   * Handle menu action selection
   */
  const handleAction = useCallback((action, event) => {
    if (!action) return;

    onAction?.(action, context, event);
    onClose?.();
  }, [onAction, onClose, context]);

  /**
   * Prevent context menu on the context menu itself
   */
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={`
            fixed z-[9999]
            min-w-[200px]
            bg-background-transparent-black-secondary
            border border-transparent
            f-effect-backdrop-blur-lg
            rounded-lg
            shadow-3d
            py-1
            overflow-hidden
            ${className}
          `}
          style={{
            left: adjustedPosition.x,
            top: adjustedPosition.y,
            width: width,
            maxHeight: maxHeight,
          }}
          onContextMenu={handleContextMenu}
        >
          <div className="overflow-y-auto max-h-full">
            {renderMenuItems(menuItems, handleAction)}
          </div>

          {/* Empty state */}
          {menuItems.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              No actions available
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * useContextMenu Hook
 *
 * React hook for managing context menu state
 *
 * @returns {Object} Context menu state and handlers
 */
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState(null);

  const openContextMenu = useCallback((position, data) => {
    setContextMenu({ position, data });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenu = useCallback((event, data) => {
    event.preventDefault();
    event.stopPropagation();

    openContextMenu(
      { x: event.clientX, y: event.clientY },
      data
    );
  }, [openContextMenu]);

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
 * withContextMenu HOC
 *
 * Higher-order component to add context menu functionality
 */
export function withContextMenu(Component, menuConfig) {
  return function ContextMenuWrapper(props) {
    const {
      contextMenu,
      isOpen,
      position,
      data,
      closeContextMenu,
      handleContextMenu,
    } = useContextMenu();

    return (
      <>
        <Component
          {...props}
          onContextMenu={(event) => handleContextMenu(event, props.data)}
        />
        <ContextMenu
          isOpen={isOpen}
          position={position}
          menuItems={typeof menuConfig === 'function' ? menuConfig(data) : menuConfig}
          onClose={closeContextMenu}
          onAction={props.onMenuAction}
          context={{ ...data, ...props }}
        />
      </>
    );
  };
}

/**
 * ContextMenuProvider Component
 *
 * Provides context menu functionality via React Context
 */
export const ContextMenuContext = React.createContext(null);

export const ContextMenuProvider = ({ children }) => {
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
export function useContextMenuContext() {
  const context = React.useContext(ContextMenuContext);
  if (!context) {
    throw new Error('useContextMenuContext must be used within ContextMenuProvider');
  }
  return context;
}

/**
 * ContextMenuTrigger Component
 *
 * Component that triggers context menu on right-click
 */
export const ContextMenuTrigger = ({
  children,
  menuItems,
  onAction,
  data,
  disabled = false,
}) => {
  const { handleContextMenu } = useContextMenu();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleRightClick = useCallback((event) => {
    if (disabled) return;

    event.preventDefault();
    event.stopPropagation();

    setPosition({ x: event.clientX, y: event.clientY });
    setIsOpen(true);
  }, [disabled]);

  return (
    <>
      <div onContextMenu={handleRightClick}>
        {children}
      </div>
      <ContextMenu
        isOpen={isOpen}
        position={position}
        menuItems={menuItems}
        onClose={() => setIsOpen(false)}
        onAction={onAction}
        context={data}
      />
    </>
  );
};

/**
 * Debounce context menu opening
 * Prevents rapid menu opens on accidental multiple right-clicks
 */
export function useDebounceContextMenu(delay = 100) {
  const timeoutRef = useRef(null);
  const [debouncedMenu, setDebouncedMenu] = useState(null);

  const openMenu = useCallback((position, data) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedMenu({ position, data });
    }, delay);
  }, [delay]);

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
