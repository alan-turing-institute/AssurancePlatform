/**
 * Animation System Demo
 *
 * Comprehensive demonstration of all animation components and capabilities.
 * Shows off spring animations, loading states, micro-interactions, and transitions.
 *
 * @component
 */

import React, { useState } from 'react';
import { cn } from '../../../../lib/utils';
import { Play, Pause, RotateCcw, Settings, Check, X, Info, Heart } from 'lucide-react';

// Import animation components
import { AnimationProvider, useAnimation } from './AnimationProvider';
import {
  SpringStaggerContainer,
  SpringStaggerItem,
  SpringScale,
  SpringRotate,
  SpringDraggable,
  SpringGesture,
  SpringMagnetic,
} from './SpringAnimations';
import {
  Skeleton,
  NodeSkeleton,
  Spinner,
  DotsLoader,
  ProgressBar,
  CircularProgress,
  PulseLoader,
  ShimmerContainer,
  ContentReveal,
} from './LoadingStates';
import {
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
} from './MicroInteractions';
import {
  TabTransition,
  AccordionTransition,
  CrossfadeTransition,
  ModalTransition,
  DrawerTransition,
} from './TransitionEffects';

// ========================================================================
// Demo Section Component
// ========================================================================

const DemoSection = ({ title, description, children }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-semibold text-text-light">{title}</h3>
      {description && (
        <p className="text-sm text-text-light/60 mt-1">{description}</p>
      )}
    </div>
    <div className="p-6 bg-background-transparent-black border border-border-transparent rounded-xl">
      {children}
    </div>
  </div>
);

// ========================================================================
// Animation Controls Component
// ========================================================================

const AnimationControls = () => {
  const {
    animationsEnabled,
    animationSpeed,
    reducedMotion,
    fps,
    performanceScore,
    toggleAnimations,
    setSpeed,
    setReducedMotion,
  } = useAnimation();

  return (
    <div className="p-6 bg-background-transparent-black border border-border-transparent rounded-xl space-y-4">
      <h3 className="text-lg font-semibold text-text-light">Animation Controls</h3>

      {/* Enable/Disable Animations */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-light">Animations Enabled</span>
        <button
          onClick={toggleAnimations}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            animationsEnabled
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-text-light'
          )}
        >
          {animationsEnabled ? 'On' : 'Off'}
        </button>
      </div>

      {/* Animation Speed */}
      <div className="space-y-2">
        <span className="text-sm text-text-light">Animation Speed</span>
        <div className="flex gap-2">
          {['slow', 'normal', 'fast'].map((speed) => (
            <button
              key={speed}
              onClick={() => setSpeed(speed)}
              className={cn(
                'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                animationSpeed === speed
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-text-light hover:bg-gray-600'
              )}
            >
              {speed.charAt(0).toUpperCase() + speed.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Reduced Motion */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-light">Reduced Motion</span>
        <button
          onClick={() => setReducedMotion(!reducedMotion)}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            reducedMotion
              ? 'bg-orange-600 text-white'
              : 'bg-gray-700 text-text-light'
          )}
        >
          {reducedMotion ? 'On' : 'Off'}
        </button>
      </div>

      {/* Performance Metrics */}
      <div className="pt-4 border-t border-border-transparent space-y-2">
        <span className="text-sm text-text-light font-medium">Performance</span>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-light/60">FPS</span>
          <span className="text-text-light font-mono">{fps}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-light/60">Score</span>
          <span
            className={cn(
              'font-medium',
              performanceScore === 'excellent' && 'text-green-400',
              performanceScore === 'good' && 'text-blue-400',
              performanceScore === 'fair' && 'text-yellow-400',
              performanceScore === 'poor' && 'text-red-400'
            )}
          >
            {performanceScore}
          </span>
        </div>
      </div>
    </div>
  );
};

// ========================================================================
// Spring Animations Demo
// ========================================================================

const SpringAnimationsDemo = () => {
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

  return (
    <DemoSection
      title="Spring Animations"
      description="Physics-based animations with natural motion"
    >
      <div className="space-y-6">
        {/* Stagger Animation */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Stagger Effect</h4>
          <SpringStaggerContainer className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <SpringStaggerItem
                key={i}
                className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold"
              >
                {i}
              </SpringStaggerItem>
            ))}
          </SpringStaggerContainer>
        </div>

        {/* Gesture Animations */}
        <div className="grid grid-cols-3 gap-4">
          <SpringGesture className="p-4 bg-purple-600 rounded-lg text-center text-white">
            Hover Me
          </SpringGesture>
          <SpringScale scale={1.5} className="p-4 bg-green-600 rounded-lg text-center text-white">
            Scaled
          </SpringScale>
          <SpringRotate rotation={45} className="p-4 bg-orange-600 rounded-lg text-center text-white">
            Rotated
          </SpringRotate>
        </div>

        {/* Draggable */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Draggable (with spring return)</h4>
          <div className="h-32 border-2 border-dashed border-border-transparent rounded-lg relative">
            <SpringDraggable
              constraints={{ left: -100, right: 100, top: -50, bottom: 50 }}
              className="absolute top-1/2 left-1/2 w-20 h-20 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold cursor-grab active:cursor-grabbing"
            >
              Drag
            </SpringDraggable>
          </div>
        </div>

        {/* Magnetic */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Magnetic Effect</h4>
          <SpringMagnetic
            strength={0.5}
            className="inline-block p-6 bg-pink-600 rounded-lg text-white font-bold"
          >
            Follow Me
          </SpringMagnetic>
        </div>
      </div>
    </DemoSection>
  );
};

// ========================================================================
// Loading States Demo
// ========================================================================

const LoadingStatesDemo = () => {
  const [progress, setProgress] = useState(45);
  const [isLoading, setIsLoading] = useState(true);

  return (
    <DemoSection
      title="Loading States"
      description="Skeleton loaders, spinners, and progress indicators"
    >
      <div className="space-y-6">
        {/* Spinners */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Spinners</h4>
          <div className="flex gap-6 items-center">
            <Spinner size={24} />
            <Spinner size={32} />
            <Spinner size={48} />
            <DotsLoader />
            <PulseLoader />
          </div>
        </div>

        {/* Progress Bars */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Progress Indicators</h4>
          <div className="space-y-4">
            <ProgressBar progress={progress} showLabel />
            <CircularProgress progress={progress} showLabel />
            <div className="flex gap-2">
              <button
                onClick={() => setProgress(Math.max(0, progress - 10))}
                className="px-3 py-1 bg-gray-700 rounded text-sm"
              >
                -10%
              </button>
              <button
                onClick={() => setProgress(Math.min(100, progress + 10))}
                className="px-3 py-1 bg-gray-700 rounded text-sm"
              >
                +10%
              </button>
            </div>
          </div>
        </div>

        {/* Skeleton Loaders */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Skeleton Loaders</h4>
          <div className="space-y-3">
            <Skeleton variant="title" />
            <Skeleton variant="text" count={3} />
            <div className="flex gap-3">
              <Skeleton variant="avatar" />
              <Skeleton variant="button" />
            </div>
          </div>
        </div>

        {/* Node Skeleton */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Node Skeleton</h4>
          <div className="flex gap-4">
            <NodeSkeleton />
            <NodeSkeleton expanded />
          </div>
        </div>

        {/* Shimmer Container */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Shimmer Effect</h4>
          <ShimmerContainer isLoading={isLoading}>
            <div className="p-4 bg-gray-800 rounded-lg">
              <p className="text-text-light">Content with shimmer overlay</p>
            </div>
          </ShimmerContainer>
          <button
            onClick={() => setIsLoading(!isLoading)}
            className="mt-2 px-3 py-1 bg-gray-700 rounded text-sm"
          >
            Toggle Loading
          </button>
        </div>

        {/* Content Reveal */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Content Reveal</h4>
          <ContentReveal isLoading={false}>
            <div className="p-4 bg-gray-800 rounded-lg">
              <p className="text-text-light">Content revealed with animation</p>
            </div>
          </ContentReveal>
        </div>
      </div>
    </DemoSection>
  );
};

// ========================================================================
// Micro Interactions Demo
// ========================================================================

const MicroInteractionsDemo = () => {
  const [count, setCount] = useState(42);
  const [shakeKey, setShakeKey] = useState(0);
  const [wiggleKey, setWiggleKey] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState('success');
  const [checkVisible, setCheckVisible] = useState(false);

  return (
    <DemoSection
      title="Micro Interactions"
      description="Delightful UI feedback animations"
    >
      <div className="space-y-6">
        {/* Interactive Buttons */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Interactive Buttons</h4>
          <div className="flex gap-2">
            <InteractiveButton variant="primary">Primary</InteractiveButton>
            <InteractiveButton variant="secondary">Secondary</InteractiveButton>
            <InteractiveButton variant="ghost">Ghost</InteractiveButton>
            <InteractiveButton variant="success">Success</InteractiveButton>
            <InteractiveButton variant="danger">Danger</InteractiveButton>
          </div>
        </div>

        {/* Ripple Effect */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Ripple Effect</h4>
          <RippleEffect className="inline-block p-4 bg-blue-600 rounded-lg text-white cursor-pointer">
            Click for Ripple
          </RippleEffect>
        </div>

        {/* Focus Ring */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Animated Focus Ring</h4>
          <input
            type="text"
            placeholder="Focus me"
            className="px-4 py-2 bg-gray-800 rounded-lg text-text-light focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Feedback Toast */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Feedback Toasts</h4>
          <div className="flex gap-2 mb-4">
            {['success', 'error', 'warning', 'info'].map((type) => (
              <button
                key={type}
                onClick={() => {
                  setToastType(type);
                  setToastVisible(true);
                }}
                className="px-3 py-1 bg-gray-700 rounded text-sm capitalize"
              >
                {type}
              </button>
            ))}
          </div>
          <FeedbackToast
            type={toastType}
            message={`This is a ${toastType} message!`}
            isVisible={toastVisible}
            onDismiss={() => setToastVisible(false)}
          />
        </div>

        {/* Success Checkmark */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Success Checkmark</h4>
          <div className="flex items-center gap-4">
            <SuccessCheckmark isVisible={checkVisible} size={64} />
            <button
              onClick={() => setCheckVisible(!checkVisible)}
              className="px-3 py-1 bg-gray-700 rounded text-sm"
            >
              Toggle
            </button>
          </div>
        </div>

        {/* Animated Counter */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Animated Counter</h4>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-blue-400">
              <AnimatedCounter value={count} duration={1} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCount(count - 10)}
                className="px-3 py-1 bg-gray-700 rounded text-sm"
              >
                -10
              </button>
              <button
                onClick={() => setCount(count + 10)}
                className="px-3 py-1 bg-gray-700 rounded text-sm"
              >
                +10
              </button>
            </div>
          </div>
        </div>

        {/* Icon Animations */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Animated Icons</h4>
          <div className="flex gap-4">
            <RotatingIcon icon={Settings} className="w-8 h-8 text-blue-400" />
            <BounceIcon icon={Heart} className="w-8 h-8 text-pink-400" />
          </div>
        </div>

        {/* Shake & Wiggle */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Shake & Wiggle</h4>
          <div className="flex gap-4">
            <Shake trigger={shakeKey > 0} className="inline-block">
              <button
                onClick={() => setShakeKey(shakeKey + 1)}
                className="px-4 py-2 bg-red-600 rounded-lg"
              >
                Shake Me
              </button>
            </Shake>
            <Wiggle trigger={wiggleKey > 0} className="inline-block">
              <button
                onClick={() => setWiggleKey(wiggleKey + 1)}
                className="px-4 py-2 bg-purple-600 rounded-lg"
              >
                Wiggle Me
              </button>
            </Wiggle>
          </div>
        </div>

        {/* Tooltip */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Animated Tooltip</h4>
          <AnimatedTooltip content="This is a tooltip!" position="top">
            <button className="px-4 py-2 bg-gray-700 rounded-lg">
              Hover for Tooltip
            </button>
          </AnimatedTooltip>
        </div>

        {/* Badge Pulse */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Badge Pulse</h4>
          <div className="inline-flex items-center gap-2">
            <span className="text-text-light">Notifications</span>
            <BadgePulse count={5} pulse />
          </div>
        </div>
      </div>
    </DemoSection>
  );
};

// ========================================================================
// Transition Effects Demo
// ========================================================================

const TransitionEffectsDemo = () => {
  const [activeTab, setActiveTab] = useState('tab1');
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [crossfadeKey, setCrossfadeKey] = useState(0);

  const tabs = [
    { id: 'tab1', label: 'Tab 1', content: <div className="p-4 bg-gray-800 rounded-lg">Content for Tab 1</div> },
    { id: 'tab2', label: 'Tab 2', content: <div className="p-4 bg-gray-800 rounded-lg">Content for Tab 2</div> },
    { id: 'tab3', label: 'Tab 3', content: <div className="p-4 bg-gray-800 rounded-lg">Content for Tab 3</div> },
  ];

  return (
    <DemoSection
      title="Transition Effects"
      description="Smooth transitions for UI state changes"
    >
      <div className="space-y-6">
        {/* Tab Transition */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Tab Transition</h4>
          <TabTransition
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Accordion */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Accordion</h4>
          <div className="space-y-2">
            <AccordionTransition title="Accordion Item 1">
              <p className="text-text-light/70">Content for accordion item 1</p>
            </AccordionTransition>
            <AccordionTransition title="Accordion Item 2">
              <p className="text-text-light/70">Content for accordion item 2</p>
            </AccordionTransition>
          </div>
        </div>

        {/* Crossfade */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Crossfade Transition</h4>
          <CrossfadeTransition transitionKey={crossfadeKey}>
            <div className="p-4 bg-gray-800 rounded-lg">
              State: {crossfadeKey}
            </div>
          </CrossfadeTransition>
          <button
            onClick={() => setCrossfadeKey(crossfadeKey + 1)}
            className="mt-2 px-3 py-1 bg-gray-700 rounded text-sm"
          >
            Change State
          </button>
        </div>

        {/* Modal */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Modal Transition</h4>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-blue-600 rounded-lg"
          >
            Open Modal
          </button>
          <ModalTransition isOpen={modalOpen} onClose={() => setModalOpen(false)}>
            <h3 className="text-lg font-semibold text-text-light mb-4">Modal Title</h3>
            <p className="text-text-light/70">This is modal content with smooth animations.</p>
            <button
              onClick={() => setModalOpen(false)}
              className="mt-4 px-4 py-2 bg-gray-700 rounded-lg"
            >
              Close
            </button>
          </ModalTransition>
        </div>

        {/* Drawer */}
        <div>
          <h4 className="text-sm font-medium text-text-light mb-3">Drawer Transition</h4>
          <button
            onClick={() => setDrawerOpen(true)}
            className="px-4 py-2 bg-purple-600 rounded-lg"
          >
            Open Drawer
          </button>
          <DrawerTransition
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            side="right"
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-text-light mb-4">Drawer</h3>
              <p className="text-text-light/70">This is drawer content.</p>
              <button
                onClick={() => setDrawerOpen(false)}
                className="mt-4 px-4 py-2 bg-gray-700 rounded-lg"
              >
                Close
              </button>
            </div>
          </DrawerTransition>
        </div>
      </div>
    </DemoSection>
  );
};

// ========================================================================
// Main Demo Component
// ========================================================================

export const AnimationDemo = () => {
  return (
    <AnimationProvider enablePerformanceMonitoring>
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-text-light">Animation System Demo</h1>
            <p className="text-text-light/60">
              Comprehensive showcase of all animation components and capabilities
            </p>
          </div>

          {/* Controls */}
          <AnimationControls />

          {/* Demos */}
          <SpringAnimationsDemo />
          <LoadingStatesDemo />
          <MicroInteractionsDemo />
          <TransitionEffectsDemo />
        </div>
      </div>
    </AnimationProvider>
  );
};

export default AnimationDemo;
