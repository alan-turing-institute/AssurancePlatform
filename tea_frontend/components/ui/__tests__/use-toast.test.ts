import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ToastAction,
  type ToastActionElement,
  type ToastProps,
} from '../toast';
import { useToast } from '../use-toast';

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any existing timers
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic functionality', () => {
    it('should initialize with empty toasts array', () => {
      const { result } = renderHook(() => useToast());

      expect(result.current.toasts).toEqual([]);
    });

    it('should add a toast with basic props', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({
          title: 'Test Toast',
          description: 'Test description',
        });
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        title: 'Test Toast',
        description: 'Test description',
      });
      expect(result.current.toasts[0].id).toBeDefined();
    });

    it('should generate unique IDs for each toast', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Toast 1' });
        result.current.toast({ title: 'Toast 2' });
        result.current.toast({ title: 'Toast 3' });
      });

      const ids = result.current.toasts.map((toast) => toast.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(3);
      expect(result.current.toasts).toHaveLength(3);
    });
  });

  describe('Toast variants', () => {
    it('should support default variant', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({
          title: 'Default Toast',
        });
      });

      expect(result.current.toasts[0].variant).toBeUndefined();
    });

    it('should support destructive variant', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({
          variant: 'destructive',
          title: 'Error Toast',
        });
      });

      expect(result.current.toasts[0].variant).toBe('destructive');
    });

    it('should support success variant', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({
          variant: 'success',
          title: 'Success Toast',
        });
      });

      expect(result.current.toasts[0].variant).toBe('success');
    });
  });

  describe('Toast actions', () => {
    it('should support action prop', () => {
      const { result } = renderHook(() => useToast());
      const testAction = React.createElement(ToastAction, {
        altText: 'Test Action',
      }) as unknown as ToastActionElement;

      act(() => {
        result.current.toast({
          title: 'Toast with Action',
          action: testAction,
        });
      });

      expect(result.current.toasts[0].action).toBe(testAction);
    });

    it('should support multiple toasts with different actions', () => {
      const { result } = renderHook(() => useToast());
      const action1 = React.createElement(ToastAction, {
        altText: 'Action 1',
      }) as unknown as ToastActionElement;
      const action2 = React.createElement(ToastAction, {
        altText: 'Action 2',
      }) as unknown as ToastActionElement;

      act(() => {
        result.current.toast({
          title: 'Toast 1',
          action: action1,
        });
        result.current.toast({
          title: 'Toast 2',
          action: action2,
        });
      });

      expect(result.current.toasts[0].action).toBe(action1);
      expect(result.current.toasts[1].action).toBe(action2);
    });
  });

  describe('Toast dismissal', () => {
    it('should dismiss toast by ID', () => {
      const { result } = renderHook(() => useToast());
      let toastId: string;

      act(() => {
        const toast = result.current.toast({ title: 'Dismissible Toast' });
        toastId = toast.id;
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        result.current.dismiss(toastId);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should dismiss all toasts when no ID provided', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Toast 1' });
        result.current.toast({ title: 'Toast 2' });
        result.current.toast({ title: 'Toast 3' });
      });

      expect(result.current.toasts).toHaveLength(3);

      act(() => {
        result.current.dismiss();
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should handle dismissing non-existent toast gracefully', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Existing Toast' });
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        result.current.dismiss('non-existent-id');
      });

      // Should not affect existing toasts
      expect(result.current.toasts).toHaveLength(1);
    });
  });

  describe('TOAST_LIMIT functionality', () => {
    it('should respect TOAST_LIMIT of 1', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Toast 1' });
        result.current.toast({ title: 'Toast 2' });
        result.current.toast({ title: 'Toast 3' });
      });

      // Should only keep the most recent toast
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Toast 3');
    });

    it('should remove oldest toast when limit exceeded', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'First Toast' });
      });

      const firstToastId = result.current.toasts[0].id;

      act(() => {
        result.current.toast({ title: 'Second Toast' });
      });

      // First toast should be removed
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Second Toast');
      expect(result.current.toasts[0].id).not.toBe(firstToastId);
    });
  });

  describe('TOAST_REMOVE_DELAY functionality', () => {
    it('should auto-remove toast after delay', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Auto-remove Toast' });
      });

      expect(result.current.toasts).toHaveLength(1);

      // Fast forward past the remove delay (1000000ms)
      act(() => {
        vi.advanceTimersByTime(1_000_001);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should cancel auto-removal when manually dismissed', () => {
      const { result } = renderHook(() => useToast());
      let toastId: string;

      act(() => {
        const toast = result.current.toast({ title: 'Manual Dismiss Toast' });
        toastId = toast.id;
      });

      expect(result.current.toasts).toHaveLength(1);

      // Manually dismiss before auto-removal
      act(() => {
        result.current.dismiss(toastId);
      });

      expect(result.current.toasts).toHaveLength(0);

      // Fast forward past the remove delay
      act(() => {
        vi.advanceTimersByTime(1_000_001);
      });

      // Should still be empty (no double removal)
      expect(result.current.toasts).toHaveLength(0);
    });

    it('should handle multiple toasts with different timers', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Toast 1' });
      });

      act(() => {
        vi.advanceTimersByTime(500_000); // Half the delay
      });

      act(() => {
        result.current.toast({ title: 'Toast 2' });
      });

      // Both should be present (Toast 1 replaced Toast 2 due to limit)
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Toast 2');

      // Fast forward to remove Toast 2
      act(() => {
        vi.advanceTimersByTime(1_000_001);
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe('Return value from toast function', () => {
    it('should return toast object with id and other props', () => {
      const { result } = renderHook(() => useToast());
      let returnedToast:
        | {
            id: string;
            dismiss: () => void;
            update: (props: Partial<ToasterToast>) => void;
          }
        | undefined;

      act(() => {
        returnedToast = result.current.toast({
          title: 'Return Test',
          description: 'Test description',
          variant: 'destructive',
        });
      });

      expect(returnedToast).toMatchObject({
        id: expect.any(String),
        title: 'Return Test',
        description: 'Test description',
        variant: 'destructive',
      });

      // Returned toast should match the one in the state
      expect(returnedToast).toEqual(result.current.toasts[0]);
    });

    it('should allow chaining operations with returned toast', () => {
      const { result } = renderHook(() => useToast());
      let toastId: string;

      act(() => {
        const toast = result.current.toast({ title: 'Chainable Toast' });
        toastId = toast.id;
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        result.current.dismiss(toastId);
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe('State consistency', () => {
    it('should maintain state across multiple renders', () => {
      const { result, rerender } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Persistent Toast' });
      });

      const initialToastId = result.current.toasts[0].id;

      rerender();

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].id).toBe(initialToastId);
    });

    it('should handle rapid state changes', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        // Rapid operations
        result.current.toast({ title: 'Toast 1' });
        result.current.dismiss();
        result.current.toast({ title: 'Toast 2' });
        result.current.toast({ title: 'Toast 3' });
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Toast 3');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty toast props', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({});
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].id).toBeDefined();
    });

    it('should handle undefined toast props', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({
          title: undefined,
          description: undefined,
          variant: undefined,
        });
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        title: undefined,
        description: undefined,
        variant: undefined,
      });
    });

    it('should handle very long toast content', () => {
      const { result } = renderHook(() => useToast());
      const longTitle = 'A'.repeat(1000);
      const longDescription = 'B'.repeat(2000);

      act(() => {
        result.current.toast({
          title: longTitle,
          description: longDescription,
        });
      });

      expect(result.current.toasts[0].title).toBe(longTitle);
      expect(result.current.toasts[0].description).toBe(longDescription);
    });

    it('should handle special characters in toast content', () => {
      const { result } = renderHook(() => useToast());
      const specialTitle = 'Toast with 🎉 emojis & symbols ™️';
      const specialDescription =
        'Description with <html> & "quotes" and \n newlines';

      act(() => {
        result.current.toast({
          title: specialTitle,
          description: specialDescription,
        });
      });

      expect(result.current.toasts[0].title).toBe(specialTitle);
      expect(result.current.toasts[0].description).toBe(specialDescription);
    });

    it('should handle concurrent hook instances', () => {
      const { result: result1 } = renderHook(() => useToast());
      const { result: result2 } = renderHook(() => useToast());

      act(() => {
        result1.current.toast({ title: 'Toast from Hook 1' });
      });

      act(() => {
        result2.current.toast({ title: 'Toast from Hook 2' });
      });

      // Both hooks should see all toasts (shared state)
      expect(result1.current.toasts).toHaveLength(1);
      expect(result2.current.toasts).toHaveLength(1);
      expect(result1.current.toasts[0].title).toBe('Toast from Hook 2'); // Latest due to limit
      expect(result2.current.toasts[0].title).toBe('Toast from Hook 2');
    });
  });

  describe('Memory and performance', () => {
    it('should handle memory cleanup on unmount', () => {
      const { result, unmount } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Toast Before Unmount' });
      });

      expect(result.current.toasts).toHaveLength(1);

      unmount();

      // Should not throw or cause memory leaks
    });

    it('should handle large numbers of rapid toast operations', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.toast({ title: `Toast ${i}` });
        }
      });

      // Should still respect the limit
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Toast 99');
    });
  });
});
