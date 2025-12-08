/**
 * Attribute Badges Component
 *
 * Badge components for displaying node attributes (context, assumptions, justifications)
 */

import React from 'react';
import { Info, AlertCircle, FileText } from 'lucide-react';
import { cn } from '../../../../lib/utils';

/**
 * Base Badge Component
 */
const BaseBadge = ({ icon: Icon, label, color, className, onClick }) => {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5',
        'px-2 py-1',
        'rounded-md',
        'text-xs font-medium',
        'transition-colors duration-200',
        onClick && 'cursor-pointer hover:opacity-80',
        color,
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {Icon && <Icon className="w-3 h-3" />}
      <span>{label}</span>
    </div>
  );
};

/**
 * Context Badge
 */
export const ContextBadge = ({ count, onClick, className }) => {
  return (
    <BaseBadge
      icon={Info}
      label={`Context ${count > 1 ? `(${count})` : ''}`}
      color="bg-blue-500/20 text-blue-300 border border-blue-400/30"
      className={className}
      onClick={onClick}
    />
  );
};

/**
 * Assumption Badge
 */
export const AssumptionBadge = ({ count, onClick, className }) => {
  return (
    <BaseBadge
      icon={AlertCircle}
      label={`Assumption ${count > 1 ? `(${count})` : ''}`}
      color="bg-yellow-500/20 text-yellow-300 border border-yellow-400/30"
      className={className}
      onClick={onClick}
    />
  );
};

/**
 * Justification Badge
 */
export const JustificationBadge = ({ count, onClick, className }) => {
  return (
    <BaseBadge
      icon={FileText}
      label={`Justification ${count > 1 ? `(${count})` : ''}`}
      color="bg-purple-500/20 text-purple-300 border border-purple-400/30"
      className={className}
      onClick={onClick}
    />
  );
};

/**
 * Strength Badge
 */
export const StrengthBadge = ({ strength, className }) => {
  const strengthColors = {
    weak: 'bg-red-500/20 text-red-300 border border-red-400/30',
    moderate: 'bg-yellow-500/20 text-yellow-300 border border-yellow-400/30',
    strong: 'bg-green-500/20 text-green-300 border border-green-400/30',
  };

  const normalizedStrength = (strength || 'moderate').toLowerCase();
  const color = strengthColors[normalizedStrength] || strengthColors.moderate;

  return (
    <BaseBadge
      label={`Strength: ${strength}`}
      color={color}
      className={className}
    />
  );
};

/**
 * Status Badge
 */
export const StatusBadge = ({ status, className }) => {
  const statusColors = {
    pending: 'bg-orange-500/20 text-orange-300 border border-orange-400/30',
    'in-progress': 'bg-blue-500/20 text-blue-300 border border-blue-400/30',
    complete: 'bg-green-500/20 text-green-300 border border-green-400/30',
    approved: 'bg-teal-500/20 text-teal-300 border border-teal-400/30',
    rejected: 'bg-red-500/20 text-red-300 border border-red-400/30',
  };

  const normalizedStatus = (status || 'pending').toLowerCase().replace(/\s+/g, '-');
  const color = statusColors[normalizedStatus] || statusColors.pending;

  return (
    <BaseBadge
      label={status}
      color={color}
      className={className}
    />
  );
};

/**
 * Priority Badge
 */
export const PriorityBadge = ({ priority, className }) => {
  const priorityColors = {
    low: 'bg-gray-500/20 text-gray-300 border border-gray-400/30',
    medium: 'bg-yellow-500/20 text-yellow-300 border border-yellow-400/30',
    high: 'bg-red-500/20 text-red-300 border border-red-400/30',
    critical: 'bg-pink-500/20 text-pink-300 border border-pink-400/30',
  };

  const normalizedPriority = (priority || 'medium').toLowerCase();
  const color = priorityColors[normalizedPriority] || priorityColors.medium;

  // Priority emoji mapping
  const emojiMap = {
    low: '🔵',
    medium: '🟡',
    high: '🔴',
    critical: '🚨',
  };

  const emoji = emojiMap[normalizedPriority] || emojiMap.medium;

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-sm">{emoji}</span>
      <span className="text-xs text-text-light/70 capitalize">{priority}</span>
    </div>
  );
};

/**
 * Attributes Section Component
 * Displays all attributes (context, assumptions, justifications) in a group
 */
export const AttributesSection = ({ attributes, onAttributeClick, className }) => {
  if (!attributes) return null;

  const { context = [], assumptions = [], justifications = [] } = attributes;

  const hasAttributes = context.length > 0 || assumptions.length > 0 || justifications.length > 0;

  if (!hasAttributes) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {context.length > 0 && (
        <ContextBadge
          count={context.length}
          onClick={onAttributeClick ? () => onAttributeClick('context', context) : undefined}
        />
      )}
      {assumptions.length > 0 && (
        <AssumptionBadge
          count={assumptions.length}
          onClick={onAttributeClick ? () => onAttributeClick('assumptions', assumptions) : undefined}
        />
      )}
      {justifications.length > 0 && (
        <JustificationBadge
          count={justifications.length}
          onClick={onAttributeClick ? () => onAttributeClick('justifications', justifications) : undefined}
        />
      )}
    </div>
  );
};

/**
 * Metadata Section Component
 * Displays metadata (strength, status, priority) in a group
 */
export const MetadataSection = ({ metadata, className }) => {
  if (!metadata) return null;

  const { strength, status, priority, confidence } = metadata;

  const hasMetadata = strength || status || priority || confidence;

  if (!hasMetadata) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {priority && <PriorityBadge priority={priority} />}
      {strength && <StrengthBadge strength={strength} />}
      {status && <StatusBadge status={status} />}
      {confidence && (
        <span className="text-xs text-text-light/60">
          Confidence: {confidence}%
        </span>
      )}
    </div>
  );
};

export default {
  ContextBadge,
  AssumptionBadge,
  JustificationBadge,
  StrengthBadge,
  StatusBadge,
  PriorityBadge,
  AttributesSection,
  MetadataSection,
};
