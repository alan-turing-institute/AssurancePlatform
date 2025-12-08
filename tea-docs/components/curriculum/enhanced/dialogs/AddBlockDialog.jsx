/**
 * Add Block Dialog Component
 *
 * Full-screen modal dialog for creating new nodes in React Flow.
 * Inspired by FloraFauna.ai with modern glassmorphism design.
 *
 * Features:
 * - Two-panel layout: selection on left, preview on right
 * - Search/filter functionality
 * - Category tabs for node types
 * - Template library with common patterns
 * - Recent blocks section
 * - Keyboard navigation and shortcuts
 * - Live preview of node being created
 * - Form validation
 * - Auto-save draft
 *
 * @component
 * @example
 * <AddBlockDialog
 *   open={dialogOpen}
 *   onClose={() => setDialogOpen(false)}
 *   onAdd={handleAddBlock}
 *   currentNodes={nodes}
 *   suggestedConnections={connections}
 * />
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { Separator } from '../../../ui/separator';
import { ScrollArea } from '../../../ui/scroll-area';
import { cn } from '../../../../lib/utils';
import {
  Search,
  Sparkles,
  Layers,
  X,
  Check,
  ArrowRight,
  HelpCircle,
  Zap,
  Clock,
  Star,
} from 'lucide-react';

import BlockForm from './BlockForm';
import BlockPreview from './BlockPreview';
import BlockTemplates from './BlockTemplates';
import { nodeTypeMetadata, getNodeTypesByCategory } from '../nodes/nodeTypes';
import {
  getRecentNodeTypes,
  loadRecentTypes,
  saveRecentTypes,
  createNodeObject,
  validateNodeCreation,
  calculateConnectionHints,
} from '../interactions/creationUtils';
import {
  saveDraft,
  loadDraft,
  clearDraft,
  getDialogMode,
  setDialogMode,
} from './dialogUtils';

/**
 * Node Type Card Component
 */
const NodeTypeCard = ({ nodeType, metadata, isSelected, onClick, isRecent, isFavorite }) => {
  const Icon = require('lucide-react')[metadata.icon];

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'relative w-full p-4 rounded-lg',
        'bg-background-transparent-white-hover',
        'hover:bg-background-transparent-white-secondaryHover',
        'border transition-all duration-200',
        'text-left group',
        isSelected
          ? 'border-blue-500/50 bg-background-transparent-white-secondaryHover ring-2 ring-blue-500/50'
          : 'border-transparent'
      )}
    >
      {/* Badges */}
      <div className="absolute top-2 right-2 flex gap-1">
        {isRecent && (
          <div className="p-1 rounded bg-blue-500/20">
            <Clock className="w-3 h-3 text-blue-400" />
          </div>
        )}
        {isFavorite && (
          <div className="p-1 rounded bg-yellow-500/20">
            <Star className="w-3 h-3 text-yellow-400" />
          </div>
        )}
      </div>

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'p-2.5 rounded-lg flex-shrink-0',
            `bg-${metadata.color}-500/10`,
            'group-hover:scale-110 transition-transform duration-200'
          )}
        >
          {Icon && <Icon className={cn('w-5 h-5', `text-${metadata.color}-400`)} />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-8">
          <div className="font-semibold text-sm text-text-light mb-1">
            {metadata.name}
          </div>
          <p className="text-xs text-text-light/70 line-clamp-2">
            {metadata.description}
          </p>
        </div>
      </div>

      {/* Shortcut */}
      <div className="mt-2 flex justify-end">
        <kbd
          className={cn(
            'px-2 py-1 text-xs font-mono',
            'bg-background-transparent-white-hover',
            'border border-transparent',
            'rounded',
            'text-text-light/60'
          )}
        >
          {metadata.shortcut}
        </kbd>
      </div>
    </motion.button>
  );
};

/**
 * AddBlockDialog Component
 */
const AddBlockDialog = ({
  open = false,
  onClose,
  onAdd,
  onBulkAdd,
  position = null,
  currentNodes = [],
  suggestedConnections = [],
  defaultNodeType = null,
  enableTemplates = true,
  enableQuickMode = true,
  enableBulkMode = false,
  showConnectionHints = true,
  className,
}) => {
  // State
  const [selectedNodeType, setSelectedNodeType] = useState(defaultNodeType || 'goal');
  const [formData, setFormData] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('types');
  const [mode, setMode] = useState('standard'); // standard, quick, bulk, template
  const [recentTypes, setRecentTypes] = useState([]);
  const [favoriteTypes, setFavoriteTypes] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [bulkCount, setBulkCount] = useState(1);
  const [validationErrors, setValidationErrors] = useState({});

  // Refs
  const searchInputRef = useRef(null);
  const formRef = useRef(null);

  // Load recent types and favorites on mount
  useEffect(() => {
    const loaded = loadRecentTypes();
    setRecentTypes(loaded);

    // Load saved dialog mode
    const savedMode = getDialogMode();
    if (savedMode && enableQuickMode) {
      setMode(savedMode);
    }
  }, [enableQuickMode]);

  // Auto-focus search when dialog opens
  useEffect(() => {
    if (open && searchInputRef.current && activeTab === 'types') {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open, activeTab]);

  // Load draft when dialog opens
  useEffect(() => {
    if (open) {
      const draft = loadDraft();
      if (draft && draft.nodeType) {
        setSelectedNodeType(draft.nodeType);
        setFormData(draft.formData || {});
      }
    }
  }, [open]);

  // Auto-save draft
  useEffect(() => {
    if (open && selectedNodeType && Object.keys(formData).length > 0) {
      saveDraft({ nodeType: selectedNodeType, formData });
    }
  }, [open, selectedNodeType, formData]);

  // Calculate connection hints
  const connectionHints = position && showConnectionHints
    ? calculateConnectionHints(position, currentNodes, 300)
    : [];

  // Filter node types based on search
  const filteredTypes = Object.keys(nodeTypeMetadata).filter((type) => {
    if (!searchQuery) return true;
    const metadata = nodeTypeMetadata[type];
    const query = searchQuery.toLowerCase();
    return (
      metadata.name.toLowerCase().includes(query) ||
      metadata.description.toLowerCase().includes(query) ||
      metadata.category.toLowerCase().includes(query)
    );
  });

  // Handle node type selection
  const handleSelectNodeType = useCallback((nodeType) => {
    setSelectedNodeType(nodeType);
    setSelectedTemplate(null);
    setValidationErrors({});

    // Switch to form view
    if (activeTab === 'types') {
      // Stay on types tab but show preview
    }
  }, [activeTab]);

  // Handle template selection
  const handleSelectTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    setSelectedNodeType(null);
    setActiveTab('templates');
  }, []);

  // Handle form data change
  const handleFormDataChange = useCallback((data) => {
    setFormData(data);
    setValidationErrors({});
  }, []);

  // Validate form
  const validateForm = useCallback(() => {
    const errors = {};

    if (!selectedNodeType && !selectedTemplate) {
      errors.general = 'Please select a node type or template';
      return errors;
    }

    if (selectedNodeType) {
      if (!formData.name || formData.name.trim() === '') {
        errors.name = 'Name is required';
      }
      if (!formData.description || formData.description.trim() === '') {
        errors.description = 'Description is required';
      }
    }

    return errors;
  }, [selectedNodeType, selectedTemplate, formData]);

  // Handle add node
  const handleAdd = useCallback(() => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (selectedTemplate) {
      // Add template nodes
      if (onAdd) {
        onAdd({
          type: 'template',
          template: selectedTemplate,
          position,
        });
      }
    } else {
      // Add single node
      const nodeData = createNodeObject(selectedNodeType, position || { x: 100, y: 100 }, formData);

      if (onAdd) {
        onAdd(nodeData);
      }

      // Update recent types
      const updated = [selectedNodeType, ...recentTypes.filter((t) => t !== selectedNodeType)].slice(0, 5);
      setRecentTypes(updated);
      saveRecentTypes(updated);
    }

    // Clear draft and close
    clearDraft();
    handleClose();
  }, [selectedNodeType, selectedTemplate, formData, position, recentTypes, onAdd, validateForm]);

  // Handle bulk add
  const handleBulkAdd = useCallback(() => {
    if (!enableBulkMode || !onBulkAdd) return;

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    const nodes = [];
    for (let i = 0; i < bulkCount; i++) {
      const nodePosition = position
        ? { x: position.x + i * 50, y: position.y + i * 50 }
        : { x: 100 + i * 50, y: 100 + i * 50 };

      const nodeData = createNodeObject(
        selectedNodeType,
        nodePosition,
        { ...formData, name: `${formData.name} ${i + 1}` }
      );
      nodes.push(nodeData);
    }

    onBulkAdd(nodes);
    clearDraft();
    handleClose();
  }, [enableBulkMode, onBulkAdd, bulkCount, selectedNodeType, formData, position, validateForm]);

  // Handle close
  const handleClose = useCallback(() => {
    // Reset state
    setSelectedNodeType(defaultNodeType || 'goal');
    setFormData({});
    setSearchQuery('');
    setActiveTab('types');
    setSelectedTemplate(null);
    setValidationErrors({});

    if (onClose) {
      onClose();
    }
  }, [defaultNodeType, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event) => {
      // Escape to close
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }

      // Enter to add (if not in text input)
      if (event.key === 'Enter' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        event.preventDefault();
        handleAdd();
        return;
      }

      // Shortcuts for node types
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const shortcut = event.key.toUpperCase();
        const type = Object.keys(nodeTypeMetadata).find(
          (t) => nodeTypeMetadata[t].shortcut === shortcut
        );
        if (type) {
          event.preventDefault();
          handleSelectNodeType(type);
        }
      }

      // Ctrl/Cmd + T for templates tab
      if ((event.ctrlKey || event.metaKey) && event.key === 't' && enableTemplates) {
        event.preventDefault();
        setActiveTab('templates');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose, handleAdd, handleSelectNodeType, enableTemplates]);

  // Get categorized node types
  const categorizedTypes = getNodeTypesByCategory();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          'max-w-6xl h-[85vh]',
          'bg-background-transparent-black-secondaryAlt',
          'border border-transparent',
          'f-effect-backdrop-blur-lg',
          'text-text-light',
          'shadow-3d',
          'p-0',
          'overflow-hidden',
          className
        )}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-text-light text-xl flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                Add Block
              </DialogTitle>
              <DialogDescription className="text-text-light/70 mt-1">
                Create a new node or use a template to build your assurance case
              </DialogDescription>
            </div>

            {/* Mode Toggles */}
            <div className="flex gap-2">
              {enableQuickMode && (
                <Button
                  variant={mode === 'quick' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    const newMode = mode === 'quick' ? 'standard' : 'quick';
                    setMode(newMode);
                    setDialogMode(newMode);
                  }}
                  className="text-xs"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Quick Mode
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Selection */}
          <div className="w-[380px] border-r border-border-transparent flex flex-col">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="mx-6 mb-2 bg-background-transparent-white-hover">
                <TabsTrigger value="types" className="flex-1">
                  <Layers className="w-4 h-4 mr-2" />
                  Node Types
                </TabsTrigger>
                {enableTemplates && (
                  <TabsTrigger value="templates" className="flex-1">
                    <Star className="w-4 h-4 mr-2" />
                    Templates
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Node Types Tab */}
              <TabsContent value="types" className="flex-1 overflow-hidden flex flex-col m-0 px-6">
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light/50" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search node types..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2',
                      'bg-background-transparent-white-hover',
                      'border border-transparent',
                      'rounded-lg',
                      'text-text-light text-sm',
                      'placeholder:text-text-light/50',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                    )}
                  />
                </div>

                {/* Node Type List */}
                <ScrollArea className="flex-1">
                  <div className="space-y-4 pr-2 pb-4">
                    {/* Recent Types */}
                    {recentTypes.length > 0 && !searchQuery && (
                      <div>
                        <div className="text-xs font-semibold text-text-light/50 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          Recent
                        </div>
                        <div className="space-y-2">
                          {recentTypes.map((type) => (
                            <NodeTypeCard
                              key={type}
                              nodeType={type}
                              metadata={nodeTypeMetadata[type]}
                              isSelected={selectedNodeType === type}
                              onClick={() => handleSelectNodeType(type)}
                              isRecent={true}
                            />
                          ))}
                        </div>
                        <Separator className="bg-border-transparent my-4" />
                      </div>
                    )}

                    {/* Categorized Types */}
                    {Object.entries(categorizedTypes).map(([category, types]) => (
                      <div key={category}>
                        <div className="text-xs font-semibold text-text-light/50 uppercase tracking-wider mb-2">
                          {category}
                        </div>
                        <div className="space-y-2">
                          {types
                            .filter((meta) => filteredTypes.includes(meta.id))
                            .map((meta) => (
                              <NodeTypeCard
                                key={meta.id}
                                nodeType={meta.id}
                                metadata={meta}
                                isSelected={selectedNodeType === meta.id}
                                onClick={() => handleSelectNodeType(meta.id)}
                                isRecent={recentTypes.includes(meta.id)}
                                isFavorite={favoriteTypes.includes(meta.id)}
                              />
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Templates Tab */}
              {enableTemplates && (
                <TabsContent value="templates" className="flex-1 overflow-hidden m-0 px-6">
                  <BlockTemplates
                    selectedTemplate={selectedTemplate}
                    onSelectTemplate={handleSelectTemplate}
                  />
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Right Panel - Form & Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto px-6 py-4">
              {selectedNodeType ? (
                <div className="space-y-6">
                  {/* Form */}
                  <div>
                    <h3 className="text-sm font-semibold text-text-light mb-4 flex items-center gap-2">
                      <ArrowRight className="w-4 h-4" />
                      {mode === 'quick' ? 'Quick Create' : 'Configure Node'}
                    </h3>
                    <BlockForm
                      ref={formRef}
                      nodeType={selectedNodeType}
                      formData={formData}
                      onChange={handleFormDataChange}
                      quickMode={mode === 'quick'}
                      validationErrors={validationErrors}
                    />
                  </div>

                  {/* Preview */}
                  <div>
                    <h3 className="text-sm font-semibold text-text-light mb-4">
                      Preview
                    </h3>
                    <BlockPreview
                      nodeType={selectedNodeType}
                      formData={formData}
                      connectionHints={connectionHints}
                    />
                  </div>
                </div>
              ) : selectedTemplate ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-text-light mb-4">
                      Template Preview
                    </h3>
                    <BlockPreview
                      template={selectedTemplate}
                      connectionHints={connectionHints}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-text-light/50">
                    <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Select a node type or template to continue</p>
                    <p className="text-xs mt-2">Use keyboard shortcuts for quick selection</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border-transparent">
          <div className="flex items-center justify-between w-full">
            {/* Help Link */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open('/docs/nodes', '_blank')}
              className="text-text-light/70 hover:text-text-light"
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Learn about nodes
            </Button>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              {enableBulkMode && mode === 'bulk' ? (
                <Button onClick={handleBulkAdd} className="bg-blue-600 hover:bg-blue-700">
                  <Check className="w-4 h-4 mr-2" />
                  Add {bulkCount} Nodes
                </Button>
              ) : (
                <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
                  <Check className="w-4 h-4 mr-2" />
                  Add Block
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Compact Add Block Dialog (minimal version)
 */
export const CompactAddBlockDialog = ({ open, onClose, onAdd, position }) => {
  return (
    <AddBlockDialog
      open={open}
      onClose={onClose}
      onAdd={onAdd}
      position={position}
      enableTemplates={false}
      enableQuickMode={true}
      enableBulkMode={false}
      className="max-w-2xl h-[60vh]"
    />
  );
};

export default AddBlockDialog;
