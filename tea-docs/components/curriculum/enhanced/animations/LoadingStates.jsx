/**
 * Loading States Component
 *
 * Comprehensive loading state components including:
 * - Skeleton loaders for nodes
 * - Shimmer effects
 * - Progress indicators
 * - Spinner variations
 * - Placeholder animations
 * - Content reveal animations
 *
 * @component
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { useAnimation } from './AnimationProvider';
import { LOADING_ANIMATIONS, TIMING } from './animationPresets';

// ========================================================================
// Skeleton Loader Component
// ========================================================================

/**
 * Skeleton loader with shimmer effect
 * @param {object} props - Component props
 * @param {string} props.className - CSS classes
 * @param {string} props.variant - Variant (text, title, circle, rectangle)
 * @param {number} props.count - Number of skeleton lines
 */
export const Skeleton = ({
  className = '',
  variant = 'text',
  count = 1,
  ...props
}) => {
  const { shouldAnimate } = useAnimation();

  const variants = {
    text: 'h-4 w-full',
    title: 'h-6 w-3/4',
    circle: 'h-12 w-12 rounded-full',
    rectangle: 'h-32 w-full',
    avatar: 'h-10 w-10 rounded-full',
    button: 'h-10 w-24 rounded-md',
  };

  const baseClasses = cn(
    'bg-gray-700/50',
    'rounded',
    'relative',
    'overflow-hidden',
    variants[variant],
    className
  );

  const shimmerClasses = cn(
    'absolute',
    'inset-0',
    'bg-gradient-to-r',
    'from-transparent',
    'via-gray-600/20',
    'to-transparent',
    '-translate-x-full'
  );

  const skeletons = Array.from({ length: count }, (_, i) => (
    <div key={i} className={baseClasses} {...props}>
      {shouldAnimate && (
        <motion.div
          className={shimmerClasses}
          animate={LOADING_ANIMATIONS.shimmer}
        />
      )}
    </div>
  ));

  return count === 1 ? skeletons[0] : <div className="space-y-3">{skeletons}</div>;
};

// ========================================================================
// Node Skeleton Component
// ========================================================================

/**
 * Skeleton loader specifically for React Flow nodes
 * @param {object} props - Component props
 * @param {string} props.nodeType - Node type (goal, strategy, etc.)
 * @param {boolean} props.expanded - Whether node is expanded
 * @param {string} props.className - CSS classes
 */
export const NodeSkeleton = ({
  nodeType = 'goal',
  expanded = false,
  className = '',
}) => {
  const { shouldAnimate } = useAnimation();

  const containerClasses = cn(
    'min-w-[200px]',
    'max-w-[300px]',
    'bg-background-transparent-black',
    'border',
    'border-border-transparent',
    'f-effect-backdrop-blur-lg',
    'rounded-xl',
    'shadow-glassmorphic',
    'p-4',
    className
  );

  return (
    <div className={containerClasses}>
      {/* Header skeleton */}
      <div className="flex items-center gap-2 mb-3">
        <Skeleton variant="circle" className="h-5 w-5 flex-shrink-0" />
        <Skeleton variant="title" className="h-4 flex-1" />
        <Skeleton variant="circle" className="h-4 w-4 flex-shrink-0" />
      </div>

      {/* Content skeleton */}
      {expanded ? (
        <>
          <div className="h-px bg-border-transparent mb-3" />
          <Skeleton variant="text" count={3} />
          <div className="h-px bg-border-transparent my-3" />
          <Skeleton variant="text" count={2} />
        </>
      ) : (
        <Skeleton variant="text" count={2} />
      )}
    </div>
  );
};

// ========================================================================
// Spinner Component
// ========================================================================

/**
 * Spinning loader icon
 * @param {object} props - Component props
 * @param {number} props.size - Size in pixels
 * @param {string} props.className - CSS classes
 */
export const Spinner = ({
  size = 24,
  className = '',
  ...props
}) => {
  const { shouldAnimate } = useAnimation();

  if (!shouldAnimate) {
    return (
      <Loader2
        size={size}
        className={cn('text-text-light/70', className)}
        {...props}
      />
    );
  }

  return (
    <motion.div animate={LOADING_ANIMATIONS.spin}>
      <Loader2
        size={size}
        className={cn('text-text-light/70', className)}
        {...props}
      />
    </motion.div>
  );
};

// ========================================================================
// Dots Loader Component
// ========================================================================

/**
 * Three dots loading animation
 * @param {object} props - Component props
 * @param {string} props.className - CSS classes
 */
export const DotsLoader = ({ className = '' }) => {
  const { shouldAnimate, getDuration } = useAnimation();

  const dotClasses = cn(
    'w-2 h-2',
    'bg-text-light',
    'rounded-full'
  );

  const containerClasses = cn(
    'flex gap-1 items-center',
    className
  );

  if (!shouldAnimate) {
    return (
      <div className={containerClasses}>
        <div className={dotClasses} />
        <div className={dotClasses} />
        <div className={dotClasses} />
      </div>
    );
  }

  const dotVariants = {
    animate: {
      y: [0, -8, 0],
      transition: {
        duration: getDuration(600) / 1000,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  return (
    <div className={containerClasses}>
      <motion.div
        className={dotClasses}
        variants={dotVariants}
        animate="animate"
        transition={{ delay: 0 }}
      />
      <motion.div
        className={dotClasses}
        variants={dotVariants}
        animate="animate"
        transition={{ delay: 0.2 }}
      />
      <motion.div
        className={dotClasses}
        variants={dotVariants}
        animate="animate"
        transition={{ delay: 0.4 }}
      />
    </div>
  );
};

// ========================================================================
// Progress Bar Component
// ========================================================================

/**
 * Animated progress bar
 * @param {object} props - Component props
 * @param {number} props.progress - Progress value (0-100)
 * @param {string} props.className - CSS classes
 * @param {boolean} props.showLabel - Show percentage label
 */
export const ProgressBar = ({
  progress = 0,
  className = '',
  showLabel = false,
  ...props
}) => {
  const { shouldAnimate, getSpring } = useAnimation();

  const containerClasses = cn(
    'w-full',
    'h-2',
    'bg-gray-700/50',
    'rounded-full',
    'overflow-hidden',
    'relative',
    className
  );

  const barClasses = cn(
    'h-full',
    'bg-gradient-to-r',
    'from-blue-500',
    'to-purple-500',
    'rounded-full'
  );

  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className="space-y-1">
      <div className={containerClasses} {...props}>
        <motion.div
          className={barClasses}
          initial={{ width: '0%' }}
          animate={{ width: `${clampedProgress}%` }}
          transition={shouldAnimate ? getSpring(SPRING.default) : { duration: 0 }}
        />
      </div>
      {showLabel && (
        <div className="text-xs text-text-light/70 text-right">
          {Math.round(clampedProgress)}%
        </div>
      )}
    </div>
  );
};

// ========================================================================
// Circular Progress Component
// ========================================================================

/**
 * Circular progress indicator
 * @param {object} props - Component props
 * @param {number} props.progress - Progress value (0-100)
 * @param {number} props.size - Size in pixels
 * @param {number} props.strokeWidth - Stroke width
 * @param {string} props.className - CSS classes
 */
export const CircularProgress = ({
  progress = 0,
  size = 48,
  strokeWidth = 4,
  className = '',
  showLabel = false,
}) => {
  const { shouldAnimate } = useAnimation();

  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-700/50"
        />

        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className="text-blue-500"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={shouldAnimate ? { duration: 1, ease: 'easeInOut' } : { duration: 0 }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>

      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-text-light">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      )}
    </div>
  );
};

// ========================================================================
// Pulse Loader Component
// ========================================================================

/**
 * Pulsing loader animation
 * @param {object} props - Component props
 * @param {string} props.className - CSS classes
 */
export const PulseLoader = ({ className = '' }) => {
  const { shouldAnimate } = useAnimation();

  const pulseClasses = cn(
    'w-12 h-12',
    'bg-blue-500/30',
    'rounded-full',
    className
  );

  if (!shouldAnimate) {
    return <div className={pulseClasses} />;
  }

  return (
    <motion.div
      className={pulseClasses}
      animate={LOADING_ANIMATIONS.pulse}
    />
  );
};

// ========================================================================
// Shimmer Container Component
// ========================================================================

/**
 * Container with shimmer loading effect
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {boolean} props.isLoading - Loading state
 * @param {string} props.className - CSS classes
 */
export const ShimmerContainer = ({
  children,
  isLoading = true,
  className = '',
  ...props
}) => {
  const { shouldAnimate } = useAnimation();

  if (!isLoading) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <div className={cn('relative overflow-hidden', className)} {...props}>
      <div className="opacity-50">{children}</div>
      {shouldAnimate && (
        <motion.div
          className={cn(
            'absolute',
            'inset-0',
            'bg-gradient-to-r',
            'from-transparent',
            'via-white/10',
            'to-transparent',
            'pointer-events-none'
          )}
          animate={LOADING_ANIMATIONS.shimmer}
        />
      )}
    </div>
  );
};

// ========================================================================
// Content Reveal Component
// ========================================================================

/**
 * Reveals content with animation after loading
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {boolean} props.isLoading - Loading state
 * @param {React.ReactNode} props.loader - Custom loader component
 * @param {string} props.className - CSS classes
 */
export const ContentReveal = ({
  children,
  isLoading = false,
  loader = <Spinner />,
  className = '',
  ...props
}) => {
  const { shouldAnimate, getVariants } = useAnimation();

  const variants = getVariants({
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: TIMING.medium / 1000,
        ease: 'easeOut',
      },
    },
  });

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        {loader}
      </div>
    );
  }

  if (!shouldAnimate) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Placeholder Component
// ========================================================================

/**
 * Animated placeholder for empty states
 * @param {object} props - Component props
 * @param {string} props.text - Placeholder text
 * @param {string} props.className - CSS classes
 */
export const Placeholder = ({
  text = 'Loading...',
  icon: Icon,
  className = '',
}) => {
  const { shouldAnimate } = useAnimation();

  const containerClasses = cn(
    'flex',
    'flex-col',
    'items-center',
    'justify-center',
    'gap-3',
    'p-8',
    'text-text-light/50',
    className
  );

  return (
    <div className={containerClasses}>
      {Icon && (
        shouldAnimate ? (
          <motion.div animate={LOADING_ANIMATIONS.pulse}>
            <Icon className="w-12 h-12" />
          </motion.div>
        ) : (
          <Icon className="w-12 h-12" />
        )
      )}
      <p className="text-sm">{text}</p>
    </div>
  );
};

// ========================================================================
// Card Skeleton Component
// ========================================================================

/**
 * Skeleton loader for card components
 * @param {object} props - Component props
 * @param {string} props.className - CSS classes
 */
export const CardSkeleton = ({ className = '' }) => {
  return (
    <div
      className={cn(
        'p-4',
        'bg-background-transparent-black',
        'border',
        'border-border-transparent',
        'rounded-xl',
        className
      )}
    >
      <Skeleton variant="title" className="mb-3" />
      <Skeleton variant="text" count={3} />
    </div>
  );
};

// ========================================================================
// Loading Overlay Component
// ========================================================================

/**
 * Full-screen or container loading overlay
 * @param {object} props - Component props
 * @param {boolean} props.isLoading - Loading state
 * @param {string} props.message - Loading message
 * @param {string} props.className - CSS classes
 */
export const LoadingOverlay = ({
  isLoading = false,
  message = 'Loading...',
  className = '',
}) => {
  const { shouldAnimate } = useAnimation();

  if (!isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldAnimate ? 0.2 : 0 }}
      className={cn(
        'absolute',
        'inset-0',
        'bg-black/50',
        'backdrop-blur-sm',
        'flex',
        'flex-col',
        'items-center',
        'justify-center',
        'gap-4',
        'z-50',
        className
      )}
    >
      <Spinner size={48} />
      {message && (
        <p className="text-text-light text-sm">{message}</p>
      )}
    </motion.div>
  );
};

// ========================================================================
// Export All
// ========================================================================

export default {
  Skeleton,
  NodeSkeleton,
  Spinner,
  DotsLoader,
  ProgressBar,
  CircularProgress,
  PulseLoader,
  ShimmerContainer,
  ContentReveal,
  Placeholder,
  CardSkeleton,
  LoadingOverlay,
};
