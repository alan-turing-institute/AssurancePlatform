/**
 * Micro Interactions Component
 *
 * Small, delightful animations for UI feedback including:
 * - Button press effects
 * - Hover state enhancements
 * - Focus ring animations
 * - Success/error feedback
 * - Tooltip transitions
 * - Icon animations
 * - Number counter animations
 *
 * @component
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertCircle, Info } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { useAnimation } from './AnimationProvider';
import { INTERACTION_ANIMATIONS, SPRING, TIMING } from './animationPresets';

// ========================================================================
// Interactive Button Component
// ========================================================================

/**
 * Button with press and hover micro-interactions
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Button content
 * @param {function} props.onClick - Click handler
 * @param {string} props.variant - Button variant (primary, secondary, ghost)
 * @param {string} props.className - CSS classes
 */
export const InteractiveButton = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  ...props
}) => {
  const { shouldAnimate, getSpring } = useAnimation();

  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-text-light',
    ghost: 'bg-transparent hover:bg-background-transparent-white-hover text-text-light',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  const buttonClasses = cn(
    'px-4 py-2',
    'rounded-lg',
    'font-medium',
    'text-sm',
    'transition-colors',
    'duration-200',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-blue-500/50',
    variants[variant],
    className
  );

  if (!shouldAnimate) {
    return (
      <button className={buttonClasses} onClick={onClick} {...props}>
        {children}
      </button>
    );
  }

  return (
    <motion.button
      className={buttonClasses}
      onClick={onClick}
      whileHover={INTERACTION_ANIMATIONS.hover}
      whileTap={INTERACTION_ANIMATIONS.press}
      transition={getSpring(SPRING.stiff)}
      {...props}
    >
      {children}
    </motion.button>
  );
};

// ========================================================================
// Ripple Effect Component
// ========================================================================

/**
 * Material Design ripple effect
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {string} props.className - CSS classes
 */
export const RippleEffect = ({
  children,
  className = '',
  ...props
}) => {
  const { shouldAnimate } = useAnimation();
  const [ripples, setRipples] = useState([]);
  const containerRef = useRef(null);

  const handleClick = (event) => {
    if (!shouldAnimate) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const ripple = {
      x,
      y,
      id: Date.now(),
    };

    setRipples((prev) => [...prev, ripple]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
    }, 600);
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
      onClick={handleClick}
      {...props}
    >
      {children}

      {shouldAnimate && ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          className="absolute bg-white/30 rounded-full pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
          }}
          initial={{ width: 0, height: 0, x: 0, y: 0 }}
          animate={{
            width: 400,
            height: 400,
            x: -200,
            y: -200,
            opacity: 0,
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
};

// ========================================================================
// Focus Ring Component
// ========================================================================

/**
 * Animated focus ring for accessibility
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {boolean} props.isFocused - Focus state
 * @param {string} props.className - CSS classes
 */
export const AnimatedFocusRing = ({
  children,
  isFocused = false,
  className = '',
  ...props
}) => {
  const { shouldAnimate, getSpring } = useAnimation();

  if (!shouldAnimate) {
    return (
      <div
        className={cn(
          isFocused && 'ring-2 ring-blue-500',
          'rounded-lg',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={cn('rounded-lg', 'relative', className)}
      animate={{
        boxShadow: isFocused
          ? '0 0 0 3px rgba(59, 130, 246, 0.5)'
          : '0 0 0 0px rgba(59, 130, 246, 0)',
      }}
      transition={getSpring(SPRING.stiff)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Feedback Toast Component
// ========================================================================

/**
 * Animated feedback toast notification
 * @param {object} props - Component props
 * @param {string} props.type - Toast type (success, error, warning, info)
 * @param {string} props.message - Toast message
 * @param {boolean} props.isVisible - Visibility state
 * @param {function} props.onDismiss - Dismiss callback
 * @param {string} props.className - CSS classes
 */
export const FeedbackToast = ({
  type = 'success',
  message = '',
  isVisible = false,
  onDismiss,
  duration = 3000,
  className = '',
}) => {
  const { shouldAnimate } = useAnimation();

  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        if (onDismiss) onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onDismiss]);

  const config = {
    success: {
      icon: Check,
      bgColor: 'bg-green-600',
      iconColor: 'text-white',
    },
    error: {
      icon: X,
      bgColor: 'bg-red-600',
      iconColor: 'text-white',
    },
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-yellow-600',
      iconColor: 'text-white',
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-600',
      iconColor: 'text-white',
    },
  };

  const { icon: Icon, bgColor, iconColor } = config[type];

  const toastClasses = cn(
    'flex',
    'items-center',
    'gap-3',
    'px-4',
    'py-3',
    'rounded-lg',
    'shadow-lg',
    bgColor,
    'text-white',
    className
  );

  const variants = {
    hidden: { opacity: 0, y: -20, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: shouldAnimate ? SPRING.bouncy : { duration: 0 },
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.9,
      transition: { duration: shouldAnimate ? 0.2 : 0 },
    },
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={variants}
          className={toastClasses}
        >
          <Icon className={cn('w-5 h-5', iconColor)} />
          <span className="text-sm font-medium">{message}</span>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="ml-auto p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ========================================================================
// Success Checkmark Animation
// ========================================================================

/**
 * Animated success checkmark
 * @param {object} props - Component props
 * @param {boolean} props.isVisible - Visibility state
 * @param {number} props.size - Size in pixels
 * @param {string} props.className - CSS classes
 */
export const SuccessCheckmark = ({
  isVisible = false,
  size = 48,
  className = '',
}) => {
  const { shouldAnimate } = useAnimation();

  const circleVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: shouldAnimate ? SPRING.bouncy : { duration: 0 },
    },
  };

  const checkVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: { duration: shouldAnimate ? 0.4 : 0, ease: 'easeOut' },
        opacity: { duration: shouldAnimate ? 0.1 : 0 },
      },
    },
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={circleVariants}
          className={className}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 50 50"
            fill="none"
          >
            <motion.circle
              cx="25"
              cy="25"
              r="20"
              stroke="#22c55e"
              strokeWidth="3"
              fill="none"
              variants={circleVariants}
            />
            <motion.path
              d="M15 25 L22 32 L35 18"
              stroke="#22c55e"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              variants={checkVariants}
            />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ========================================================================
// Counter Animation Component
// ========================================================================

/**
 * Animated number counter
 * @param {object} props - Component props
 * @param {number} props.value - Target value
 * @param {number} props.duration - Animation duration in seconds
 * @param {string} props.className - CSS classes
 */
export const AnimatedCounter = ({
  value = 0,
  duration = 1,
  className = '',
  ...props
}) => {
  const { shouldAnimate, getDuration } = useAnimation();
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayValue(value);
      return;
    }

    const startValue = displayValue;
    const endValue = value;
    const startTime = Date.now();
    const animDuration = getDuration(duration * 1000);

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / animDuration, 1);

      // Easing function (ease out)
      const eased = 1 - Math.pow(1 - progress, 3);

      const current = startValue + (endValue - startValue) * eased;
      setDisplayValue(Math.round(current));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration, shouldAnimate, getDuration]);

  return (
    <span className={className} {...props}>
      {displayValue}
    </span>
  );
};

// ========================================================================
// Icon Rotation Component
// ========================================================================

/**
 * Icon with hover rotation animation
 * @param {object} props - Component props
 * @param {React.ComponentType} props.icon - Icon component
 * @param {number} props.rotation - Rotation angle
 * @param {string} props.className - CSS classes
 */
export const RotatingIcon = ({
  icon: Icon,
  rotation = 90,
  className = '',
  ...props
}) => {
  const { shouldAnimate } = useAnimation();

  if (!shouldAnimate) {
    return <Icon className={className} {...props} />;
  }

  return (
    <motion.div
      whileHover={{ rotate: rotation }}
      transition={SPRING.default}
      className="inline-block"
    >
      <Icon className={className} {...props} />
    </motion.div>
  );
};

// ========================================================================
// Bounce Icon Component
// ========================================================================

/**
 * Icon that bounces on hover
 * @param {object} props - Component props
 * @param {React.ComponentType} props.icon - Icon component
 * @param {string} props.className - CSS classes
 */
export const BounceIcon = ({
  icon: Icon,
  className = '',
  ...props
}) => {
  const { shouldAnimate } = useAnimation();

  if (!shouldAnimate) {
    return <Icon className={className} {...props} />;
  }

  return (
    <motion.div
      whileHover={{
        y: [0, -5, 0],
        transition: { duration: 0.3 },
      }}
      className="inline-block"
    >
      <Icon className={className} {...props} />
    </motion.div>
  );
};

// ========================================================================
// Shake Component
// ========================================================================

/**
 * Shake animation for error feedback
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {boolean} props.trigger - Trigger shake animation
 * @param {string} props.className - CSS classes
 */
export const Shake = ({
  children,
  trigger = false,
  className = '',
  ...props
}) => {
  const { shouldAnimate } = useAnimation();
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (trigger) {
      setKey((prev) => prev + 1);
    }
  }, [trigger]);

  if (!shouldAnimate) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <motion.div
      key={key}
      animate={trigger ? INTERACTION_ANIMATIONS.shake : {}}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Wiggle Component
// ========================================================================

/**
 * Wiggle animation for attention
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {boolean} props.trigger - Trigger wiggle animation
 * @param {string} props.className - CSS classes
 */
export const Wiggle = ({
  children,
  trigger = false,
  className = '',
  ...props
}) => {
  const { shouldAnimate } = useAnimation();
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (trigger) {
      setKey((prev) => prev + 1);
    }
  }, [trigger]);

  if (!shouldAnimate) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <motion.div
      key={key}
      animate={trigger ? INTERACTION_ANIMATIONS.wiggle : {}}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Tooltip Component
// ========================================================================

/**
 * Animated tooltip
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Trigger element
 * @param {string} props.content - Tooltip content
 * @param {string} props.position - Tooltip position (top, bottom, left, right)
 * @param {string} props.className - CSS classes
 */
export const AnimatedTooltip = ({
  children,
  content,
  position = 'top',
  className = '',
}) => {
  const { shouldAnimate } = useAnimation();
  const [isVisible, setIsVisible] = useState(false);

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const variants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: shouldAnimate ? SPRING.stiff : { duration: 0 },
    },
  };

  return (
    <div
      className={cn('relative inline-block', className)}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={variants}
            className={cn(
              'absolute',
              'z-50',
              'px-3',
              'py-2',
              'bg-gray-900',
              'text-white',
              'text-xs',
              'rounded-lg',
              'whitespace-nowrap',
              'shadow-lg',
              positions[position]
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ========================================================================
// Badge Pulse Component
// ========================================================================

/**
 * Badge with pulse animation for notifications
 * @param {object} props - Component props
 * @param {string|number} props.count - Badge count
 * @param {boolean} props.pulse - Enable pulse animation
 * @param {string} props.className - CSS classes
 */
export const BadgePulse = ({
  count,
  pulse = true,
  className = '',
  ...props
}) => {
  const { shouldAnimate } = useAnimation();

  const badgeClasses = cn(
    'inline-flex',
    'items-center',
    'justify-center',
    'min-w-[20px]',
    'h-5',
    'px-2',
    'text-xs',
    'font-semibold',
    'text-white',
    'bg-red-600',
    'rounded-full',
    className
  );

  if (!shouldAnimate || !pulse) {
    return (
      <span className={badgeClasses} {...props}>
        {count}
      </span>
    );
  }

  return (
    <motion.span
      className={badgeClasses}
      animate={{
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      {...props}
    >
      {count}
    </motion.span>
  );
};

// ========================================================================
// Export All
// ========================================================================

export default {
  InteractiveButton,
  RippleEffect,
  AnimatedFocusRing,
  FeedbackToast,
  SuccessCheckmark,
  AnimatedCounter,
  RotatingIcon,
  BounceIcon,
  Shake,
  Wiggle,
  AnimatedTooltip,
  BadgePulse,
};
