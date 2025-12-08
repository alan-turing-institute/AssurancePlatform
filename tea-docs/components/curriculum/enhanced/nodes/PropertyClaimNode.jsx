/**
 * PropertyClaimNode Component
 *
 * Specialized node type for property claims in assurance cases.
 * Features orange glassmorphism theme, claim strength indicators,
 * verification status badges, and metadata display.
 *
 * Features:
 * - FileText icon from Lucide React
 * - Orange glassmorphism (amber color scheme)
 * - Claim strength indicator
 * - Verification status badge
 * - Metadata display (author, date)
 * - Both source and target handles
 * - Linked evidence count
 * - Confidence level display
 *
 * @component
 * @example
 * <PropertyClaimNode
 *   data={{
 *     id: 'claim-1',
 *     name: 'Component X is safe',
 *     description: 'Component X operates within safe parameters',
 *     strength: 'strong',
 *     verificationStatus: 'verified',
 *     linkedEvidenceCount: 3,
 *     author: 'John Doe',
 *     date: '2025-11-10'
 *   }}
 *   selected={false}
 * />
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  CheckCircle,
  AlertTriangle,
  Clock,
  Link2,
  User,
  Calendar,
} from 'lucide-react';
import { cn } from '../../../../lib/utils';
import CollapsibleNode from './CollapsibleNode';
import { Badge } from '../../../ui/badge';

/**
 * Verification status badge with appropriate styling
 */
const VerificationStatusBadge = ({ status = 'pending' }) => {
  const statusConfig = {
    verified: {
      label: 'Verified',
      className: 'bg-green-500/20 text-green-300 border-green-400/30',
      icon: CheckCircle,
    },
    'in-review': {
      label: 'In Review',
      className: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
      icon: Clock,
    },
    pending: {
      label: 'Pending',
      className: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
      icon: Clock,
    },
    challenged: {
      label: 'Challenged',
      className: 'bg-red-500/20 text-red-300 border-red-400/30',
      icon: AlertTriangle,
    },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs px-2 py-0.5',
        'border',
        'backdrop-blur-sm',
        config.className
      )}
    >
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
};

/**
 * Claim strength indicator
 */
const ClaimStrengthIndicator = ({ strength = 'moderate' }) => {
  const strengthConfig = {
    strong: {
      label: 'Strong',
      bars: 5,
      color: 'bg-green-500',
    },
    moderate: {
      label: 'Moderate',
      bars: 3,
      color: 'bg-orange-400',
    },
    weak: {
      label: 'Weak',
      bars: 1,
      color: 'bg-red-400',
    },
  };

  const config = strengthConfig[strength] || strengthConfig.moderate;

  return (
    <div className="space-y-1">
      <div className="text-xs text-text-light/50">
        Strength: <span className="text-text-light/70 font-medium">{config.label}</span>
      </div>
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 w-4 rounded-full transition-all duration-300',
              i < config.bars
                ? config.color
                : 'bg-background-transparent-white-hover'
            )}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Linked evidence counter
 */
const LinkedEvidenceCounter = ({ count = 0 }) => {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-400/20">
      <Link2 className="w-4 h-4 text-orange-400" />
      <div className="flex flex-col">
        <span className="text-xs text-text-light/50">Evidence</span>
        <span className="text-sm font-semibold text-orange-300">
          {count} {count === 1 ? 'item' : 'items'}
        </span>
      </div>
    </div>
  );
};

/**
 * Metadata display component
 */
const MetadataDisplay = ({ author, date, reviewer, lastUpdated }) => {
  const items = [];

  if (author) {
    items.push({
      icon: User,
      label: 'Author',
      value: author,
    });
  }

  if (date) {
    items.push({
      icon: Calendar,
      label: 'Created',
      value: date,
    });
  }

  if (reviewer) {
    items.push({
      icon: User,
      label: 'Reviewer',
      value: reviewer,
    });
  }

  if (lastUpdated) {
    items.push({
      icon: Clock,
      label: 'Updated',
      value: lastUpdated,
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <div key={index} className="flex items-center gap-2 text-xs">
            <Icon className="w-3.5 h-3.5 text-orange-400/70" />
            <span className="text-text-light/50">{item.label}:</span>
            <span className="text-text-light/70 font-medium">{item.value}</span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * PropertyClaimNode Component
 *
 * @param {Object} props - Component props
 * @param {string} props.id - Node ID
 * @param {Object} props.data - Node data
 * @param {string} props.data.name - Claim name
 * @param {string} props.data.description - Claim description
 * @param {string} props.data.strength - Claim strength (strong, moderate, weak)
 * @param {string} props.data.verificationStatus - Status (verified, in-review, pending, challenged)
 * @param {number} props.data.linkedEvidenceCount - Number of linked evidence items
 * @param {string} props.data.author - Author name
 * @param {string} props.data.date - Creation date
 * @param {string} props.data.reviewer - Reviewer name
 * @param {string} props.data.lastUpdated - Last update date
 * @param {boolean} props.selected - Is node selected
 * @param {boolean} props.isConnectable - Can node connect
 * @returns {React.Element} PropertyClaimNode component
 */
const PropertyClaimNode = ({
  id,
  data = {},
  selected = false,
  isConnectable = true,
  ...restProps
}) => {
  // Extract property claim-specific data
  const {
    strength = 'moderate',
    verificationStatus = 'pending',
    linkedEvidenceCount = 0,
    author,
    date,
    reviewer,
    lastUpdated,
    assumptions = [],
    relatedClaims = [],
    metadata = {},
  } = data;

  return (
    <CollapsibleNode
      id={id}
      data={data}
      selected={selected}
      isConnectable={isConnectable}
      nodeType="propertyClaim"
      className={cn(
        'min-w-[250px] max-w-[380px]',
        'property-claim-node',
        // Orange glow for selected state
        selected && 'shadow-[0_0_20px_rgba(251,146,60,0.3)]'
      )}
      {...restProps}
    >
      {/* PropertyClaim-specific expanded content */}
      <div className="space-y-3">
        {/* Status and Strength Row */}
        <div className="flex items-center justify-between gap-2">
          <VerificationStatusBadge status={verificationStatus} />
          <div className="text-xs text-text-light/50">
            {strength && `${strength.charAt(0).toUpperCase() + strength.slice(1)} claim`}
          </div>
        </div>

        {/* Claim Strength Indicator */}
        <ClaimStrengthIndicator strength={strength} />

        {/* Linked Evidence Counter */}
        <LinkedEvidenceCounter count={linkedEvidenceCount} />

        {/* Metadata */}
        <MetadataDisplay
          author={author}
          date={date}
          reviewer={reviewer}
          lastUpdated={lastUpdated}
        />

        {/* Assumptions */}
        {assumptions && assumptions.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-text-light/50 uppercase tracking-wider font-medium">
              Assumptions
            </div>
            <ul className="space-y-1">
              {assumptions.slice(0, 2).map((assumption, i) => (
                <li
                  key={i}
                  className="text-xs text-text-light/70 flex items-start gap-2"
                >
                  <span className="text-orange-400 mt-0.5">▸</span>
                  <span>{assumption.name || assumption}</span>
                </li>
              ))}
              {assumptions.length > 2 && (
                <li className="text-xs text-text-light/50 italic">
                  + {assumptions.length - 2} more...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Related Claims */}
        {relatedClaims && relatedClaims.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-text-light/50 uppercase tracking-wider font-medium">
              Related Claims
            </div>
            <ul className="space-y-1">
              {relatedClaims.slice(0, 2).map((claim, i) => (
                <li
                  key={i}
                  className="text-xs text-text-light/70 flex items-start gap-2"
                >
                  <Link2 className="w-3 h-3 text-orange-400 mt-0.5 flex-shrink-0" />
                  <span>{claim.name || claim}</span>
                </li>
              ))}
              {relatedClaims.length > 2 && (
                <li className="text-xs text-text-light/50 italic">
                  + {relatedClaims.length - 2} more...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Additional Metadata */}
        {Object.keys(metadata).length > 0 && (
          <div className="space-y-1 pt-2 border-t border-border-transparent/50">
            {Object.entries(metadata).slice(0, 3).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-text-light/50 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <span className="text-text-light/70 font-medium">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Verification indicator animation for verified claims */}
        {verificationStatus === 'verified' && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-400/20"
          >
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-300 font-medium">
              Verification Complete
            </span>
          </motion.div>
        )}

        {/* Challenge indicator for challenged claims */}
        {verificationStatus === 'challenged' && (
          <motion.div
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(239, 68, 68, 0)',
                '0 0 0 6px rgba(239, 68, 68, 0.1)',
                '0 0 0 0 rgba(239, 68, 68, 0)',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: 'loop',
            }}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-400/20"
          >
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-300 font-medium">
              Requires Attention
            </span>
          </motion.div>
        )}
      </div>
    </CollapsibleNode>
  );
};

/**
 * Compact PropertyClaimNode variant
 */
export const CompactPropertyClaimNode = (props) => {
  return (
    <PropertyClaimNode
      {...props}
      className={cn('min-w-[200px] max-w-[300px]', props.className)}
    />
  );
};

/**
 * PropertyClaimNode with verification emphasis
 */
export const VerifiedPropertyClaimNode = (props) => {
  return (
    <PropertyClaimNode
      {...props}
      data={{
        ...props.data,
        verificationStatus: 'verified',
        strength: 'strong',
      }}
    />
  );
};

/**
 * PropertyClaimNode requiring review
 */
export const PendingPropertyClaimNode = (props) => {
  return (
    <PropertyClaimNode
      {...props}
      data={{
        ...props.data,
        verificationStatus: 'in-review',
      }}
    />
  );
};

export default PropertyClaimNode;
