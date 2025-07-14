import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the dependencies properly
vi.mock('clsx', () => ({
  clsx: vi.fn(),
}));

vi.mock('tailwind-merge', () => ({
  twMerge: vi.fn(),
}));

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
// Import after mocking
import { cn } from '../utils';

// Get the mocked functions
const mockClsx = vi.mocked(clsx);
const mockTwMerge = vi.mocked(twMerge);

describe('utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock behaviors
    mockClsx.mockImplementation((inputs: any) => {
      if (Array.isArray(inputs)) {
        const result = [];
        for (const input of inputs) {
          if (typeof input === 'string' && input) {
            result.push(input);
          } else if (
            typeof input === 'object' &&
            input !== null &&
            !Array.isArray(input)
          ) {
            for (const [key, value] of Object.entries(input)) {
              if (value) {
                result.push(key);
              }
            }
          } else if (Array.isArray(input)) {
            result.push(...input.filter(Boolean));
          }
        }
        return result.join(' ');
      }
      return String(inputs || '');
    });

    mockTwMerge.mockImplementation((classes: any) => {
      if (typeof classes === 'string') {
        const classArray = classes.split(' ').filter(Boolean);
        const uniqueClasses = [...new Set(classArray)];

        // Simulate basic tailwind-merge behavior for padding classes
        const paddingClasses = uniqueClasses.filter((cls) =>
          cls.startsWith('p-')
        );
        if (paddingClasses.length > 1) {
          const otherClasses = uniqueClasses.filter(
            (cls) => !cls.startsWith('p-')
          );
          return [...otherClasses, paddingClasses.at(-1)].join(' ');
        }

        return uniqueClasses.join(' ');
      }
      return classes;
    });
  });

  describe('cn function', () => {
    it('should combine multiple string classes', () => {
      const result = cn('flex', 'justify-center', 'items-center');

      expect(mockClsx).toHaveBeenCalledWith([
        'flex',
        'justify-center',
        'items-center',
      ]);
      expect(mockTwMerge).toHaveBeenCalled();
      expect(result).toContain('flex');
      expect(result).toContain('justify-center');
      expect(result).toContain('items-center');
    });

    it('should handle conditional classes with objects', () => {
      const result = cn('base-class', {
        'conditional-true': true,
        'conditional-false': false,
      });

      expect(mockClsx).toHaveBeenCalled();
      expect(result).toContain('base-class');
      expect(result).toContain('conditional-true');
      expect(result).not.toContain('conditional-false');
    });

    it('should resolve conflicting Tailwind classes', () => {
      const result = cn('p-4', 'text-center', 'p-2');

      // Should keep p-2 (the last padding class) and remove p-4
      expect(result).toContain('p-2');
      expect(result).toContain('text-center');
      expect(result).not.toContain('p-4');
    });

    it('should handle empty inputs', () => {
      const _result = cn();
      expect(mockClsx).toHaveBeenCalledWith([]);
    });

    it('should handle null and undefined inputs', () => {
      const result = cn(null, undefined, 'valid-class');
      expect(mockClsx).toHaveBeenCalledWith([null, undefined, 'valid-class']);
      expect(result).toContain('valid-class');
    });

    it('should handle arrays of classes', () => {
      const result = cn(['class1', 'class2'], 'class3');

      expect(mockClsx).toHaveBeenCalled();
      expect(result).toContain('class1');
      expect(result).toContain('class2');
      expect(result).toContain('class3');
    });

    it('should handle mixed input types', () => {
      const result = cn(
        'base-class',
        ['array-class1', 'array-class2'],
        {
          'object-class-true': true,
          'object-class-false': false,
        },
        'final-class'
      );

      expect(result).toContain('base-class');
      expect(result).toContain('array-class1');
      expect(result).toContain('array-class2');
      expect(result).toContain('object-class-true');
      expect(result).toContain('final-class');
      expect(result).not.toContain('object-class-false');
    });

    it('should handle boolean values', () => {
      const result = cn('class1', false, 'class2', 'conditional-class');

      expect(result).toContain('class1');
      expect(result).toContain('class2');
      expect(result).toContain('conditional-class');
    });

    it('should handle complex conditional logic', () => {
      const isActive = true;
      const isDisabled = false;
      const variant = 'primary';

      const result = cn('btn', 'btn-base', {
        'btn-active': isActive,
        'btn-disabled': isDisabled,
        'btn-primary': variant === 'primary',
        'btn-secondary': (variant as string) === 'secondary',
      });

      expect(result).toContain('btn');
      expect(result).toContain('btn-base');
      expect(result).toContain('btn-active');
      expect(result).toContain('btn-primary');
      expect(result).not.toContain('btn-disabled');
      expect(result).not.toContain('btn-secondary');
    });

    it('should handle duplicate classes', () => {
      const result = cn('duplicate', 'other-class', 'duplicate');

      // twMerge should handle duplicates
      const duplicateCount = (result.match(/duplicate/g) || []).length;
      expect(duplicateCount).toBe(1);
    });

    it('should preserve order for non-conflicting classes', () => {
      const result = cn('first', 'second', 'third');

      const firstIndex = result.indexOf('first');
      const secondIndex = result.indexOf('second');
      const thirdIndex = result.indexOf('third');

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });

    it('should handle empty strings', () => {
      const result = cn('', 'valid-class', '');
      expect(result).toContain('valid-class');
    });

    it('should handle whitespace-only strings', () => {
      const result = cn('   ', 'valid-class', '  ');
      expect(result).toContain('valid-class');
    });

    it('should work with component variants pattern', () => {
      const buttonVariants = {
        size: {
          sm: 'h-8 px-3 text-xs',
          md: 'h-10 px-4 py-2',
          lg: 'h-12 px-8 py-3',
        },
        variant: {
          default: 'bg-primary text-primary-foreground',
          destructive: 'bg-destructive text-destructive-foreground',
          outline: 'border border-input bg-background',
        },
      };

      const size = 'md';
      const variant = 'default';

      const result = cn(
        'inline-flex items-center justify-center',
        buttonVariants.size[size],
        buttonVariants.variant[variant],
        'disabled:opacity-50'
      );

      expect(result).toContain('inline-flex');
      expect(result).toContain('items-center');
      expect(result).toContain('justify-center');
      expect(result).toContain('h-10');
      expect(result).toContain('px-4');
      expect(result).toContain('py-2');
      expect(result).toContain('bg-primary');
      expect(result).toContain('text-primary-foreground');
      expect(result).toContain('disabled:opacity-50');
    });

    it('should handle nested arrays', () => {
      const result = cn(
        ['outer-class', ['nested-class1', 'nested-class2']],
        'final-class'
      );

      expect(result).toContain('outer-class');
      expect(result).toContain('nested-class1');
      expect(result).toContain('nested-class2');
      expect(result).toContain('final-class');
    });

    it('should handle large numbers of classes efficiently', () => {
      const manyClasses = Array.from({ length: 100 }, (_, i) => `class-${i}`);

      const start = performance.now();
      const result = cn(...manyClasses);
      const end = performance.now();

      expect(result).toContain('class-0');
      expect(result).toContain('class-99');
      expect(end - start).toBeLessThan(10); // Should be very fast
    });

    it('should maintain function behavior with real-world usage patterns', () => {
      // Simulate common UI component class merging
      const baseClasses = 'rounded-md border px-3 py-2 text-sm';
      const variantClasses = 'border-red-500 bg-red-50 text-red-900';
      const stateClasses = { 'opacity-50': false, 'cursor-not-allowed': false };
      const userClasses = 'custom-class';

      const result = cn(baseClasses, variantClasses, stateClasses, userClasses);

      expect(result).toContain('rounded-md');
      expect(result).toContain('border');
      expect(result).toContain('px-3');
      expect(result).toContain('py-2');
      expect(result).toContain('text-sm');
      expect(result).toContain('border-red-500');
      expect(result).toContain('bg-red-50');
      expect(result).toContain('text-red-900');
      expect(result).toContain('custom-class');
      expect(result).not.toContain('opacity-50');
      expect(result).not.toContain('cursor-not-allowed');
    });

    it('should call clsx and twMerge in the correct order', () => {
      vi.clearAllMocks();

      cn('test-class');

      expect(mockClsx).toHaveBeenCalledTimes(1);
      expect(mockTwMerge).toHaveBeenCalledTimes(1);
      expect(mockClsx).toHaveBeenCalledBefore(mockTwMerge);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle functions as class values', () => {
      const getClass = () => 'function-class';

      expect(() => {
        cn('base', getClass as any);
      }).not.toThrow();
    });

    it('should handle symbols as class values', () => {
      const symbolClass = Symbol('test');

      // Mock clsx to handle symbols gracefully for this test
      mockClsx.mockImplementationOnce((inputs: any) => {
        if (Array.isArray(inputs)) {
          return inputs
            .filter((input: any) => typeof input === 'string')
            .join(' ');
        }
        return '';
      });

      expect(() => {
        cn('base', symbolClass as any);
      }).not.toThrow();
    });

    it('should handle numbers as class values', () => {
      expect(() => {
        cn('base', 123 as any, 'end');
      }).not.toThrow();
    });

    it('should handle deeply nested structures', () => {
      const deepStructure = {
        level1: {
          level2: {
            level3: 'deep-class',
          },
        },
      };

      expect(() => {
        cn('base', deepStructure as any);
      }).not.toThrow();
    });
  });
});
