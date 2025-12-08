/**
 * Animated Handle Component
 *
 * Advanced handle with continuous animations, glow effects, ripples,
 * and spring physics. Provides enhanced visual feedback for user interactions.
 *
 * @component
 * @example
 * <AnimatedHandle
 *   type="source"
 *   position={Position.Bottom}
 *   nodeId="node-1"
 *   animationType="pulse"
 *   glowIntensity="high"
 * />
 */

import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { Plus, Sparkles, Zap } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';
import { cn } from '../../../../lib/utils';
import {
  getPositionClasses,
  getHandleSizeClasses,
  getGradientClasses,
} from './handleUtils';

/**
 * AnimatedHandle component with enhanced animations
 * @param {object} props - Component props
 * @param {string} props.type - Handle type ('source' or 'target')
 * @param {string} props.position - Handle position
 * @param {string} props.nodeId - Node identifier
 * @param {string} props.id - Handle identifier
 * @param {boolean} props.isConnectable - Whether handle is connectable
 * @param {string} props.animationType - Animation type ('pulse', 'glow', 'ripple', 'spring', 'breathe')
 * @param {string} props.glowIntensity - Glow intensity ('low', 'medium', 'high')
 * @param {string} props.colorTheme - Color theme ('blue', 'green', 'purple', 'orange', 'cyan')
 * @param {boolean} props.showParticles - Show particle effects
 * @param {boolean} props.continuousAnimation - Enable continuous animation
 * @param {string} props.className - Additional CSS classes
 * @returns {React.Element} AnimatedHandle component
 */
const AnimatedHandle = ({
  type,
  position,
  nodeId,
  id,
  isConnectable = true,
  animationType = 'pulse',
  glowIntensity = 'medium',
  colorTheme = 'blue',
  showParticles = false,
  continuousAnimation = true,
  className = '',
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showRipple, setShowRipple] = useState(false);
  const controls = useAnimation();

  // Trigger ripple effect on connection
  useEffect(() => {
    if (isConnecting) {
      setShowRipple(true);
      setTimeout(() => setShowRipple(false), 1000);
    }
  }, [isConnecting]);

  // Spring animation on hover
  useEffect(() => {
    if (isHovered && animationType === 'spring') {
      controls.start({
        scale: [1, 1.2, 0.95, 1.05, 1],
        transition: {
          duration: 0.6,
          ease: 'easeInOut',
        },
      });
    }
  }, [isHovered, animationType, controls]);

  // Get styling
  const positionClass = getPositionClasses(position);
  const sizeClasses = getHandleSizeClasses('medium');
  const gradientClass = getGradientClasses(colorTheme);

  // Color theme configurations
  const colorThemes = {
    blue: {
      base: 'from-blue-400 to-blue-600',
      glow: 'shadow-blue-500/50',
      border: 'border-blue-400',
      ring: 'ring-blue-500/50',
    },
    green: {
      base: 'from-green-400 to-green-600',
      glow: 'shadow-green-500/50',
      border: 'border-green-400',
      ring: 'ring-green-500/50',
    },
    purple: {
      base: 'from-purple-400 to-purple-600',
      glow: 'shadow-purple-500/50',
      border: 'border-purple-400',
      ring: 'ring-purple-500/50',
    },
    orange: {
      base: 'from-orange-400 to-orange-600',
      glow: 'shadow-orange-500/50',
      border: 'border-orange-400',
      ring: 'ring-orange-500/50',
    },
    cyan: {
      base: 'from-cyan-400 to-cyan-600',
      glow: 'shadow-cyan-500/50',
      border: 'border-cyan-400',
      ring: 'ring-cyan-500/50',
    },
  };

  const colors = colorThemes[colorTheme] || colorThemes.blue;

  // Glow intensity configurations
  const glowIntensities = {
    low: 'shadow-md',
    medium: 'shadow-lg shadow-current',
    high: 'shadow-2xl shadow-current',
  };

  const glowClass = glowIntensities[glowIntensity] || glowIntensities.medium;

  // Animation variants
  const pulseAnimation = {
    scale: [1, 1.1, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  };

  const glowAnimation = {
    boxShadow: [
      '0 0 10px rgba(59, 130, 246, 0.5)',
      '0 0 30px rgba(59, 130, 246, 0.8)',
      '0 0 10px rgba(59, 130, 246, 0.5)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  };

  const breatheAnimation = {
    scale: [1, 1.05, 1],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  };

  const rippleAnimation = {
    scale: [1, 2],
    opacity: [0.8, 0],
    transition: {
      duration: 1,
      ease: 'easeOut',
    },
  };

  // Select animation based on type
  const getAnimation = () => {
    if (!continuousAnimation && !isHovered) return {};

    switch (animationType) {
      case 'pulse':
        return pulseAnimation;
      case 'glow':
        return glowAnimation;
      case 'breathe':
        return breatheAnimation;
      case 'spring':
        return {}; // Handled by controls
      default:
        return pulseAnimation;
    }
  };

  return (
    <Handle
      type={type}
      position={position}
      id={id}
      isConnectable={isConnectable}
      {...props}
      className={cn(
        '!bg-transparent',
        '!border-0',
        sizeClasses.outer,
        'flex items-center justify-center',
        positionClass,
        'group/handle',
        'cursor-pointer',
        'z-10',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsConnecting(true)}
      onMouseUp={() => setIsConnecting(false)}
    >
      {/* Main animated decorator */}
      <motion.div
        className="pointer-events-none relative"
        animate={animationType === 'spring' ? controls : getAnimation()}
        whileHover={{
          scale: 1.15,
          transition: { duration: 0.2 },
        }}
      >
        {/* Primary handle button with gradient */}
        <div
          className={cn(
            sizeClasses.inner,
            'rounded-full',
            'bg-gradient-to-br',
            colors.base,
            'border-2',
            colors.border,
            'flex items-center justify-center',
            glowClass,
            'transition-all duration-300',
            isHovered && 'border-white',
            isHovered && 'ring-2',
            isHovered && colors.ring
          )}
        >
          {/* Icon with sparkle effect on hover */}
          <motion.div
            animate={
              isHovered && showParticles
                ? {
                    rotate: [0, 10, -10, 0],
                    transition: {
                      duration: 0.5,
                      repeat: Infinity,
                    },
                  }
                : {}
            }
          >
            {showParticles ? (
              <Sparkles
                className={cn(sizeClasses.icon, 'text-white')}
                strokeWidth={2.5}
              />
            ) : (
              <Plus
                className={cn(sizeClasses.icon, 'text-white')}
                strokeWidth={2.5}
              />
            )}
          </motion.div>
        </div>

        {/* Outer glow ring */}
        {animationType === 'glow' && continuousAnimation && (
          <motion.div
            className={cn(
              'absolute inset-0 rounded-full',
              'border-2',
              colors.border,
              'opacity-50'
            )}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        {/* Ripple effect on connection */}
        {showRipple && (
          <>
            <motion.div
              className={cn(
                'absolute inset-0 rounded-full',
                'border-2',
                colors.border
              )}
              initial={{ scale: 1, opacity: 0.8 }}
              animate={rippleAnimation}
            />
            <motion.div
              className={cn(
                'absolute inset-0 rounded-full',
                'border-2',
                colors.border
              )}
              initial={{ scale: 1, opacity: 0.6 }}
              animate={rippleAnimation}
              transition={{ delay: 0.1 }}
            />
            <motion.div
              className={cn(
                'absolute inset-0 rounded-full',
                'border-2',
                colors.border
              )}
              initial={{ scale: 1, opacity: 0.4 }}
              animate={rippleAnimation}
              transition={{ delay: 0.2 }}
            />
          </>
        )}

        {/* Particle effects */}
        {showParticles && isHovered && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className={cn(
                  'absolute w-1 h-1 rounded-full',
                  'bg-white'
                )}
                initial={{
                  x: 0,
                  y: 0,
                  opacity: 1,
                }}
                animate={{
                  x: Math.cos((i * Math.PI * 2) / 6) * 20,
                  y: Math.sin((i * Math.PI * 2) / 6) * 20,
                  opacity: 0,
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
              />
            ))}
          </>
        )}

        {/* Drag preview with spring animation */}
        {isConnecting && (
          <motion.div
            className={cn(
              'absolute inset-0 rounded-full',
              'bg-white/20',
              'border-2 border-white'
            )}
            initial={{ scale: 1 }}
            animate={{
              scale: [1, 1.3, 1.1],
            }}
            transition={{
              duration: 0.4,
              ease: 'easeOut',
            }}
          />
        )}
      </motion.div>

      {/* Pulsing availability indicator */}
      {continuousAnimation && animationType === 'pulse' && (
        <motion.div
          className={cn(
            'absolute inset-0 rounded-full',
            'border-2',
            colors.border,
            'pointer-events-none'
          )}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Lightning effect for 'zap' style */}
      {isHovered && animationType === 'spring' && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.5 }}
        >
          <Zap
            className={cn(
              'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'w-6 h-6 text-yellow-300'
            )}
          />
        </motion.div>
      )}
    </Handle>
  );
};

/**
 * Preset: Pulse Handle
 */
export const PulseHandle = (props) => (
  <AnimatedHandle {...props} animationType="pulse" />
);

/**
 * Preset: Glow Handle
 */
export const GlowHandle = (props) => (
  <AnimatedHandle {...props} animationType="glow" glowIntensity="high" />
);

/**
 * Preset: Spring Handle
 */
export const SpringHandle = (props) => (
  <AnimatedHandle {...props} animationType="spring" />
);

/**
 * Preset: Breathe Handle
 */
export const BreatheHandle = (props) => (
  <AnimatedHandle {...props} animationType="breathe" />
);

/**
 * Preset: Particle Handle
 */
export const ParticleHandle = (props) => (
  <AnimatedHandle
    {...props}
    animationType="pulse"
    showParticles={true}
    glowIntensity="high"
  />
);

export default AnimatedHandle;
