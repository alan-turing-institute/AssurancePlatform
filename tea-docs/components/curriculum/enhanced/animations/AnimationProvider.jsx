/**
 * Animation Provider
 *
 * Global animation context provider with user preferences, performance monitoring,
 * and accessibility support (reduced motion).
 *
 * Features:
 * - User preference for reduced motion
 * - Animation speed controls (slow, normal, fast)
 * - Disable animations option
 * - FPS monitoring and performance optimization
 * - Global animation state management
 *
 * @component
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { TIMING, SPRING, PERFORMANCE } from './animationPresets';

// ========================================================================
// Context Creation
// ========================================================================

const AnimationContext = createContext(null);

// ========================================================================
// Constants
// ========================================================================

const ANIMATION_SPEEDS = {
  slow: 1.5,
  normal: 1,
  fast: 0.5,
};

const FPS_THRESHOLDS = {
  excellent: 55,
  good: 45,
  fair: 30,
  poor: 20,
};

const LOCAL_STORAGE_KEYS = {
  animationsEnabled: 'tea-animations-enabled',
  animationSpeed: 'tea-animation-speed',
  reducedMotion: 'tea-reduced-motion',
};

// ========================================================================
// Animation Provider Component
// ========================================================================

/**
 * AnimationProvider Component
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {boolean} props.enablePerformanceMonitoring - Enable FPS monitoring
 * @param {number} props.fpsTarget - Target FPS (default 60)
 * @param {function} props.onPerformanceChange - Callback when performance changes
 */
export const AnimationProvider = ({
  children,
  enablePerformanceMonitoring = false,
  fpsTarget = 60,
  onPerformanceChange,
}) => {
  // ========================================================================
  // State Management
  // ========================================================================

  // Animation preferences
  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.animationsEnabled);
    return stored !== null ? JSON.parse(stored) : true;
  });

  const [animationSpeed, setAnimationSpeed] = useState(() => {
    if (typeof window === 'undefined') return 'normal';
    return localStorage.getItem(LOCAL_STORAGE_KEYS.animationSpeed) || 'normal';
  });

  const [reducedMotionOverride, setReducedMotionOverride] = useState(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.reducedMotion);
    return stored !== null ? JSON.parse(stored) : null;
  });

  // System reduced motion preference
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Performance metrics
  const [fps, setFps] = useState(60);
  const [performanceScore, setPerformanceScore] = useState('excellent');
  const [frameDrops, setFrameDrops] = useState(0);

  // ========================================================================
  // Derived State
  // ========================================================================

  // Final reduced motion value (override or system preference)
  const reducedMotion = useMemo(() => {
    return reducedMotionOverride !== null ? reducedMotionOverride : systemReducedMotion;
  }, [reducedMotionOverride, systemReducedMotion]);

  // Speed multiplier
  const speedMultiplier = useMemo(() => {
    return ANIMATION_SPEEDS[animationSpeed] || 1;
  }, [animationSpeed]);

  // Should animations run
  const shouldAnimate = useMemo(() => {
    return animationsEnabled && !reducedMotion;
  }, [animationsEnabled, reducedMotion]);

  // ========================================================================
  // Performance Monitoring
  // ========================================================================

  useEffect(() => {
    if (!enablePerformanceMonitoring || typeof window === 'undefined') return;

    let frameCount = 0;
    let lastTime = performance.now();
    let lastFps = 60;
    let drops = 0;
    let animationFrameId;

    const measureFps = (currentTime) => {
      frameCount++;
      const deltaTime = currentTime - lastTime;

      // Update FPS every second
      if (deltaTime >= 1000) {
        const currentFps = Math.round((frameCount * 1000) / deltaTime);

        // Detect frame drops
        if (currentFps < lastFps - 10) {
          drops++;
          setFrameDrops(prev => prev + 1);
        }

        setFps(currentFps);
        lastFps = currentFps;

        // Calculate performance score
        let score;
        if (currentFps >= FPS_THRESHOLDS.excellent) {
          score = 'excellent';
        } else if (currentFps >= FPS_THRESHOLDS.good) {
          score = 'good';
        } else if (currentFps >= FPS_THRESHOLDS.fair) {
          score = 'fair';
        } else {
          score = 'poor';
        }

        setPerformanceScore(score);

        // Notify performance change
        if (onPerformanceChange) {
          onPerformanceChange({
            fps: currentFps,
            score,
            drops,
            targetFps: fpsTarget,
          });
        }

        frameCount = 0;
        lastTime = currentTime;
      }

      animationFrameId = requestAnimationFrame(measureFps);
    };

    animationFrameId = requestAnimationFrame(measureFps);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [enablePerformanceMonitoring, fpsTarget, onPerformanceChange]);

  // ========================================================================
  // System Preference Detection
  // ========================================================================

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (e) => {
      setSystemReducedMotion(e.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // ========================================================================
  // Preference Persistence
  // ========================================================================

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LOCAL_STORAGE_KEYS.animationsEnabled, JSON.stringify(animationsEnabled));
  }, [animationsEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LOCAL_STORAGE_KEYS.animationSpeed, animationSpeed);
  }, [animationSpeed]);

  useEffect(() => {
    if (typeof window === 'undefined' || reducedMotionOverride === null) return;
    localStorage.setItem(LOCAL_STORAGE_KEYS.reducedMotion, JSON.stringify(reducedMotionOverride));
  }, [reducedMotionOverride]);

  // ========================================================================
  // Animation Utilities
  // ========================================================================

  /**
   * Get animation duration adjusted for speed
   * @param {number} duration - Base duration in ms
   * @returns {number} Adjusted duration
   */
  const getDuration = useCallback((duration) => {
    if (!shouldAnimate) return 1; // Almost instant
    return duration / speedMultiplier;
  }, [shouldAnimate, speedMultiplier]);

  /**
   * Get spring configuration adjusted for speed
   * @param {object} spring - Spring config
   * @returns {object} Adjusted spring config
   */
  const getSpring = useCallback((spring) => {
    if (!shouldAnimate) {
      return {
        type: 'tween',
        duration: 0.01,
      };
    }

    return {
      ...spring,
      damping: spring.damping * speedMultiplier,
      mass: spring.mass / speedMultiplier,
    };
  }, [shouldAnimate, speedMultiplier]);

  /**
   * Get animation variants adjusted for preferences
   * @param {object} variants - Animation variants
   * @returns {object} Adjusted variants
   */
  const getVariants = useCallback((variants) => {
    if (!shouldAnimate) {
      // Return minimal animation
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.01 },
      };
    }

    // Adjust transition duration if present
    if (variants.transition) {
      const adjustedTransition = { ...variants.transition };

      if (adjustedTransition.duration) {
        adjustedTransition.duration = adjustedTransition.duration / speedMultiplier;
      }

      if (adjustedTransition.type === 'spring') {
        adjustedTransition.damping = (adjustedTransition.damping || 30) * speedMultiplier;
        adjustedTransition.mass = (adjustedTransition.mass || 1) / speedMultiplier;
      }

      return {
        ...variants,
        transition: adjustedTransition,
      };
    }

    return variants;
  }, [shouldAnimate, speedMultiplier]);

  /**
   * Check if animations should run
   * @returns {boolean} Should animate
   */
  const canAnimate = useCallback(() => {
    return shouldAnimate;
  }, [shouldAnimate]);

  /**
   * Get GPU acceleration hints
   * @returns {object} CSS properties for GPU acceleration
   */
  const getGpuAcceleration = useCallback(() => {
    return PERFORMANCE.gpuOnly;
  }, []);

  // ========================================================================
  // Control Methods
  // ========================================================================

  /**
   * Toggle animations on/off
   */
  const toggleAnimations = useCallback(() => {
    setAnimationsEnabled(prev => !prev);
  }, []);

  /**
   * Set animation speed
   * @param {string} speed - Speed setting (slow, normal, fast)
   */
  const setSpeed = useCallback((speed) => {
    if (ANIMATION_SPEEDS[speed] !== undefined) {
      setAnimationSpeed(speed);
    }
  }, []);

  /**
   * Set reduced motion override
   * @param {boolean|null} value - Override value (null to use system preference)
   */
  const setReducedMotion = useCallback((value) => {
    setReducedMotionOverride(value);
  }, []);

  /**
   * Reset all preferences to defaults
   */
  const resetPreferences = useCallback(() => {
    setAnimationsEnabled(true);
    setAnimationSpeed('normal');
    setReducedMotionOverride(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.animationsEnabled);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.animationSpeed);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.reducedMotion);
    }
  }, []);

  // ========================================================================
  // Context Value
  // ========================================================================

  const contextValue = useMemo(() => ({
    // Preferences
    animationsEnabled,
    animationSpeed,
    reducedMotion,
    systemReducedMotion,
    reducedMotionOverride,
    speedMultiplier,
    shouldAnimate,

    // Performance
    fps,
    performanceScore,
    frameDrops,
    fpsTarget,

    // Utilities
    getDuration,
    getSpring,
    getVariants,
    canAnimate,
    getGpuAcceleration,

    // Controls
    toggleAnimations,
    setSpeed,
    setReducedMotion,
    resetPreferences,
    setAnimationsEnabled,
  }), [
    animationsEnabled,
    animationSpeed,
    reducedMotion,
    systemReducedMotion,
    reducedMotionOverride,
    speedMultiplier,
    shouldAnimate,
    fps,
    performanceScore,
    frameDrops,
    fpsTarget,
    getDuration,
    getSpring,
    getVariants,
    canAnimate,
    getGpuAcceleration,
    toggleAnimations,
    setSpeed,
    setReducedMotion,
    resetPreferences,
  ]);

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <AnimationContext.Provider value={contextValue}>
      {children}
    </AnimationContext.Provider>
  );
};

// ========================================================================
// Hook
// ========================================================================

/**
 * Use animation context
 * @returns {object} Animation context
 * @throws {Error} If used outside AnimationProvider
 */
export const useAnimation = () => {
  const context = useContext(AnimationContext);

  if (!context) {
    throw new Error('useAnimation must be used within AnimationProvider');
  }

  return context;
};

// ========================================================================
// Performance Hook
// ========================================================================

/**
 * Use animation performance metrics
 * @returns {object} Performance metrics
 */
export const useAnimationPerformance = () => {
  const { fps, performanceScore, frameDrops, fpsTarget } = useAnimation();

  return {
    fps,
    performanceScore,
    frameDrops,
    fpsTarget,
    isPerformant: performanceScore === 'excellent' || performanceScore === 'good',
    needsOptimization: performanceScore === 'poor',
  };
};

// ========================================================================
// Preferences Hook
// ========================================================================

/**
 * Use animation preferences
 * @returns {object} Animation preferences
 */
export const useAnimationPreferences = () => {
  const {
    animationsEnabled,
    animationSpeed,
    reducedMotion,
    systemReducedMotion,
    shouldAnimate,
    toggleAnimations,
    setSpeed,
    setReducedMotion,
    resetPreferences,
    setAnimationsEnabled,
  } = useAnimation();

  return {
    animationsEnabled,
    animationSpeed,
    reducedMotion,
    systemReducedMotion,
    shouldAnimate,
    toggleAnimations,
    setSpeed,
    setReducedMotion,
    resetPreferences,
    setAnimationsEnabled,
  };
};

// ========================================================================
// Export
// ========================================================================

export default AnimationProvider;
