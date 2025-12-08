/**
 * Transition Effects Component
 *
 * Page and component transition effects including:
 * - Page/section transitions
 * - Modal open/close effects
 * - Tab switching animations
 * - Accordion expand/collapse
 * - Crossfade transitions
 * - Morphing animations
 *
 * @component
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../../lib/utils';
import { useAnimation } from './AnimationProvider';
import {
  ENTRY_ANIMATIONS,
  EXIT_ANIMATIONS,
  MODAL_ANIMATIONS,
  COLLAPSE_ANIMATIONS,
  SPRING,
  TIMING,
} from './animationPresets';

// ========================================================================
// Page Transition Component
// ========================================================================

/**
 * Wrapper for page transitions
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Page content
 * @param {string} props.animationType - Animation type (fade, slide, scale)
 * @param {string} props.className - CSS classes
 */
export const PageTransition = ({
  children,
  animationType = 'fade',
  className = '',
  ...props
}) => {
  const { shouldAnimate, getVariants } = useAnimation();

  const animations = {
    fade: ENTRY_ANIMATIONS.fadeIn,
    slideUp: ENTRY_ANIMATIONS.slideInUp,
    slideDown: ENTRY_ANIMATIONS.slideInDown,
    scale: ENTRY_ANIMATIONS.scaleIn,
    slideScale: ENTRY_ANIMATIONS.slideScaleIn,
  };

  const variants = getVariants(animations[animationType] || animations.fade);

  if (!shouldAnimate) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Modal Transition Component
// ========================================================================

/**
 * Modal with backdrop and content animations
 * @param {object} props - Component props
 * @param {boolean} props.isOpen - Open state
 * @param {function} props.onClose - Close callback
 * @param {React.ReactNode} props.children - Modal content
 * @param {string} props.className - CSS classes
 */
export const ModalTransition = ({
  isOpen = false,
  onClose,
  children,
  className = '',
  ...props
}) => {
  const { shouldAnimate, getVariants } = useAnimation();

  const backdropVariants = getVariants(MODAL_ANIMATIONS.backdrop);
  const contentVariants = getVariants(MODAL_ANIMATIONS.content);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={backdropVariants}
            onClick={onClose}
            className={cn(
              'fixed',
              'inset-0',
              'bg-black/50',
              'backdrop-blur-sm',
              'z-50'
            )}
          />

          {/* Modal Content */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial="initial"
              animate="animate"
              exit="exit"
              variants={contentVariants}
              className={cn(
                'bg-background-transparent-black-secondaryAlt',
                'border',
                'border-border-transparent',
                'f-effect-backdrop-blur-lg',
                'rounded-xl',
                'shadow-3d',
                'max-w-lg',
                'w-full',
                'p-6',
                className
              )}
              {...props}
            >
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

// ========================================================================
// Tab Transition Component
// ========================================================================

/**
 * Animated tab switching
 * @param {object} props - Component props
 * @param {array} props.tabs - Array of tab objects {id, label, content}
 * @param {string} props.activeTab - Active tab ID
 * @param {function} props.onTabChange - Tab change callback
 * @param {string} props.className - CSS classes
 */
export const TabTransition = ({
  tabs = [],
  activeTab,
  onTabChange,
  className = '',
}) => {
  const { shouldAnimate, getVariants } = useAnimation();

  const contentVariants = getVariants({
    initial: { opacity: 0, x: -20 },
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: TIMING.normal / 1000, ease: 'easeOut' },
    },
    exit: {
      opacity: 0,
      x: 20,
      transition: { duration: TIMING.fast / 1000, ease: 'easeIn' },
    },
  });

  const activeTabContent = tabs.find(tab => tab.id === activeTab);

  return (
    <div className={className}>
      {/* Tab Headers */}
      <div className="flex gap-2 border-b border-border-transparent mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-4',
              'py-2',
              'text-sm',
              'font-medium',
              'transition-colors',
              'relative',
              activeTab === tab.id
                ? 'text-text-light'
                : 'text-text-light/50 hover:text-text-light/80'
            )}
          >
            {tab.label}

            {/* Active Indicator */}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                transition={shouldAnimate ? SPRING.stiff : { duration: 0 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTabContent && (
          <motion.div
            key={activeTab}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={shouldAnimate ? contentVariants : {}}
          >
            {activeTabContent.content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ========================================================================
// Accordion Transition Component
// ========================================================================

/**
 * Accordion with smooth expand/collapse
 * @param {object} props - Component props
 * @param {string} props.title - Accordion title
 * @param {React.ReactNode} props.children - Accordion content
 * @param {boolean} props.defaultOpen - Default open state
 * @param {string} props.className - CSS classes
 */
export const AccordionTransition = ({
  title,
  children,
  defaultOpen = false,
  className = '',
  ...props
}) => {
  const { shouldAnimate, getVariants } = useAnimation();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const contentVariants = getVariants(COLLAPSE_ANIMATIONS.height);

  return (
    <div className={cn('border-b border-border-transparent', className)} {...props}>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full',
          'flex',
          'items-center',
          'justify-between',
          'py-4',
          'text-left',
          'text-text-light',
          'hover:text-text-light/80',
          'transition-colors'
        )}
      >
        <span className="font-medium">{title}</span>
        <motion.svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={shouldAnimate ? SPRING.default : { duration: 0 }}
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </button>

      {/* Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={shouldAnimate ? contentVariants : {}}
          >
            <div className="pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ========================================================================
// Crossfade Transition Component
// ========================================================================

/**
 * Crossfade between two states
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Content to crossfade
 * @param {string|number} props.transitionKey - Key to trigger transition
 * @param {string} props.className - CSS classes
 */
export const CrossfadeTransition = ({
  children,
  transitionKey,
  className = '',
  ...props
}) => {
  const { shouldAnimate, getDuration } = useAnimation();

  const variants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: getDuration(TIMING.normal) / 1000 },
    },
    exit: {
      opacity: 0,
      transition: { duration: getDuration(TIMING.fast) / 1000 },
    },
  };

  if (!shouldAnimate) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={transitionKey}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// ========================================================================
// Slide Transition Component
// ========================================================================

/**
 * Slide transition (useful for carousels, slideshows)
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Content to slide
 * @param {string} props.direction - Slide direction (left, right, up, down)
 * @param {string|number} props.transitionKey - Key to trigger transition
 * @param {string} props.className - CSS classes
 */
export const SlideTransition = ({
  children,
  direction = 'left',
  transitionKey,
  className = '',
  ...props
}) => {
  const { shouldAnimate, getDuration } = useAnimation();

  const directions = {
    left: { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '-100%' } },
    right: { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '100%' } },
    up: { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '-100%' } },
    down: { initial: { y: '-100%' }, animate: { y: 0 }, exit: { y: '100%' } },
  };

  const variants = directions[direction];

  const transition = {
    type: 'spring',
    stiffness: 300,
    damping: 30,
  };

  if (!shouldAnimate) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={transitionKey}
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={transition}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// ========================================================================
// Morphing Transition Component
// ========================================================================

/**
 * Morphing layout animation using Framer Motion's layoutId
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Content
 * @param {string} props.layoutId - Unique layout ID for morphing
 * @param {string} props.className - CSS classes
 */
export const MorphTransition = ({
  children,
  layoutId,
  className = '',
  ...props
}) => {
  const { shouldAnimate } = useAnimation();

  if (!shouldAnimate) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <motion.div
      layoutId={layoutId}
      layout
      transition={SPRING.default}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Collapse Transition Component
// ========================================================================

/**
 * Height-based collapse transition
 * @param {object} props - Component props
 * @param {boolean} props.isOpen - Open state
 * @param {React.ReactNode} props.children - Content to collapse
 * @param {string} props.className - CSS classes
 */
export const CollapseTransition = ({
  isOpen = true,
  children,
  className = '',
  ...props
}) => {
  const { shouldAnimate, getVariants } = useAnimation();

  const variants = getVariants(COLLAPSE_ANIMATIONS.height);

  if (!shouldAnimate) {
    return isOpen ? (
      <div className={className} {...props}>{children}</div>
    ) : null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial="collapsed"
          animate="expanded"
          exit="collapsed"
          variants={variants}
          className={className}
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ========================================================================
// Drawer Transition Component
// ========================================================================

/**
 * Side drawer transition
 * @param {object} props - Component props
 * @param {boolean} props.isOpen - Open state
 * @param {function} props.onClose - Close callback
 * @param {string} props.side - Drawer side (left, right, top, bottom)
 * @param {React.ReactNode} props.children - Drawer content
 * @param {string} props.className - CSS classes
 */
export const DrawerTransition = ({
  isOpen = false,
  onClose,
  side = 'right',
  children,
  className = '',
  ...props
}) => {
  const { shouldAnimate, getVariants } = useAnimation();

  const backdropVariants = getVariants(MODAL_ANIMATIONS.backdrop);

  const slideVariants = {
    left: {
      initial: { x: '-100%' },
      animate: { x: 0 },
      exit: { x: '-100%' },
    },
    right: {
      initial: { x: '100%' },
      animate: { x: 0 },
      exit: { x: '100%' },
    },
    top: {
      initial: { y: '-100%' },
      animate: { y: 0 },
      exit: { y: '-100%' },
    },
    bottom: {
      initial: { y: '100%' },
      animate: { y: 0 },
      exit: { y: '100%' },
    },
  };

  const contentVariants = getVariants({
    ...slideVariants[side],
    transition: SPRING.default,
  });

  const positions = {
    left: 'left-0 top-0 bottom-0',
    right: 'right-0 top-0 bottom-0',
    top: 'top-0 left-0 right-0',
    bottom: 'bottom-0 left-0 right-0',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={backdropVariants}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={contentVariants}
            className={cn(
              'fixed',
              'z-50',
              'bg-background-transparent-black-secondaryAlt',
              'border',
              'border-border-transparent',
              'f-effect-backdrop-blur-lg',
              'shadow-3d',
              positions[side],
              side === 'left' || side === 'right' ? 'w-80 max-w-[80vw]' : 'h-80 max-h-[80vh]',
              className
            )}
            {...props}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ========================================================================
// Fade Through Transition Component
// ========================================================================

/**
 * Fade through transition (fade out, change content, fade in)
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Content
 * @param {string|number} props.transitionKey - Key to trigger transition
 * @param {string} props.className - CSS classes
 */
export const FadeThroughTransition = ({
  children,
  transitionKey,
  className = '',
  ...props
}) => {
  const { shouldAnimate, getDuration } = useAnimation();

  const variants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: getDuration(TIMING.normal) / 1000,
        ease: 'easeOut',
      },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: getDuration(TIMING.fast) / 1000,
        ease: 'easeIn',
      },
    },
  };

  if (!shouldAnimate) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={transitionKey}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// ========================================================================
// Export All
// ========================================================================

export default {
  PageTransition,
  ModalTransition,
  TabTransition,
  AccordionTransition,
  CrossfadeTransition,
  SlideTransition,
  MorphTransition,
  CollapseTransition,
  DrawerTransition,
  FadeThroughTransition,
};
