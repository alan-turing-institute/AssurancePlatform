/**
 * Example tests demonstrating the accessibility testing utilities
 */

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import * as React from 'react';
import {
  runAccessibilityTests,
  testKeyboardNavigation,
  testScreenReaderCompatibility,
  testFormAccessibility,
  runFullAccessibilityAudit,
  quickAccessibilityCheck,
} from './accessibility-test-utils';

// Simple test components for demonstration
const AccessibleButton = () =>
  React.createElement(
    'button',
    { type: 'button', 'aria-label': 'Close dialog' },
    '×'
  );

const InaccessibleButton = () =>
  React.createElement('button', { type: 'button' }, '×');

const AccessibleForm = () =>
  React.createElement(
    'form',
    null,
    React.createElement('label', { htmlFor: 'email' }, 'Email Address'),
    React.createElement('input', {
      id: 'email',
      type: 'email',
      required: true,
      'aria-required': 'true',
      'aria-describedby': 'email-help',
    }),
    React.createElement(
      'div',
      { id: 'email-help' },
      'Please enter a valid email address'
    ),
    React.createElement('button', { type: 'submit' }, 'Submit')
  );

const InaccessibleForm = () =>
  React.createElement(
    'form',
    null,
    React.createElement('input', {
      type: 'email',
      placeholder: 'Email',
    }),
    React.createElement('button', { type: 'submit' }, 'Submit')
  );

describe('Accessibility Test Utils', () => {
  describe('runAccessibilityTests', () => {
    it('should pass for accessible components', async () => {
      const { container } = render(React.createElement(AccessibleButton));
      const result = await runAccessibilityTests(container);

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail for inaccessible components', async () => {
      const { container } = render(React.createElement(InaccessibleButton));
      const result = await runAccessibilityTests(container);

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('testKeyboardNavigation', () => {
    it('should detect focusable elements', async () => {
      const { container } = render(
        React.createElement(
          'div',
          null,
          React.createElement('button', { type: 'button' }, 'First'),
          React.createElement('button', { type: 'button' }, 'Second'),
          React.createElement('a', { href: '#' }, 'Link')
        )
      );

      const result = await testKeyboardNavigation(container);

      expect(result.focusedElements.length).toBeGreaterThan(0);
      expect(result.hasLogicalTabOrder).toBe(true);
    });
  });

  describe('testScreenReaderCompatibility', () => {
    it('should identify missing accessible names', () => {
      const { container } = render(React.createElement(InaccessibleButton));
      const result = testScreenReaderCompatibility(container);

      expect(result.missingAccessibleNames.length).toBeGreaterThan(0);
      expect(result.accessibilityScore).toBeLessThan(100);
    });

    it('should pass for accessible components', () => {
      const { container } = render(React.createElement(AccessibleButton));
      const result = testScreenReaderCompatibility(container);

      expect(result.missingAccessibleNames).toHaveLength(0);
      expect(result.accessibilityScore).toBe(100);
    });
  });

  describe('testFormAccessibility', () => {
    it('should pass for accessible forms', () => {
      const { container } = render(React.createElement(AccessibleForm));
      const result = testFormAccessibility(container);

      expect(result.missingLabels).toHaveLength(0);
      expect(result.accessibilityScore).toBeGreaterThan(80);
    });

    it('should fail for inaccessible forms', () => {
      const { container } = render(React.createElement(InaccessibleForm));
      const result = testFormAccessibility(container);

      expect(result.missingLabels.length).toBeGreaterThan(0);
      expect(result.accessibilityScore).toBeLessThan(80);
    });
  });

  describe('runFullAccessibilityAudit', () => {
    it('should provide comprehensive accessibility analysis', async () => {
      const renderComponent = () => render(React.createElement(AccessibleForm));
      const result = await runFullAccessibilityAudit(renderComponent);

      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('keyboardNavigation');
      expect(result).toHaveProperty('screenReader');
      expect(result).toHaveProperty('formAccessibility');
      expect(result).toHaveProperty('summary');

      expect(Array.isArray(result.summary)).toBe(true);
    });
  });

  describe('quickAccessibilityCheck', () => {
    it('should quickly identify accessibility issues', async () => {
      const { container } = render(React.createElement(InaccessibleButton));
      const result = await quickAccessibilityCheck(container);

      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('issues');
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });
});
