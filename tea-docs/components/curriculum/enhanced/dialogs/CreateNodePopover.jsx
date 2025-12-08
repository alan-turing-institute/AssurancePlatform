/**
 * Create Node Popover Component
 *
 * Compact popover for quick node creation from handle interactions.
 * Filters node types based on parent node's valid children.
 * Uses shadcn Popover for a clean, non-intrusive UI.
 *
 * @component
 * @example
 * <CreateNodePopover
 *   open={popoverOpen}
 *   onOpenChange={setPopoverOpen}
 *   onSelect={handleCreateNode}
 *   parentNode={parentNode}
 *   position={{ x: 100, y: 100 }}
 * />
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../../lib/utils';
import {
  Target,
  GitBranch,
  FileText,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

import {
  nodeTypeMetadata,
  getValidChildren,
} from '../nodes/nodeTypes';

/**
 * Icon mapping for node types
 */
const iconMap = {
  Target,
  GitBranch,
  FileText,
  CheckCircle,
  AlertCircle,
};

/**
 * Node Type Button for selection
 */
const NodeTypeButton = ({ metadata, onClick }) => {
  const Icon = iconMap[metadata.icon] || Target;

  // Color mapping for visual consistency
  const colorMap = {
    green: 'hover:bg-green-500/20 hover:border-green-500/50',
    purple: 'hover:bg-purple-500/20 hover:border-purple-500/50',
    orange: 'hover:bg-orange-500/20 hover:border-orange-500/50',
    cyan: 'hover:bg-cyan-500/20 hover:border-cyan-500/50',
    gray: 'hover:bg-gray-500/20 hover:border-gray-500/50',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full px-3 py-2 rounded-md',
        'flex items-center gap-3',
        'border border-transparent',
        'transition-all duration-200',
        'text-left',
        'bg-white/5 dark:bg-white/5',
        'hover:bg-white/10 dark:hover:bg-white/10',
        colorMap[metadata.color] || 'hover:bg-gray-500/20'
      )}
    >
      <Icon className="w-4 h-4 text-gray-700 dark:text-gray-200 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {metadata.name}
        </div>
      </div>
      {metadata.shortcut && (
        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
          {metadata.shortcut}
        </div>
      )}
    </button>
  );
};

/**
 * CreateNodePopover Component
 */
const CreateNodePopover = ({
  open = false,
  onOpenChange,
  onSelect,
  parentNode = null,
  position = null,
}) => {
  const popoverRef = useRef(null);

  // Get valid child types for the parent node
  const validChildTypes = parentNode
    ? getValidChildren(parentNode.type)
    : ['goal', 'strategy', 'propertyClaim', 'evidence', 'context'];

  // Filter node type metadata to only show valid children
  const availableNodeTypes = validChildTypes
    .map(typeId => nodeTypeMetadata[typeId])
    .filter(Boolean);

  const handleSelect = (nodeType) => {
    const metadata = nodeTypeMetadata[nodeType];
    onSelect({
      nodeType,
      name: `New ${metadata.name}`,
      description: metadata.description,
      parentNode,
    });
    onOpenChange(false);
  };

  // Handle click outside to close
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        onOpenChange(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  // Calculate position (default to center of screen if no position provided)
  const popoverStyle = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(0, 10px)', // offset slightly below cursor
      }
    : {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      };

  const popoverContent = (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className={cn(
        'w-64 p-2 z-[9999]',
        'bg-white dark:bg-gray-800',
        'border border-gray-300 dark:border-gray-600',
        'shadow-xl rounded-lg',
        'backdrop-blur-lg'
      )}
    >
      <div className="space-y-1">
        <div className="px-2 py-1.5">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
            Create Node
          </div>
          {parentNode && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              as child of "{parentNode.data?.name || parentNode.id}"
            </div>
          )}
        </div>

        <div className="space-y-1">
          {availableNodeTypes.map((metadata) => (
            <NodeTypeButton
              key={metadata.id}
              metadata={metadata}
              onClick={() => handleSelect(metadata.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // Render into document.body using portal
  return createPortal(popoverContent, document.body);
};

export default CreateNodePopover;
