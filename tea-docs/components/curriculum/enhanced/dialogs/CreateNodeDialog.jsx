/**
 * Create Node Dialog Component
 *
 * Simplified dialog for quick node creation from handle interactions.
 * Filters node types based on parent node's valid children.
 *
 * @component
 * @example
 * <CreateNodeDialog
 *   open={dialogOpen}
 *   onClose={() => setDialogOpen(false)}
 *   onConfirm={handleCreateNode}
 *   parentNode={parentNode}
 *   position={{ x: 100, y: 100 }}
 * />
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../ui/dialog';
import { Button } from '../../../ui/button';
import { cn } from '../../../../lib/utils';
import {
  Target,
  GitBranch,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
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
 * Node Type Card for quick selection
 */
const NodeTypeCard = ({ metadata, isSelected, onClick }) => {
  const Icon = iconMap[metadata.icon] || Target;

  // Color mapping for visual consistency
  const colorMap = {
    green: 'border-green-500/30 bg-green-500/10 hover:bg-green-500/20',
    purple: 'border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20',
    orange: 'border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20',
    cyan: 'border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20',
    gray: 'border-gray-500/30 bg-gray-500/10 hover:bg-gray-500/20',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'relative w-full p-4 rounded-lg',
        'border-2 transition-all duration-200',
        'text-left group',
        isSelected
          ? 'border-blue-500 bg-blue-500/20 ring-2 ring-blue-500/50'
          : colorMap[metadata.color] || 'border-gray-500/30 bg-gray-500/10'
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-text-light mt-1 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-text-light mb-1">
            {metadata.name}
          </div>
          <div className="text-xs text-text-light/60">
            {metadata.description}
          </div>
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      {metadata.shortcut && (
        <div className="absolute top-2 right-2 text-xs text-text-light/40 font-mono">
          {metadata.shortcut}
        </div>
      )}
    </motion.button>
  );
};

/**
 * CreateNodeDialog Component
 */
const CreateNodeDialog = ({
  open = false,
  onClose,
  onConfirm,
  parentNode = null,
  position = null,
}) => {
  const [selectedNodeType, setSelectedNodeType] = useState(null);
  const [nodeName, setNodeName] = useState('');
  const [nodeDescription, setNodeDescription] = useState('');

  // Get valid child types for the parent node
  const validChildTypes = parentNode
    ? getValidChildren(parentNode.type)
    : ['goal', 'strategy', 'propertyClaim', 'evidence', 'context'];

  // Filter node type metadata to only show valid children
  const availableNodeTypes = validChildTypes
    .map(typeId => nodeTypeMetadata[typeId])
    .filter(Boolean);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedNodeType(null);
      setNodeName('');
      setNodeDescription('');
    }
  }, [open]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      // Type selection shortcuts (G, S, C, E, X)
      const shortcutMap = {
        'g': 'goal',
        's': 'strategy',
        'c': 'propertyClaim',
        'e': 'evidence',
        'x': 'context',
      };

      const key = e.key.toLowerCase();
      if (shortcutMap[key] && validChildTypes.includes(shortcutMap[key])) {
        e.preventDefault();
        setSelectedNodeType(shortcutMap[key]);
      }

      // Enter to confirm (if node type selected)
      if (e.key === 'Enter' && selectedNodeType) {
        e.preventDefault();
        handleConfirm();
      }

      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedNodeType, validChildTypes, onClose]);

  // Handle node creation
  const handleConfirm = () => {
    if (!selectedNodeType) return;

    // Generate default name if not provided
    const metadata = nodeTypeMetadata[selectedNodeType];
    const finalName = nodeName.trim() || `New ${metadata.name}`;
    const finalDescription = nodeDescription.trim() || `${metadata.description}`;

    onConfirm({
      nodeType: selectedNodeType,
      name: finalName,
      description: finalDescription,
      position,
      parentNode,
    });

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Create New Node
            {parentNode && (
              <span className="text-sm font-normal text-text-light/60">
                as child of "{parentNode.data?.name || parentNode.id}"
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Select a node type to create.
            {parentNode && ` Only types valid for ${parentNode.type} nodes are shown.`}
          </DialogDescription>
        </DialogHeader>

        {/* Node Type Selection */}
        <div className="space-y-3 py-4">
          <div className="text-sm font-medium text-text-light/80 mb-2">
            Select Node Type
          </div>

          <div className="grid grid-cols-1 gap-2">
            {availableNodeTypes.map((metadata) => (
              <NodeTypeCard
                key={metadata.id}
                metadata={metadata}
                isSelected={selectedNodeType === metadata.id}
                onClick={() => setSelectedNodeType(metadata.id)}
              />
            ))}
          </div>

          {/* Quick form for name (optional) */}
          <AnimatePresence>
            {selectedNodeType && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 mt-4"
              >
                <div>
                  <label className="text-sm font-medium text-text-light/80 mb-1 block">
                    Name (optional)
                  </label>
                  <input
                    type="text"
                    value={nodeName}
                    onChange={(e) => setNodeName(e.target.value)}
                    placeholder={`New ${nodeTypeMetadata[selectedNodeType].name}`}
                    className={cn(
                      'w-full px-3 py-2 rounded-md',
                      'bg-background-transparent-white-hover',
                      'border border-transparent',
                      'text-text-light',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                    )}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-text-light/80 mb-1 block">
                    Description (optional)
                  </label>
                  <textarea
                    value={nodeDescription}
                    onChange={(e) => setNodeDescription(e.target.value)}
                    placeholder="Enter a description..."
                    rows={2}
                    className={cn(
                      'w-full px-3 py-2 rounded-md',
                      'bg-background-transparent-white-hover',
                      'border border-transparent',
                      'text-text-light',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                      'resize-none'
                    )}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-text-light"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedNodeType}
            className={cn(
              'bg-blue-500 hover:bg-blue-600',
              'text-white',
              !selectedNodeType && 'opacity-50 cursor-not-allowed'
            )}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Create Node
          </Button>
        </DialogFooter>

        {/* Keyboard hints */}
        <div className="text-xs text-text-light/40 text-center pb-2">
          Press keyboard shortcuts (G, S, C, E, X) to select type | Enter to create | Esc to cancel
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateNodeDialog;
