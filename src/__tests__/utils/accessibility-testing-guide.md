# Accessibility Testing Guide for TEA Platform

This guide explains how to use the comprehensive accessibility testing utilities to ensure the TEA Platform meets WCAG guidelines and provides an accessible experience for users with disabilities.

## Overview

The accessibility testing utilities provide automated testing for:

- **Keyboard Navigation**: Tab order, escape key, enter key functionality
- **Screen Reader Compatibility**: ARIA labels, roles, descriptions
- **Focus Management**: Focus trapping in modals, focus restoration
- **Color Contrast**: Visual accessibility validation
- **Form Accessibility**: Labels, error messages, validation states
- **Landmark Navigation**: Semantic structure and navigation
- **Accessibility Preferences**: Testing with different user preferences

## Quick Start

```typescript
import { runFullAccessibilityAudit } from '../utils/accessibility-test-utils';

describe('My Component Accessibility', () => {
  it('should be fully accessible', async () => {
    const renderComponent = () => render(<MyComponent />);
    const result = await runFullAccessibilityAudit(renderComponent);
    
    expect(result.passed).toBe(true);
    
    // Log detailed results if needed
    if (!result.passed) {
      console.log('Accessibility issues found:', result.summary);
    }
  });
});
```

## Available Testing Functions

### Core Functions

#### `runAccessibilityTests(container, config?)`
Runs comprehensive accessibility tests using axe-core and custom checks.

```typescript
const result = await runAccessibilityTests(container, {
  wcagLevel: 'AA', // 'A', 'AA', or 'AAA'
  skipAxe: false,
  axeOptions: { tags: ['wcag2aa'] }
});

// Result includes:
// - passed: boolean
// - violations: string[]
// - warnings: string[]
// - axeResult: AxeResult
```

#### `runFullAccessibilityAudit(renderComponent, config?)`
Complete accessibility audit including all test types.

```typescript
const result = await runFullAccessibilityAudit(
  () => render(<Component />),
  {
    wcagLevel: 'AA',
    focusManagement: {
      trapFocus: true,
      initialFocus: '[data-testid="modal-close"]'
    }
  }
);
```

### Specific Test Functions

#### `testKeyboardNavigation(container, user?)`
Tests keyboard navigation patterns.

```typescript
const result = await testKeyboardNavigation(container);

// Result includes:
// - focusedElements: HTMLElement[]
// - hasLogicalTabOrder: boolean
// - missingFocusableElements: HTMLElement[]
// - unexpectedFocusableElements: HTMLElement[]
```

#### `testScreenReaderCompatibility(container)`
Tests screen reader compatibility.

```typescript
const result = testScreenReaderCompatibility(container);

// Result includes:
// - missingAccessibleNames: HTMLElement[]
// - insufficientDescriptions: HTMLElement[]
// - incorrectRoles: HTMLElement[]
// - accessibilityScore: number (0-100)
```

#### `testFormAccessibility(container)`
Tests form accessibility features.

```typescript
const result = testFormAccessibility(container);

// Result includes:
// - missingLabels: HTMLElement[]
// - missingErrorAssociation: HTMLElement[]
// - missingRequiredIndication: HTMLElement[]
// - improperFieldsets: HTMLElement[]
// - accessibilityScore: number (0-100)
```

#### `testFocusManagement(container, config, user?)`
Tests focus management in modals and dialogs.

```typescript
const result = await testFocusManagement(container, {
  triggerSelector: '[data-testid="open-modal"]',
  modalSelector: '[role="dialog"]',
  closeSelector: '[data-testid="close-modal"]',
  expectFocusTrap: true
});
```

#### `testLandmarkNavigation(container)`
Tests semantic landmark structure.

```typescript
const result = testLandmarkNavigation(container);

// Result includes:
// - landmarks: HTMLElement[]
// - missingLandmarks: string[]
// - hasMainLandmark: boolean
// - hasNavigationLandmark: boolean
// - hasSkipLinks: boolean
```

### Utility Functions

#### `quickAccessibilityCheck(container)`
Quick accessibility check for basic issues.

```typescript
const result = await quickAccessibilityCheck(container);

// Result includes:
// - passed: boolean
// - issues: string[]
```

#### `testWithAccessibilityPreferences(renderComponent, testFunction, preferences)`
Test component with different accessibility preferences.

```typescript
const result = await testWithAccessibilityPreferences(
  () => render(<Component />),
  async (renderResult) => {
    // Your test logic here
    return await someTest(renderResult.container);
  },
  {
    prefersReducedMotion: true,
    prefersHighContrast: true,
    colorScheme: 'dark',
    fontSizeMultiplier: 1.5
  }
);
```

## Best Practices

### 1. Use in Component Tests

```typescript
describe('Button Component', () => {
  it('should be accessible', async () => {
    const { container } = render(
      <Button onClick={() => {}}>Click me</Button>
    );
    
    const result = await quickAccessibilityCheck(container);
    expect(result.passed).toBe(true);
  });
});
```

### 2. Test Interactive Components

```typescript
describe('Modal Component', () => {
  it('should have proper focus management', async () => {
    const { container } = render(<Modal isOpen={true} />);
    
    const result = await testFocusManagement(container, {
      modalSelector: '[role="dialog"]',
      expectFocusTrap: true
    });
    
    expect(result.isFocusTrapped).toBe(true);
  });
});
```

### 3. Test Form Components

```typescript
describe('ContactForm', () => {
  it('should have accessible form elements', () => {
    const { container } = render(<ContactForm />);
    
    const result = testFormAccessibility(container);
    expect(result.accessibilityScore).toBeGreaterThan(80);
  });
});
```

### 4. Test with Different Preferences

```typescript
describe('ThemeProvider', () => {
  it('should work with high contrast preference', async () => {
    await testWithAccessibilityPreferences(
      () => render(<App />),
      async (result) => {
        const audit = await runAccessibilityTests(result.container);
        expect(audit.passed).toBe(true);
      },
      { prefersHighContrast: true }
    );
  });
});
```

## Configuration Options

### AccessibilityTestConfig

```typescript
interface AccessibilityTestConfig {
  skipAxe?: boolean;           // Skip axe-core tests
  axeOptions?: AxeRunOptions;  // Custom axe configuration
  wcagLevel?: 'A' | 'AA' | 'AAA'; // WCAG conformance level
  focusManagement?: {
    trapFocus?: boolean;       // Expect focus trap
    initialFocus?: string;     // Initial focus selector
    restoreFocus?: boolean;    // Expect focus restoration
  };
}
```

### AccessibilityPreferences

```typescript
interface AccessibilityPreferences {
  prefersReducedMotion?: boolean;
  prefersHighContrast?: boolean;
  colorScheme?: 'light' | 'dark';
  fontSizeMultiplier?: number;
  simulateScreenReader?: boolean;
}
```

## Common Patterns

### 1. Complete Component Audit

```typescript
it('should pass complete accessibility audit', async () => {
  const result = await runFullAccessibilityAudit(
    () => render(<ComplexComponent />)
  );
  
  expect(result.passed).toBe(true);
  
  // Optional: Check individual scores
  expect(result.screenReader.accessibilityScore).toBeGreaterThan(80);
  expect(result.keyboardNavigation.hasLogicalTabOrder).toBe(true);
});
```

### 2. Modal Testing

```typescript
it('should manage focus correctly in modal', async () => {
  const user = userEvent.setup();
  const { container } = render(<AppWithModal />);
  
  // Open modal
  const openButton = screen.getByRole('button', { name: /open modal/i });
  await user.click(openButton);
  
  const result = await testFocusManagement(container, {
    modalSelector: '[role="dialog"]',
    closeSelector: '[aria-label="Close"]',
    expectFocusTrap: true
  });
  
  expect(result.isFocusTrapped).toBe(true);
});
```

### 3. Form Validation Testing

```typescript
it('should provide accessible error messages', async () => {
  const user = userEvent.setup();
  const { container } = render(<LoginForm />);
  
  // Trigger validation
  const submitButton = screen.getByRole('button', { name: /login/i });
  await user.click(submitButton);
  
  const result = testFormAccessibility(container);
  expect(result.missingErrorAssociation).toHaveLength(0);
});
```

## Integration with CI/CD

Add accessibility tests to your CI pipeline:

```typescript
// accessibility.test.ts
import { runFullAccessibilityAudit } from './utils/accessibility-test-utils';

const criticalComponents = [
  'Navigation',
  'Modal',
  'Form',
  'DataTable'
];

describe('Critical Component Accessibility', () => {
  criticalComponents.forEach(componentName => {
    it(`${componentName} should be fully accessible`, async () => {
      const Component = await import(`../components/${componentName}`);
      const result = await runFullAccessibilityAudit(
        () => render(<Component.default />)
      );
      
      expect(result.passed).toBe(true);
    });
  });
});
```

## Troubleshooting

### Common Issues and Solutions

1. **Axe violations**: Check the `axeResult` property for detailed information
2. **Focus management**: Use browser dev tools to track focus events
3. **Screen reader issues**: Test with actual screen readers when possible
4. **Form accessibility**: Ensure all inputs have proper labels and error associations

### Debugging Tips

```typescript
// Enable detailed logging
const result = await runFullAccessibilityAudit(renderComponent);
if (!result.passed) {
  console.log('Summary:', result.summary);
  console.log('Keyboard navigation:', result.keyboardNavigation);
  console.log('Screen reader score:', result.screenReader.accessibilityScore);
}
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core Rules](https://dequeuniversity.com/rules/axe/)
- [Testing Library Accessibility](https://testing-library.com/docs/guide-which-query/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
