# Animation System

> Comprehensive animation and transitions polish for React Flow enhanced components

## Quick Start

### 1. Wrap your app with AnimationProvider

```jsx
import { AnimationProvider } from '@/components/curriculum/enhanced/animations';

function App() {
  return (
    <AnimationProvider enablePerformanceMonitoring>
      <YourApp />
    </AnimationProvider>
  );
}
```

### 2. Use animation hooks in components

```jsx
import { useAnimation } from '@/components/curriculum/enhanced/animations';

function MyComponent() {
  const { shouldAnimate, getVariants, getDuration } = useAnimation();

  return (
    <motion.div variants={getVariants(PRESETS.nodeEntrance)}>
      Content
    </motion.div>
  );
}
```

## Components

### Spring Animations
Physics-based natural motion animations.

```jsx
import {
  SpringStaggerContainer,
  SpringStaggerItem,
  SpringDraggable,
  SpringMagnetic,
  SpringGesture,
} from '@/components/curriculum/enhanced/animations';

// Stagger multiple items
<SpringStaggerContainer>
  {items.map(item => (
    <SpringStaggerItem key={item.id}>{item}</SpringStaggerItem>
  ))}
</SpringStaggerContainer>

// Draggable with spring physics
<SpringDraggable constraints={{ left: -100, right: 100 }}>
  Drag me
</SpringDraggable>

// Magnetic effect (follows cursor)
<SpringMagnetic strength={0.5}>
  Magnetic element
</SpringMagnetic>
```

### Loading States
Skeleton loaders, spinners, and progress indicators.

```jsx
import {
  Skeleton,
  NodeSkeleton,
  Spinner,
  ProgressBar,
  ContentReveal,
} from '@/components/curriculum/enhanced/animations';

// Skeleton loader
<Skeleton variant="text" count={3} />

// Node-specific skeleton
<NodeSkeleton nodeType="goal" expanded />

// Progress bar
<ProgressBar progress={75} showLabel />

// Content reveal after loading
<ContentReveal isLoading={isLoading} loader={<Spinner />}>
  {content}
</ContentReveal>
```

### Micro Interactions
Delightful UI feedback animations.

```jsx
import {
  InteractiveButton,
  RippleEffect,
  FeedbackToast,
  AnimatedCounter,
  Shake,
} from '@/components/curriculum/enhanced/animations';

// Interactive button with hover/press effects
<InteractiveButton variant="primary" onClick={handleClick}>
  Click Me
</InteractiveButton>

// Material ripple effect
<RippleEffect>Click for ripple</RippleEffect>

// Toast notification
<FeedbackToast
  type="success"
  message="Saved!"
  isVisible={true}
  onDismiss={handleClose}
/>

// Animated number counter
<AnimatedCounter value={100} duration={1} />

// Shake on error
<Shake trigger={hasError}>
  Error message
</Shake>
```

### Transition Effects
Page and component transitions.

```jsx
import {
  TabTransition,
  AccordionTransition,
  ModalTransition,
  DrawerTransition,
} from '@/components/curriculum/enhanced/animations';

// Tab switching
<TabTransition
  tabs={tabs}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>

// Accordion
<AccordionTransition title="Section">
  Content
</AccordionTransition>

// Modal with backdrop
<ModalTransition isOpen={isOpen} onClose={handleClose}>
  Modal content
</ModalTransition>

// Drawer (side panel)
<DrawerTransition isOpen={isOpen} onClose={handleClose} side="right">
  Drawer content
</DrawerTransition>
```

## Animation Presets

Pre-configured animation settings for consistency.

```jsx
import {
  TIMING,
  EASING,
  SPRING,
  PRESETS,
} from '@/components/curriculum/enhanced/animations';

// Use preset timing
duration: TIMING.normal // 250ms

// Use preset easing
ease: EASING.backOut

// Use preset spring
transition: SPRING.bouncy

// Use complete preset
variants={PRESETS.nodeEntrance}
```

## User Preferences

### Animation Controls

```jsx
const {
  animationsEnabled,
  animationSpeed,
  reducedMotion,
  toggleAnimations,
  setSpeed,
  setReducedMotion,
} = useAnimationPreferences();

// Enable/disable animations
toggleAnimations();

// Set speed: 'slow', 'normal', 'fast'
setSpeed('fast');

// Override reduced motion
setReducedMotion(true);
```

### Performance Monitoring

```jsx
const {
  fps,
  performanceScore,
  isPerformant,
  needsOptimization,
} = useAnimationPerformance();

// Monitor FPS
console.log(`Current FPS: ${fps}`);

// Check performance
if (needsOptimization) {
  // Reduce animation complexity
}
```

## Accessibility

All animations automatically respect user preferences:

- **Reduced Motion**: Detected via `prefers-reduced-motion` media query
- **Manual Override**: Users can disable animations in settings
- **Focus Indicators**: Animated focus rings for keyboard navigation
- **Screen Reader**: Compatible with assistive technologies

## Performance

### Optimization Tips

1. **Use GPU Acceleration**
   ```jsx
   const gpuProps = getGpuAcceleration();
   // Adds will-change hints
   ```

2. **Conditional Rendering**
   ```jsx
   if (!shouldAnimate) {
     return <StaticComponent />;
   }
   ```

3. **Adjust Duration**
   ```jsx
   const duration = getDuration(300); // Respects user speed preference
   ```

4. **Monitor Performance**
   ```jsx
   <AnimationProvider
     enablePerformanceMonitoring
     onPerformanceChange={handleChange}
   >
   ```

## Examples

### Animated Node

```jsx
import { motion } from 'framer-motion';
import { useAnimation, PRESETS } from '@/components/curriculum/enhanced/animations';

function AnimatedNode({ data }) {
  const { getVariants, shouldAnimate } = useAnimation();

  if (!shouldAnimate) {
    return <div>{data.label}</div>;
  }

  return (
    <motion.div
      variants={getVariants(PRESETS.nodeEntrance)}
      initial="initial"
      animate="animate"
      exit="exit"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {data.label}
    </motion.div>
  );
}
```

### Loading State

```jsx
import { ContentReveal, NodeSkeleton } from '@/components/curriculum/enhanced/animations';

function NodeLoader({ data, isLoading }) {
  return (
    <ContentReveal
      isLoading={isLoading}
      loader={<NodeSkeleton nodeType={data.type} />}
    >
      <Node data={data} />
    </ContentReveal>
  );
}
```

### Interactive Button with Feedback

```jsx
import {
  InteractiveButton,
  FeedbackToast,
  SuccessCheckmark,
} from '@/components/curriculum/enhanced/animations';

function SaveButton() {
  const [showToast, setShowToast] = useState(false);
  const [showCheck, setShowCheck] = useState(false);

  const handleSave = async () => {
    await saveData();
    setShowCheck(true);
    setShowToast(true);
    setTimeout(() => setShowCheck(false), 2000);
  };

  return (
    <>
      <InteractiveButton variant="success" onClick={handleSave}>
        Save Changes
      </InteractiveButton>

      <SuccessCheckmark isVisible={showCheck} />

      <FeedbackToast
        type="success"
        message="Changes saved successfully!"
        isVisible={showToast}
        onDismiss={() => setShowToast(false)}
      />
    </>
  );
}
```

## Demo

Run the demo to see all animations in action:

```jsx
import { AnimationDemo } from '@/components/curriculum/enhanced/animations/AnimationDemo';

<AnimationDemo />
```

## API Reference

See [TASK_5_1_SUMMARY.md](./TASK_5_1_SUMMARY.md) for complete API documentation.

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

Part of the TEA Platform enhanced components.
