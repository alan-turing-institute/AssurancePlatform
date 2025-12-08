/**
 * Menu Items Component
 *
 * Reusable menu item components for context menus.
 * Supports icons, shortcuts, disabled states, separators, and sub-menus.
 *
 * @module menus/MenuItems
 */

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  className = '',
}) => {
  const [showSubmenu, setShowSubmenu] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState('right');
  const itemRef = React.useRef(null);

  const handleClick = (e) => {
    if (disabled) return;

    if (submenu) {
      setShowSubmenu(!showSubmenu);
    } else if (onClick) {
      onClick(action, e);
    }
  };

  const handleMouseEnter = () => {
    if (submenu && !disabled) {
      // Calculate submenu position to avoid overflow
      if (itemRef.current) {
        const rect = itemRef.current.getBoundingClientRect();
        const spaceRight = window.innerWidth - rect.right;
        const spaceLeft = rect.left;

        setSubmenuPosition(spaceRight < 250 && spaceLeft > spaceRight ? 'left' : 'right');
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
        red: 'text-red-400',
        orange: 'text-orange-400',
        yellow: 'text-yellow-400',
        green: 'text-green-400',
        blue: 'text-blue-400',
        purple: 'text-purple-400',
        cyan: 'text-cyan-400',
        gray: 'text-gray-400',
      }[color]
    : '';

  return (
    <div
      ref={itemRef}
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`
          w-full px-3 py-2 flex items-center gap-3
          text-sm text-left
          transition-all duration-200
          ${
            disabled
              ? 'text-gray-500 cursor-not-allowed opacity-50'
              : dangerous
              ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
              : 'text-text-light hover:bg-background-transparent-white-hover'
          }
          ${submenu ? 'justify-between' : ''}
          rounded
        `}
        title={description}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Icon */}
          {Icon && (
            <Icon
              className={`w-4 h-4 flex-shrink-0 ${colorClasses || (dangerous ? 'text-red-400' : 'text-icon-light-secondary')}`}
              strokeWidth={2}
            />
          )}

          {/* Label */}
          <span className="truncate">{label}</span>
        </div>

        {/* Shortcut or Submenu Indicator */}
        {shortcut && !submenu && (
          <span className="text-xs text-gray-500 font-mono ml-auto flex-shrink-0">
            {shortcut}
          </span>
        )}

        {submenu && (
          <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
      </button>

      {/* Submenu */}
      {submenu && (
        <AnimatePresence>
          {showSubmenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={`
                absolute top-0 ${submenuPosition === 'right' ? 'left-full ml-1' : 'right-full mr-1'}
                min-w-[200px] max-w-[250px]
                bg-background-transparent-black-secondary
                border border-transparent
                f-effect-backdrop-blur-lg
                rounded-lg
                shadow-3d
                py-1
                z-50
              `}
              onMouseEnter={() => setShowSubmenu(true)}
              onMouseLeave={() => setShowSubmenu(false)}
            >
              {submenu.map((item, index) => (
                <MenuItem
                  key={index}
                  {...item}
                  onClick={onClick}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

/**
 * MenuSeparator Component
 *
 * Visual separator between menu sections
 */
export const MenuSeparator = ({ className = '' }) => {
  return (
    <div className={`h-px bg-border-transparent my-1 ${className}`} />
  );
};

/**
 * MenuHeader Component
 *
 * Section header within menu
 */
export const MenuHeader = ({ label, className = '' }) => {
  return (
    <div
      className={`
        px-3 py-2
        text-xs text-gray-500 uppercase tracking-wider font-semibold
        ${className}
      `}
    >
      {label}
    </div>
  );
};

/**
 * MenuFooter Component
 *
 * Footer section with additional info or actions
 */
export const MenuFooter = ({ children, className = '' }) => {
  return (
    <div
      className={`
        px-3 py-2
        border-t border-transparent
        ${className}
      `}
    >
      {children}
    </div>
  );
};

/**
 * RecentActionsMenu Component
 *
 * Shows recently used actions for quick access
 */
export const RecentActionsMenu = ({ recentActions = [], onClick, maxItems = 3 }) => {
  if (!recentActions || recentActions.length === 0) return null;

  return (
    <>
      <MenuHeader label="Recent Actions" />
      {recentActions.slice(0, maxItems).map((item, index) => (
        <MenuItem
          key={index}
          {...item}
          onClick={onClick}
        />
      ))}
      <MenuSeparator />
    </>
  );
};

/**
 * KeyboardShortcutsHint Component
 *
 * Shows keyboard shortcut hints at bottom of menu
 */
export const KeyboardShortcutsHint = ({ shortcuts = [] }) => {
  if (!shortcuts || shortcuts.length === 0) return null;

  return (
    <MenuFooter>
      <div className="text-xs text-gray-600 space-y-1">
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="flex justify-between items-center">
            <span>{shortcut.label}</span>
            <kbd className="font-mono bg-background-transparent-white-hover px-1.5 py-0.5 rounded text-xs">
              {shortcut.key}
            </kbd>
          </div>
        ))}
      </div>
    </MenuFooter>
  );
};

/**
 * SearchableMenu Component
 *
 * Menu with search/filter capability for long lists
 */
export const SearchableMenu = ({ items = [], onClick, placeholder = 'Search...' }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = items.filter(item =>
    item.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="px-3 py-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={placeholder}
          className={`
            w-full px-2 py-1
            bg-background-transparent-white-hover
            border border-transparent
            rounded
            text-sm text-text-light
            placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500/50
          `}
          autoFocus
        />
      </div>
      <MenuSeparator />
      <div className="max-h-64 overflow-y-auto">
        {filteredItems.length > 0 ? (
          filteredItems.map((item, index) => (
            <MenuItem
              key={index}
              {...item}
              onClick={onClick}
            />
          ))
        ) : (
          <div className="px-3 py-2 text-sm text-gray-500 text-center">
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
export function renderMenuItems(menuConfig, onClick) {
  return menuConfig.map((item, index) => {
    if (item.type === 'separator') {
      return <MenuSeparator key={`separator-${index}`} />;
    }

    return (
      <MenuItem
        key={item.action || index}
        {...item}
        onClick={onClick}
      />
    );
  });
}

/**
 * MenuItemGroup Component
 *
 * Groups related menu items with optional header
 */
export const MenuItemGroup = ({ label, items = [], onClick }) => {
  return (
    <>
      {label && <MenuHeader label={label} />}
      {items.map((item, index) => {
        if (item.type === 'separator') {
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
    </>
  );
};

/**
 * ConditionalMenuItem Component
 *
 * Only renders if condition is met
 */
export const ConditionalMenuItem = ({ condition, children, fallback = null }) => {
  return condition ? children : fallback;
};

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
