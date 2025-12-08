/**
 * Block Templates Component
 *
 * Pre-configured node templates for common assurance case patterns.
 * Provides template library with categories, visual previews, and usage stats.
 *
 * Features:
 * - Pre-configured node templates
 * - Template categories: Basic, Advanced, Custom
 * - Visual preview of each template
 * - Template metadata (name, description, usage)
 * - Import/export templates
 * - Favorite templates
 * - Usage statistics
 *
 * @component
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { ScrollArea } from '../../../ui/scroll-area';
import { cn } from '../../../../lib/utils';
import {
  Layers,
  Star,
  TrendingUp,
  Download,
  Upload,
  Plus,
  Check,
  Info,
  Target,
  GitBranch,
  FileText,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

import { getNodeTemplates } from '../interactions/creationUtils';

/**
 * Template categories
 */
const TEMPLATE_CATEGORIES = {
  BASIC: 'Basic',
  ADVANCED: 'Advanced',
  CUSTOM: 'Custom',
};

/**
 * Extended template library with more patterns
 */
const extendedTemplates = [
  // Basic Templates
  {
    id: 'simple-goal',
    name: 'Simple Goal',
    description: 'Single goal with strategy decomposition',
    category: TEMPLATE_CATEGORIES.BASIC,
    nodes: [
      { type: 'goal', name: 'Main Goal', offsetY: 0 },
      { type: 'strategy', name: 'Decomposition Strategy', offsetY: 150 },
    ],
    usageCount: 142,
    icon: Target,
  },
  {
    id: 'evidence-chain',
    name: 'Evidence Chain',
    description: 'Claim with supporting evidence',
    category: TEMPLATE_CATEGORIES.BASIC,
    nodes: [
      { type: 'propertyClaim', name: 'Property Claim', offsetY: 0 },
      { type: 'evidence', name: 'Supporting Evidence', offsetY: 150 },
    ],
    usageCount: 98,
    icon: FileText,
  },
  {
    id: 'context-pattern',
    name: 'Context Pattern',
    description: 'Goal with contextual information',
    category: TEMPLATE_CATEGORIES.BASIC,
    nodes: [
      { type: 'goal', name: 'Goal', offsetY: 0 },
      { type: 'context', name: 'Context/Assumption', offsetX: 200, offsetY: 0 },
    ],
    usageCount: 76,
    icon: AlertCircle,
  },

  // Advanced Templates
  {
    id: 'hierarchical-decomposition',
    name: 'Hierarchical Decomposition',
    description: 'Three-level goal decomposition with evidence',
    category: TEMPLATE_CATEGORIES.ADVANCED,
    nodes: [
      { type: 'goal', name: 'Top-Level Goal', offsetY: 0 },
      { type: 'strategy', name: 'AND Strategy', offsetY: 150 },
      { type: 'goal', name: 'Sub-Goal 1', offsetX: -150, offsetY: 300 },
      { type: 'goal', name: 'Sub-Goal 2', offsetX: 150, offsetY: 300 },
    ],
    usageCount: 54,
    icon: GitBranch,
  },
  {
    id: 'claim-evidence-set',
    name: 'Claim-Evidence Set',
    description: 'Property claim with multiple evidence items',
    category: TEMPLATE_CATEGORIES.ADVANCED,
    nodes: [
      { type: 'propertyClaim', name: 'Main Claim', offsetY: 0 },
      { type: 'evidence', name: 'Test Results', offsetX: -150, offsetY: 150 },
      { type: 'evidence', name: 'Analysis Report', offsetX: 0, offsetY: 150 },
      { type: 'evidence', name: 'Review Document', offsetX: 150, offsetY: 150 },
    ],
    usageCount: 45,
    icon: CheckCircle,
  },
  {
    id: 'contextualized-argument',
    name: 'Contextualized Argument',
    description: 'Complete argument with context and evidence',
    category: TEMPLATE_CATEGORIES.ADVANCED,
    nodes: [
      { type: 'goal', name: 'System Goal', offsetY: 0 },
      { type: 'context', name: 'System Context', offsetX: 250, offsetY: 0 },
      { type: 'strategy', name: 'Argument Strategy', offsetY: 150 },
      { type: 'propertyClaim', name: 'Property Claim', offsetY: 300 },
      { type: 'evidence', name: 'Supporting Evidence', offsetY: 450 },
    ],
    usageCount: 38,
    icon: Layers,
  },

  // More patterns can be added here
];

/**
 * Template Card Component
 */
const TemplateCard = ({ template, isSelected, isFavorite, onSelect, onToggleFavorite }) => {
  const Icon = template.icon || Layers;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={cn(
        'relative w-full p-4 rounded-lg',
        'bg-background-transparent-white-hover',
        'hover:bg-background-transparent-white-secondaryHover',
        'border transition-all duration-200',
        'text-left group',
        isSelected
          ? 'border-purple-500/50 bg-background-transparent-white-secondaryHover ring-2 ring-purple-500/50'
          : 'border-transparent'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          {/* Icon */}
          <div className="p-2 rounded-lg bg-purple-500/10 flex-shrink-0">
            <Icon className="w-5 h-5 text-purple-400" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-text-light mb-1">
              {template.name}
            </div>
            <p className="text-xs text-text-light/70 line-clamp-2">
              {template.description}
            </p>
          </div>
        </div>

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={cn(
            'flex-shrink-0 p-1.5 rounded transition-colors',
            isFavorite
              ? 'text-yellow-400 hover:text-yellow-300'
              : 'text-text-light/30 hover:text-text-light/60'
          )}
        >
          <Star className={cn('w-4 h-4', isFavorite && 'fill-current')} />
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Category Badge */}
        <Badge
          variant="secondary"
          className={cn(
            'text-xs',
            template.category === TEMPLATE_CATEGORIES.BASIC && 'bg-green-500/20 text-green-400',
            template.category === TEMPLATE_CATEGORIES.ADVANCED && 'bg-blue-500/20 text-blue-400',
            template.category === TEMPLATE_CATEGORIES.CUSTOM && 'bg-purple-500/20 text-purple-400'
          )}
        >
          {template.category}
        </Badge>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-text-light/50">
          <div className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            <span>{template.nodes?.length || 0}</span>
          </div>
          {template.usageCount !== undefined && (
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>{template.usageCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Selected Indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 p-1 rounded-full bg-purple-500"
        >
          <Check className="w-3 h-3 text-white" />
        </motion.div>
      )}
    </motion.button>
  );
};

/**
 * BlockTemplates Component
 */
const BlockTemplates = ({ selectedTemplate, onSelectTemplate, enableImportExport = true }) => {
  const [templates, setTemplates] = useState(extendedTemplates);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCustomForm, setShowCustomForm] = useState(false);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tea_favorite_templates');
      if (stored) {
        setFavoriteIds(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('Failed to load favorite templates:', error);
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = (ids) => {
    try {
      localStorage.setItem('tea_favorite_templates', JSON.stringify(ids));
    } catch (error) {
      console.warn('Failed to save favorite templates:', error);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = (templateId) => {
    const newFavorites = favoriteIds.includes(templateId)
      ? favoriteIds.filter((id) => id !== templateId)
      : [...favoriteIds, templateId];

    setFavoriteIds(newFavorites);
    saveFavorites(newFavorites);
  };

  // Filter templates by category
  const filteredTemplates = templates.filter((template) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'favorites') return favoriteIds.includes(template.id);
    return template.category === selectedCategory;
  });

  // Sort templates: favorites first, then by usage
  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    const aFav = favoriteIds.includes(a.id);
    const bFav = favoriteIds.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return (b.usageCount || 0) - (a.usageCount || 0);
  });

  // Export templates
  const handleExport = () => {
    try {
      const data = JSON.stringify(templates, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tea-templates.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export templates:', error);
    }
  };

  // Import templates
  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          setTemplates([...templates, ...imported]);
        }
      } catch (error) {
        console.error('Failed to import templates:', error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-text-light">
            Template Library
          </div>
          {enableImportExport && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleExport}
                className="h-7 px-2 text-xs"
              >
                <Download className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => document.getElementById('template-import').click()}
                className="h-7 px-2 text-xs"
              >
                <Upload className="w-3 h-3" />
              </Button>
              <input
                id="template-import"
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex gap-1 overflow-x-auto pb-2">
          {['all', 'favorites', TEMPLATE_CATEGORIES.BASIC, TEMPLATE_CATEGORIES.ADVANCED, TEMPLATE_CATEGORIES.CUSTOM].map(
            (category) => (
              <Button
                key={category}
                size="sm"
                variant={selectedCategory === category ? 'default' : 'ghost'}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  'h-7 px-3 text-xs whitespace-nowrap',
                  selectedCategory === category
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'hover:bg-background-transparent-white-hover'
                )}
              >
                {category === 'all' && 'All'}
                {category === 'favorites' && (
                  <>
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    Favorites
                  </>
                )}
                {category !== 'all' && category !== 'favorites' && category}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Templates List */}
      <ScrollArea className="flex-1 pr-2">
        <div className="space-y-2 pb-4">
          {sortedTemplates.length > 0 ? (
            sortedTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedTemplate?.id === template.id}
                isFavorite={favoriteIds.includes(template.id)}
                onSelect={() => onSelectTemplate(template)}
                onToggleFavorite={() => handleToggleFavorite(template.id)}
              />
            ))
          ) : (
            <div className="text-center py-8 text-text-light/50">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No templates found</p>
              <p className="text-xs mt-1">Try selecting a different category</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Info */}
      <div
        className={cn(
          'mt-4 p-3 rounded-lg',
          'bg-background-transparent-white-hover',
          'border border-transparent'
        )}
      >
        <div className="flex items-start gap-2 text-xs text-text-light/70">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-text-light mb-1">About Templates</p>
            <p>
              Templates are pre-configured node patterns for common assurance case structures.
              Select a template to quickly create multiple connected nodes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Template Stats Component
 */
export const TemplateStats = ({ templates = extendedTemplates }) => {
  const totalTemplates = templates.length;
  const totalUsage = templates.reduce((sum, t) => sum + (t.usageCount || 0), 0);
  const categories = Object.values(TEMPLATE_CATEGORIES);

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="p-3 rounded-lg bg-background-transparent-white-hover border border-transparent">
        <div className="text-2xl font-bold text-text-light">{totalTemplates}</div>
        <div className="text-xs text-text-light/60">Templates</div>
      </div>
      <div className="p-3 rounded-lg bg-background-transparent-white-hover border border-transparent">
        <div className="text-2xl font-bold text-text-light">{totalUsage}</div>
        <div className="text-xs text-text-light/60">Total Uses</div>
      </div>
      <div className="p-3 rounded-lg bg-background-transparent-white-hover border border-transparent">
        <div className="text-2xl font-bold text-text-light">{categories.length}</div>
        <div className="text-xs text-text-light/60">Categories</div>
      </div>
    </div>
  );
};

export default BlockTemplates;
