/**
 * Spring Animations Component
 *
 * Advanced spring-based animations using Framer Motion with support for:
 * - Spring physics for natural motion
 * - Stagger effects for multiple elements
 * - Chain animations for sequences
 * - Gesture-based animations (drag, pan, rotate)
 * - Scroll-triggered animations
 * - Parallax effects
 *
 * @component
 */

import React, { useRef, useEffect } from 'react';
import { motion, useSpring, useTransform, useScroll, useMotionValue, useVelocity, useAnimationFrame } from 'framer-motion';
import { useAnimation } from './AnimationProvider';
import { SPRING, STAGGER_ANIMATIONS } from './animationPresets';

// ========================================================================
// Spring Container Component
// ========================================================================

/**
 * Container with stagger animation for children
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child elements
 * @param {object} props.stagger - Stagger configuration
 * @param {string} props.staggerType - Stagger type (fast, normal, slow)
 * @param {string} props.className - CSS classes
 */
export const SpringStaggerContainer = ({
  children,
  stagger = STAGGER_ANIMATIONS.normal,
  staggerType = 'normal',
  className = '',
  ...props
}) => {
  const { getVariants, shouldAnimate } = useAnimation();

  const staggerConfig = STAGGER_ANIMATIONS[staggerType] || stagger;

  const variants = getVariants({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: staggerConfig,
    },
  });

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
// Spring Item Component (for use with SpringStaggerContainer)
// ========================================================================

/**
 * Individual item in stagger animation
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {string} props.className - CSS classes
 */
export const SpringStaggerItem = ({
  children,
  className = '',
  ...props
}) => {
  const { getVariants, shouldAnimate } = useAnimation();

  const variants = getVariants({
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: SPRING.default,
    },
  });

  if (!shouldAnimate) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <motion.div
      variants={variants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Spring Scale Component
// ========================================================================

/**
 * Component with spring-based scale animation
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {number} props.scale - Target scale value
 * @param {object} props.spring - Spring configuration
 * @param {string} props.className - CSS classes
 */
export const SpringScale = ({
  children,
  scale = 1,
  spring = SPRING.default,
  className = '',
  ...props
}) => {
  const { getSpring, shouldAnimate } = useAnimation();

  const scaleValue = useSpring(shouldAnimate ? scale : 1, getSpring(spring));

  return (
    <motion.div
      style={{ scale: scaleValue }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Spring Rotate Component
// ========================================================================

/**
 * Component with spring-based rotation animation
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {number} props.rotation - Target rotation in degrees
 * @param {object} props.spring - Spring configuration
 * @param {string} props.className - CSS classes
 */
export const SpringRotate = ({
  children,
  rotation = 0,
  spring = SPRING.default,
  className = '',
  ...props
}) => {
  const { getSpring, shouldAnimate } = useAnimation();

  const rotateValue = useSpring(shouldAnimate ? rotation : 0, getSpring(spring));

  return (
    <motion.div
      style={{ rotate: rotateValue }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Draggable Spring Component
// ========================================================================

/**
 * Draggable component with spring physics
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {object} props.constraints - Drag constraints
 * @param {function} props.onDragEnd - Drag end callback
 * @param {string} props.className - CSS classes
 */
export const SpringDraggable = ({
  children,
  constraints = { left: 0, right: 0, top: 0, bottom: 0 },
  onDragEnd,
  elastic = 0.2,
  className = '',
  ...props
}) => {
  const { shouldAnimate, getSpring } = useAnimation();

  if (!shouldAnimate) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <motion.div
      drag
      dragConstraints={constraints}
      dragElastic={elastic}
      dragTransition={getSpring(SPRING.bouncy)}
      onDragEnd={onDragEnd}
      className={className}
      whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Scroll-Triggered Spring Component
// ========================================================================

/**
 * Component that animates based on scroll position
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {number} props.offset - Scroll offset to trigger animation
 * @param {string} props.className - CSS classes
 */
export const SpringScrollTrigger = ({
  children,
  offset = 100,
  className = '',
  ...props
}) => {
  const { shouldAnimate } = useAnimation();
  const ref = useRef(null);
  const { scrollY } = useScroll();
  const [isInView, setIsInView] = React.useState(false);

  useEffect(() => {
    if (!shouldAnimate || !ref.current) return;

    const handleScroll = () => {
      const element = ref.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const inView = rect.top < window.innerHeight - offset;

      setIsInView(inView);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [offset, shouldAnimate]);

  if (!shouldAnimate) {
    return <div ref={ref} className={className} {...props}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={SPRING.default}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Parallax Component
// ========================================================================

/**
 * Parallax effect component
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {number} props.speed - Parallax speed multiplier
 * @param {string} props.className - CSS classes
 */
export const SpringParallax = ({
  children,
  speed = 0.5,
  className = '',
  ...props
}) => {
  const { shouldAnimate } = useAnimation();
  const ref = useRef(null);
  const { scrollY } = useScroll();

  const y = useTransform(scrollY, (value) => {
    if (!shouldAnimate || !ref.current) return 0;

    const element = ref.current;
    const rect = element.getBoundingClientRect();
    const elementTop = rect.top + value;
    const windowHeight = window.innerHeight;

    // Calculate parallax offset
    const scrollProgress = (value - elementTop + windowHeight) / (windowHeight + rect.height);
    return scrollProgress * speed * 100;
  });

  if (!shouldAnimate) {
    return <div ref={ref} className={className} {...props}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      style={{ y }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Velocity-Based Spring Component
// ========================================================================

/**
 * Component that reacts to velocity (useful for scroll effects)
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {function} props.transformVelocity - Transform velocity to visual property
 * @param {string} props.className - CSS classes
 */
export const SpringVelocity = ({
  children,
  transformVelocity = (v) => v / 10,
  className = '',
  ...props
}) => {
  const { shouldAnimate } = useAnimation();
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const skewX = useTransform(scrollVelocity, transformVelocity);

  if (!shouldAnimate) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <motion.div
      style={{ skewX }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Chain Animation Component
// ========================================================================

/**
 * Component that chains multiple animations in sequence
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {array} props.sequence - Array of animation steps
 * @param {string} props.className - CSS classes
 */
export const SpringChain = ({
  children,
  sequence = [],
  className = '',
  ...props
}) => {
  const { shouldAnimate } = useAnimation();
  const controls = motion.useAnimationControls();

  useEffect(() => {
    if (!shouldAnimate || sequence.length === 0) return;

    const runSequence = async () => {
      for (const step of sequence) {
        await controls.start(step);
      }
    };

    runSequence();
  }, [sequence, shouldAnimate, controls]);

  if (!shouldAnimate) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <motion.div
      animate={controls}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Gesture Spring Component
// ========================================================================

/**
 * Component with gesture-based spring animations
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {boolean} props.enableHover - Enable hover gesture
 * @param {boolean} props.enableTap - Enable tap gesture
 * @param {boolean} props.enableDrag - Enable drag gesture
 * @param {string} props.className - CSS classes
 */
export const SpringGesture = ({
  children,
  enableHover = true,
  enableTap = true,
  enableDrag = false,
  hoverScale = 1.05,
  tapScale = 0.95,
  className = '',
  ...props
}) => {
  const { shouldAnimate, getSpring } = useAnimation();

  const gestureProps = {};

  if (shouldAnimate) {
    if (enableHover) {
      gestureProps.whileHover = { scale: hoverScale };
    }
    if (enableTap) {
      gestureProps.whileTap = { scale: tapScale };
    }
    if (enableDrag) {
      gestureProps.drag = true;
      gestureProps.dragTransition = getSpring(SPRING.bouncy);
    }
  }

  return (
    <motion.div
      className={className}
      transition={getSpring(SPRING.default)}
      {...gestureProps}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Magnetic Spring Component
// ========================================================================

/**
 * Component with magnetic attraction effect (follows cursor)
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {number} props.strength - Attraction strength
 * @param {string} props.className - CSS classes
 */
export const SpringMagnetic = ({
  children,
  strength = 0.3,
  className = '',
  ...props
}) => {
  const { shouldAnimate, getSpring } = useAnimation();
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, getSpring(SPRING.stiff));
  const springY = useSpring(y, getSpring(SPRING.stiff));

  const handleMouseMove = (event) => {
    if (!shouldAnimate || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = (event.clientX - centerX) * strength;
    const deltaY = (event.clientY - centerY) * strength;

    x.set(deltaX);
    y.set(deltaY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  if (!shouldAnimate) {
    return <div ref={ref} className={className} {...props}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Inertial Spring Component
// ========================================================================

/**
 * Component that continues motion with inertia after interaction
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {number} props.power - Inertia power
 * @param {string} props.className - CSS classes
 */
export const SpringInertia = ({
  children,
  power = 0.2,
  className = '',
  ...props
}) => {
  const { shouldAnimate, getSpring } = useAnimation();
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  if (!shouldAnimate) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <motion.div
      drag
      dragElastic={power}
      dragMomentum={true}
      dragTransition={getSpring(SPRING.bouncy)}
      style={{ x, y }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Keyframe Spring Component
// ========================================================================

/**
 * Component with keyframe-based spring animation
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child content
 * @param {array} props.keyframes - Array of keyframe values
 * @param {string} props.property - Property to animate
 * @param {string} props.className - CSS classes
 */
export const SpringKeyframes = ({
  children,
  keyframes = [0, 1],
  property = 'scale',
  duration = 1,
  repeat = 0,
  className = '',
  ...props
}) => {
  const { shouldAnimate } = useAnimation();

  if (!shouldAnimate) {
    return <div className={className} {...props}>{children}</div>;
  }

  const animateProps = {
    [property]: keyframes,
  };

  return (
    <motion.div
      animate={animateProps}
      transition={{
        duration,
        repeat,
        ease: 'easeInOut',
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ========================================================================
// Export All
// ========================================================================

export default {
  SpringStaggerContainer,
  SpringStaggerItem,
  SpringScale,
  SpringRotate,
  SpringDraggable,
  SpringScrollTrigger,
  SpringParallax,
  SpringVelocity,
  SpringChain,
  SpringGesture,
  SpringMagnetic,
  SpringInertia,
  SpringKeyframes,
};
