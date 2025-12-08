/**
 * Base Node Component
 *
 * Collapsible/expandable node component with glassmorphism styling
 * inspired by FloraFauna.ai. Serves as the foundation for all node types.
 *
 * Features:
 * - Glassmorphism dark theme styling
 * - Collapsible/expandable state with smooth transitions
 * - Type-specific color schemes
 * - Custom connection handles
 * - Framer Motion animations
 * - Accessibility support
 *
 * @component
 * @example
 * <BaseNode
 *   data={{ name: 'Goal', description: 'Top-level goal' }}
 *   selected={false}
 *   nodeType="goal"
 * />
 */

import React, { useState, useEffect, useContext } from 'react';
import { Position } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { Card } from '../../../ui/card';
import CustomHandle from '../handles/CustomHandle';
import {
  getNodeTypeConfig,
  getNodeIcon,
  getColorSchemeClasses,
  ThemeContext,
} from '../utils/themeConfig';
import {
  buildNodeContainerClasses,
  buildNodeHeaderClasses,
  buildNodeTitleClasses,
  buildNodeIconClasses,
  buildNodeContentClasses,
  buildPreviewTextClasses,
  buildDescriptionClasses,
  buildSeparatorClasses,
} from '../utils/nodeStyles';
import {
  nodeEntranceVariants,
  contentCollapseVariants,
  withReducedMotion,
} from '../utils/animations';
import {
  formatIdentifier,
  getDisplayName,
  truncateText,
  extractAttributes,
  extractMetadata,
} from '../utils/identifierUtils';
import {
  AttributesSection,
  MetadataSection,
} from './AttributeBadges';

/**
 * BaseNode Component
 * @param {object} props - Component props
 * @param {object} props.data - Node data
 * @param {string} props.data.id - Node identifier
 * @param {string} props.data.name - Node name/title
 * @param {string} props.data.description - Short description
 * @param {string} props.data.long_description - Full description
 * @param {string} props.data.short_description - Preview description
 * @param {boolean} props.selected - Whether node is selected
 * @param {boolean} props.isConnectable - Whether node can connect
 * @param {React.ReactNode} props.children - Additional content when expanded
 * @param {string} props.nodeType - Node type (goal, strategy, propertyClaim, evidence, context)
 * @param {boolean} props.defaultExpanded - Initial expanded state
 * @param {function} props.onExpandChange - Callback when expand state changes
 * @param {string} props.className - Additional CSS classes
 * @returns {React.Element} BaseNode component
 */
const BaseNode = ({
  data = {},
  selected = false,
  isConnectable = true,
  children,
  nodeType = 'goal',
  defaultExpanded = false,
  onExpandChange,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isHovered, setIsHovered] = useState(false);

  // Get context values including onHandleClick callback
  const { onHandleClick } = useContext(ThemeContext) || {};

  // Get node type configuration
  const config = getNodeTypeConfig(nodeType);
  const Icon = getNodeIcon(nodeType);
  const colors = getColorSchemeClasses(nodeType);

  // Auto-expand when selected
  useEffect(() => {
    if (selected) {
      setIsExpanded(true);
    }
  }, [selected]);

  // Handle expand/collapse toggle
  const handleToggle = (e) => {
    // Prevent event bubbling to React Flow
    e.stopPropagation();

    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);

    if (onExpandChange) {
      onExpandChange(newExpandedState);
    }
  };

  // Get consolidated description
  const getDescription = () => {
    // Prioritize: description > long_description > short_description
    return data.description || data.long_description || data.short_description || 'No description available';
  };

  // Get display name (name or formatted identifier)
  const displayName = getDisplayName(data, nodeType);

  // Get formatted identifier for footer
  const formattedId = formatIdentifier(data.id, nodeType);

  // Extract attributes and metadata
  const attributes = extractAttributes(data);
  const metadata = extractMetadata(data);

  // Apply reduced motion if user prefers
  const entranceVariants = withReducedMotion(nodeEntranceVariants);
  const collapseVariants = withReducedMotion(contentCollapseVariants);

  return (
    <>
      {/* Target Handle (if configured for this node type) */}
      {config.showTargetHandle && (
        <CustomHandle
          type="target"
          position={Position.Top}
          nodeId={data.id}
          id={`${data.id}-target`}
          isConnectable={isConnectable}
          onHandleClick={onHandleClick}
          nodeData={data}
        />
      )}

      {/* Node Container */}
      <motion.div
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={entranceVariants}
        whileHover={{ scale: 1.02 }}
        className={cn(
          buildNodeContainerClasses({
            nodeType,
            isSelected: selected,
            isHovered,
            isCollapsed: !isExpanded,
          }),
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-expanded={isExpanded}
        aria-label={`${config.name} node: ${data.name}`}
      >
        <Card
          className={cn(
            'bg-transparent',
            'border-0',
            'shadow-none',
            'p-0',
            'overflow-hidden'
          )}
        >
          {/* Header - Always Visible */}
          <div className={buildNodeHeaderClasses(nodeType)}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Icon */}
              {Icon && (
                <Icon
                  className={buildNodeIconClasses(nodeType, isHovered)}
                  aria-hidden="true"
                />
              )}

              {/* Title (Name or Identifier) */}
              <div className={buildNodeTitleClasses(nodeType)}>
                {displayName}
              </div>
            </div>

            {/* Expand/Collapse Indicator */}
            <motion.button
              onClick={handleToggle}
              onMouseDown={(e) => e.stopPropagation()}
              className="bg-transparent border-none p-0 m-0 cursor-pointer hover:opacity-70 transition-opacity outline-none"
              aria-label={isExpanded ? 'Collapse node' : 'Expand node'}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown
                  className="w-4 h-4 text-icon-light-secondary flex-shrink-0"
                  aria-hidden="true"
                />
              </motion.div>
            </motion.button>
          </div>

          {/* Collapsed State - Truncated Description */}
          {!isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-4 pb-3"
            >
              <p className={buildPreviewTextClasses()}>
                {truncateText(getDescription(), 2)}
              </p>
            </motion.div>
          )}

          {/* Expanded State - Full Content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                variants={collapseVariants}
                className="overflow-hidden"
              >
                <div className={buildNodeContentClasses(true)}>
                  {/* Full Description */}
                  <div>
                    <p className={buildDescriptionClasses()}>
                      {getDescription()}
                    </p>
                  </div>

                  {/* Attributes Section (Context, Assumptions, Justifications) */}
                  {(attributes.context.length > 0 ||
                    attributes.assumptions.length > 0 ||
                    attributes.justifications.length > 0) && (
                    <>
                      <div className={buildSeparatorClasses()} />
                      <AttributesSection attributes={attributes} />
                    </>
                  )}

                  {/* Metadata Section (Strength, Status, Priority) */}
                  {(metadata.strength || metadata.status || metadata.priority || metadata.confidence) && (
                    <>
                      <div className={buildSeparatorClasses()} />
                      <MetadataSection metadata={metadata} />
                    </>
                  )}

                  {/* Custom Content */}
                  {children && (
                    <>
                      <div className={buildSeparatorClasses()} />
                      <div className="space-y-2">
                        {children}
                      </div>
                    </>
                  )}

                  {/* Footer: Node Type and Identifier */}
                  <div className={buildSeparatorClasses()} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-light/50 font-medium uppercase tracking-wider">
                      {config.name}
                    </span>
                    {formattedId && (
                      <span className="text-xs text-text-light/40 font-mono">
                        {formattedId}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* Source Handle (if configured for this node type) */}
      {config.showSourceHandle && (
        <CustomHandle
          type="source"
          position={Position.Bottom}
          nodeId={data.id}
          id={`${data.id}-source`}
          isConnectable={isConnectable}
          onHandleClick={onHandleClick}
          nodeData={data}
        />
      )}
    </>
  );
};

/**
 * BaseNode with custom action buttons
 */
export const BaseNodeWithActions = ({
  actions = [],
  ...props
}) => {
  return (
    <BaseNode {...props}>
      {props.children}
      {actions.length > 0 && (
        <div className="flex gap-2 mt-3">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              className={cn(
                'px-3 py-1.5',
                'text-xs',
                'rounded-md',
                'bg-background-transparent-white-hover',
                'hover:bg-background-transparent-white-secondaryHover',
                'text-text-light',
                'transition-colors',
                'duration-200',
                'border',
                'border-transparent'
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </BaseNode>
  );
};

/**
 * BaseNode with metadata display
 */
export const BaseNodeWithMetadata = ({
  metadata = {},
  ...props
}) => {
  return (
    <BaseNode {...props}>
      {props.children}
      {Object.keys(metadata).length > 0 && (
        <div className="space-y-1 mt-3">
          {Object.entries(metadata).map(([key, value]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-text-light/50">{key}:</span>
              <span className="text-text-light/70 font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}
    </BaseNode>
  );
};

/**
 * Compact BaseNode variant (smaller size)
 */
export const CompactBaseNode = (props) => {
  return (
    <BaseNode
      {...props}
      className={cn(
        'min-w-[150px]',
        'max-w-[250px]',
        props.className
      )}
    />
  );
};

/**
 * Large BaseNode variant (larger size)
 */
export const LargeBaseNode = (props) => {
  return (
    <BaseNode
      {...props}
      className={cn(
        'min-w-[250px]',
        'max-w-[500px]',
        props.className
      )}
    />
  );
};

export default BaseNode;
