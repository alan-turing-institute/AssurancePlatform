/**
 * Node Type Selector Component
 *
 * Modal/dropdown for selecting node type with visual previews, search,
 * and keyboard navigation. Inspired by FloraFauna.ai "Add Block" dialog.
 *
 * Features:
 * - Grid layout with node type previews
 * - Icon and color coding for each type
 * - Hover effects showing more info
 * - Quick create shortcuts (G for Goal, S for Strategy, etc.)
 * - Recent types at the top
 * - Search/filter functionality
 * - Keyboard navigation (arrow keys + enter)
 * - Template system for common patterns
 *
 * @component
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../ui/dialog';
import { Input } from '../../../ui/input';
import { Separator } from '../../../ui/separator';
import { Badge } from '../../../ui/badge';
import { cn } from '../../../../lib/utils';
import {
  Target,
  GitBranch,
  FileText,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Search,
  Clock,
  Layers,
} from 'lucide-react';
import { nodeTypeMetadata, getNodeTypesByCategory } from '../nodes/nodeTypes';
import { getRecentNodeTypes, getNodeTemplates } from './creationUtils';

/**
 * Node Type Option Component
 */
const NodeTypeOption = ({
  nodeType,
  isSelected,
  isRecent,
  onClick,
  onKeyDown,
}) => {
  const metadata = nodeTypeMetadata[nodeType];
  const Icon = metadata.icon === 'Target' ? Target :
               metadata.icon === 'GitBranch' ? GitBranch :
               metadata.icon === 'FileText' ? FileText :
               metadata.icon === 'CheckCircle' ? CheckCircle :
               AlertCircle;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        'w-full p-4 rounded-lg',
        'bg-background-transparent-white-hover',
        'hover:bg-background-transparent-white-secondaryHover',
        'border border-transparent',
        'transition-all duration-200',
        'text-left',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
        'group',
        isSelected && 'bg-background-transparent-white-secondaryHover ring-2 ring-blue-500/50'
      )}
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          'p-2 rounded-lg flex-shrink-0',
          `bg-${metadata.color}-500/10`,
          'group-hover:scale-110 transition-transform duration-200'
        )}>
          <Icon className={cn('w-5 h-5', `text-${metadata.color}-400`)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-text-light">
              {metadata.name}
            </span>
            {isRecent && (
              <Badge variant="secondary" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Recent
              </Badge>
            )}
          </div>
          <p className="text-xs text-text-light/70 line-clamp-2">
            {metadata.description}
          </p>
        </div>

        {/* Shortcut */}
        <div className="flex-shrink-0">
          <kbd className={cn(
            'px-2 py-1 text-xs font-mono',
            'bg-background-transparent-white-hover',
            'border border-transparent',
            'rounded',
            'text-text-light/60'
          )}>
            {metadata.shortcut}
          </kbd>
        </div>
      </div>
    </motion.button>
  );
};

/**
 * Template Option Component
 */
const TemplateOption = ({ template, onClick }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'w-full p-3 rounded-lg',
        'bg-background-transparent-white-hover',
        'hover:bg-background-transparent-white-secondaryHover',
        'border border-transparent',
        'transition-all duration-200',
        'text-left',
        'focus:outline-none focus:ring-2 focus:ring-purple-500/50',
        'group'
      )}
      tabIndex={0}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-500/10">
          <Layers className="w-4 h-4 text-purple-400" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm text-text-light">
            {template.name}
          </div>
          <p className="text-xs text-text-light/60">
            {template.description}
          </p>
        </div>
      </div>
    </motion.button>
  );
};

/**
 * NodeTypeSelector Component Props
 */
const NodeTypeSelector = ({
  isOpen,
  onClose,
  onSelectType,
  onSelectTemplate,
  position,
  recentTypes = [],
  showTemplates = true,
  showSearch = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredTypes, setFilteredTypes] = useState([]);
  const searchInputRef = useRef(null);

  const nodeTypesList = Object.keys(nodeTypeMetadata);
  const templates = getNodeTemplates();

  // Filter node types based on search
  useEffect(() => {
    if (!searchQuery) {
      setFilteredTypes(nodeTypesList);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = nodeTypesList.filter((type) => {
        const metadata = nodeTypeMetadata[type];
        return (
          metadata.name.toLowerCase().includes(query) ||
          metadata.description.toLowerCase().includes(query) ||
          metadata.shortcut.toLowerCase().includes(query)
        );
      });
      setFilteredTypes(filtered);
    }
    setSelectedIndex(0);
  }, [searchQuery]);

  // Focus search input when dialog opens
  useEffect(() => {
    if (isOpen && searchInputRef.current && showSearch) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, showSearch]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredTypes.length - 1 ? prev + 1 : prev
          );
          break;

        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;

        case 'Enter':
          event.preventDefault();
          if (filteredTypes[selectedIndex]) {
            handleSelectType(filteredTypes[selectedIndex]);
          }
          break;

        case 'Escape':
          event.preventDefault();
          onClose();
          break;

        default:
          // Check for keyboard shortcuts
          const shortcut = event.key.toUpperCase();
          const typeByShortcut = nodeTypesList.find(
            (type) => nodeTypeMetadata[type].shortcut === shortcut
          );
          if (typeByShortcut && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            handleSelectType(typeByShortcut);
          }
          break;
      }
    },
    [filteredTypes, selectedIndex, nodeTypesList]
  );

  // Handle type selection
  const handleSelectType = (nodeType) => {
    if (onSelectType) {
      onSelectType(nodeType, position);
    }
    onClose();
  };

  // Handle template selection
  const handleSelectTemplate = (template) => {
    if (onSelectTemplate) {
      onSelectTemplate(template, position);
    }
    onClose();
  };

  // Sort types: recent first, then alphabetically
  const sortedTypes = [...filteredTypes].sort((a, b) => {
    const aRecent = recentTypes.includes(a);
    const bRecent = recentTypes.includes(b);
    if (aRecent && !bRecent) return -1;
    if (!aRecent && bRecent) return 1;
    return nodeTypeMetadata[a].name.localeCompare(nodeTypeMetadata[b].name);
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'sm:max-w-xl',
          'bg-background-transparent-black-secondaryAlt',
          'border border-transparent',
          'backdrop-blur-lg',
          'text-text-light',
          'shadow-3d'
        )}
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="text-text-light text-lg">
            Add Node
          </DialogTitle>
          <DialogDescription className="text-text-light/70">
            Select a node type or template to add to your assurance case
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light/50" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search node types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'pl-10',
                'bg-background-transparent-white-hover',
                'border-transparent',
                'text-text-light',
                'placeholder:text-text-light/50',
                'focus:ring-2 focus:ring-blue-500/50'
              )}
            />
          </div>
        )}

        {/* Node Types */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          <div className="text-xs font-semibold text-text-light/50 uppercase tracking-wider mb-2">
            Node Types
          </div>
          {sortedTypes.map((nodeType, index) => (
            <NodeTypeOption
              key={nodeType}
              nodeType={nodeType}
              isSelected={index === selectedIndex}
              isRecent={recentTypes.includes(nodeType)}
              onClick={() => handleSelectType(nodeType)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSelectType(nodeType);
                }
              }}
            />
          ))}
        </div>

        {/* Templates Section */}
        {showTemplates && templates.length > 0 && (
          <>
            <Separator className="bg-border-transparent" />
            <div className="space-y-2">
              <div className="text-xs font-semibold text-text-light/50 uppercase tracking-wider mb-2">
                Templates
              </div>
              {templates.map((template) => (
                <TemplateOption
                  key={template.id}
                  template={template}
                  onClick={() => handleSelectTemplate(template)}
                />
              ))}
            </div>
          </>
        )}

        {/* Help Footer */}
        <Separator className="bg-border-transparent" />
        <button
          onClick={() => window.open('/docs/nodes', '_blank')}
          className={cn(
            'w-full flex items-center justify-center gap-2',
            'text-sm text-text-light/70',
            'hover:text-text-light',
            'transition-colors duration-200',
            'py-2'
          )}
        >
          <HelpCircle className="w-4 h-4" />
          Learn about node types
        </button>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Compact Node Type Selector (inline version)
 */
export const CompactNodeTypeSelector = ({
  onSelectType,
  recentTypes = [],
  className,
}) => {
  const nodeTypesList = Object.keys(nodeTypeMetadata);

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {nodeTypesList.map((nodeType) => {
        const metadata = nodeTypeMetadata[nodeType];
        const Icon = metadata.icon === 'Target' ? Target :
                     metadata.icon === 'GitBranch' ? GitBranch :
                     metadata.icon === 'FileText' ? FileText :
                     metadata.icon === 'CheckCircle' ? CheckCircle :
                     AlertCircle;

        return (
          <motion.button
            key={nodeType}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectType(nodeType)}
            className={cn(
              'p-3 rounded-lg',
              'bg-background-transparent-white-hover',
              'hover:bg-background-transparent-white-secondaryHover',
              'border border-transparent',
              'transition-all duration-200',
              'group'
            )}
            title={metadata.name}
          >
            <Icon className={cn('w-5 h-5', `text-${metadata.color}-400`)} />
          </motion.button>
        );
      })}
    </div>
  );
};

export default NodeTypeSelector;
