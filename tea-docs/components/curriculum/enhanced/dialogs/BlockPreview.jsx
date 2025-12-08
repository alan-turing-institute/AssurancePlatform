/**
 * Block Preview Component
 *
 * Live preview of node as user fills form. Shows actual node component
 * with connection point indicators, zoom controls, and style variations.
 *
 * Features:
 * - Live preview of node component
 * - Connection point indicators
 * - Zoom controls
 * - Style variations preview
 * - Template preview (multiple nodes)
 * - Before/after comparison
 * - Connection hints display
 *
 * @component
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactFlow, Background, Controls, MiniMap } from 'reactflow';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { cn } from '../../../../lib/utils';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
  Link as LinkIcon,
  ArrowRight,
} from 'lucide-react';

import { nodeTypes } from '../nodes/nodeTypes';
import { createNodeData } from '../nodes/nodeTypes';
import 'reactflow/dist/style.css';

/**
 * Connection Hint Component
 */
const ConnectionHint = ({ hint, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg',
        'bg-background-transparent-white-hover',
        'border border-transparent',
        'text-xs'
      )}
    >
      <LinkIcon className="w-3 h-3 text-blue-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-text-light font-medium truncate">
          {hint.nodeName}
        </div>
        <div className="text-text-light/60">
          {Math.round(hint.distance)}px {hint.direction}
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Template Preview Component
 */
const TemplatePreview = ({ template }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  // Create nodes from template
  useMemo(() => {
    if (!template || !template.nodes) return;

    const createdNodes = template.nodes.map((nodeConfig, index) => {
      const baseX = 100;
      const baseY = 100;
      const x = baseX + (nodeConfig.offsetX || 0);
      const y = baseY + (nodeConfig.offsetY || index * 150);

      return {
        id: `preview-${nodeConfig.type}-${index}`,
        type: nodeConfig.type,
        position: { x, y },
        data: createNodeData(nodeConfig.type, {
          name: nodeConfig.name,
          description: nodeConfig.description || 'Template node',
        }),
      };
    });

    // Create edges between consecutive nodes
    const createdEdges = createdNodes.slice(0, -1).map((node, index) => ({
      id: `edge-${index}`,
      source: node.id,
      target: createdNodes[index + 1].id,
      type: 'smoothstep',
      animated: true,
    }));

    setNodes(createdNodes);
    setEdges(createdEdges);
  }, [template]);

  if (!template) return null;

  return (
    <div className="w-full h-[400px] relative rounded-lg overflow-hidden border border-border-transparent">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
        className="bg-gray-950"
      >
        <Background color="rgba(255, 255, 255, 0.05)" gap={20} />
        <Controls className="bg-background-transparent-black-secondary border-transparent" />
      </ReactFlow>

      {/* Template Info Overlay */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-background-transparent-black-secondaryAlt f-effect-backdrop-blur-lg border border-transparent rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-text-light">
                {template.name}
              </div>
              <div className="text-xs text-text-light/70 mt-0.5">
                {template.nodes?.length || 0} nodes
              </div>
            </div>
            <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
              Template
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * BlockPreview Component
 */
const BlockPreview = ({
  nodeType,
  formData = {},
  template = null,
  connectionHints = [],
  showConnectionHints = true,
  showZoomControls = true,
  className,
}) => {
  const [zoom, setZoom] = useState(1);
  const [showInfo, setShowInfo] = useState(false);

  // If template is provided, show template preview
  if (template) {
    return (
      <div className={cn('space-y-4', className)}>
        <TemplatePreview template={template} />
        {showConnectionHints && connectionHints.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-text-light/50 uppercase tracking-wider">
              Suggested Connections
            </div>
            <div className="space-y-1">
              {connectionHints.slice(0, 3).map((hint, index) => (
                <ConnectionHint key={index} hint={hint} index={index} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Create preview node data
  const previewNode = useMemo(() => {
    if (!nodeType) return null;

    return {
      id: 'preview-node',
      type: nodeType,
      position: { x: 150, y: 100 },
      data: createNodeData(nodeType, {
        name: formData.name || 'Untitled Node',
        description: formData.description || 'No description provided',
        short_description: formData.description || 'No description provided',
        long_description: formData.description || 'No description provided',
        ...formData,
      }),
      selected: false,
    };
  }, [nodeType, formData]);

  // Zoom handlers
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.5));
  const handleZoomReset = () => setZoom(1);

  if (!previewNode) {
    return (
      <div
        className={cn(
          'w-full h-[300px] flex items-center justify-center',
          'bg-background-transparent-white-hover',
          'rounded-lg border border-border-transparent',
          className
        )}
      >
        <div className="text-center text-text-light/50">
          <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No preview available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Preview Canvas */}
      <div className="relative">
        <div
          className={cn(
            'w-full h-[300px] rounded-lg overflow-hidden',
            'bg-gray-950',
            'border border-border-transparent',
            'relative'
          )}
        >
          {/* Background Grid */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, 0.05) 1px, transparent 1px)`,
              backgroundSize: '20px 20px',
              transform: `scale(${zoom})`,
              transformOrigin: 'center',
            }}
          />

          {/* Node Preview */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `scale(${zoom})`,
              transition: 'transform 0.2s ease-out',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <ReactFlow
                nodes={[previewNode]}
                edges={[]}
                nodeTypes={nodeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                zoomOnScroll={false}
                panOnScroll={false}
                panOnDrag={false}
                fitView
                minZoom={zoom}
                maxZoom={zoom}
                defaultViewport={{ x: 0, y: 0, zoom }}
                proOptions={{ hideAttribution: true }}
                className="pointer-events-none"
              >
                <Background
                  color="rgba(255, 255, 255, 0.05)"
                  gap={20}
                  className="opacity-0"
                />
              </ReactFlow>
            </motion.div>
          </div>

          {/* Zoom Controls */}
          {showZoomControls && (
            <div className="absolute top-3 right-3 flex flex-col gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleZoomIn}
                className={cn(
                  'w-8 h-8',
                  'bg-background-transparent-black-secondary',
                  'hover:bg-background-transparent-black-secondaryAlt',
                  'border border-transparent'
                )}
              >
                <ZoomIn className="w-4 h-4 text-text-light" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleZoomReset}
                className={cn(
                  'w-8 h-8',
                  'bg-background-transparent-black-secondary',
                  'hover:bg-background-transparent-black-secondaryAlt',
                  'border border-transparent'
                )}
              >
                <Maximize2 className="w-4 h-4 text-text-light" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleZoomOut}
                className={cn(
                  'w-8 h-8',
                  'bg-background-transparent-black-secondary',
                  'hover:bg-background-transparent-black-secondaryAlt',
                  'border border-transparent'
                )}
              >
                <ZoomOut className="w-4 h-4 text-text-light" />
              </Button>
            </div>
          )}

          {/* Info Toggle */}
          <div className="absolute bottom-3 left-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowInfo(!showInfo)}
              className={cn(
                'bg-background-transparent-black-secondary',
                'hover:bg-background-transparent-black-secondaryAlt',
                'border border-transparent',
                'text-text-light'
              )}
            >
              <Info className="w-3 h-3 mr-1.5" />
              {showInfo ? 'Hide' : 'Show'} Info
            </Button>
          </div>

          {/* Zoom Level Indicator */}
          <div className="absolute bottom-3 right-3">
            <div
              className={cn(
                'px-2 py-1 text-xs font-mono',
                'bg-background-transparent-black-secondary',
                'border border-transparent',
                'rounded',
                'text-text-light'
              )}
            >
              {Math.round(zoom * 100)}%
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  'mt-2 p-3 rounded-lg',
                  'bg-background-transparent-white-hover',
                  'border border-transparent'
                )}
              >
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-light/60">Node Type:</span>
                    <span className="text-text-light font-medium">
                      {nodeType}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-light/60">Name Length:</span>
                    <span className="text-text-light font-medium">
                      {formData.name?.length || 0} characters
                    </span>
                  </div>
                  {formData.description && (
                    <div className="flex justify-between">
                      <span className="text-text-light/60">Description Length:</span>
                      <span className="text-text-light font-medium">
                        {formData.description.length} characters
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Connection Hints */}
      {showConnectionHints && connectionHints.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-text-light/50 uppercase tracking-wider flex items-center gap-2">
            <LinkIcon className="w-3 h-3" />
            Suggested Connections ({connectionHints.length})
          </div>
          <div className="space-y-1">
            {connectionHints.slice(0, 3).map((hint, index) => (
              <ConnectionHint key={index} hint={hint} index={index} />
            ))}
            {connectionHints.length > 3 && (
              <div className="text-xs text-text-light/50 text-center py-1">
                +{connectionHints.length - 3} more nearby nodes
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connection Point Indicators */}
      <div
        className={cn(
          'p-3 rounded-lg',
          'bg-background-transparent-white-hover',
          'border border-transparent'
        )}
      >
        <div className="text-xs font-semibold text-text-light/50 uppercase tracking-wider mb-2">
          Connection Points
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-text-light/70">Top (Target)</span>
          </div>
          <ArrowRight className="w-3 h-3 text-text-light/30" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-text-light/70">Bottom (Source)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Compact Block Preview (smaller version)
 */
export const CompactBlockPreview = ({ nodeType, formData }) => {
  return (
    <BlockPreview
      nodeType={nodeType}
      formData={formData}
      showConnectionHints={false}
      showZoomControls={false}
      className="max-w-md"
    />
  );
};

export default BlockPreview;
