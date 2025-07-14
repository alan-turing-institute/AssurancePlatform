import {
  unauthorized,
  useEnforceLogin,
  useEnforceLogout,
  useLoginToken,
} from '.*/use-auth';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

// Mock next-auth
const mockSignOut = vi.fn();
vi.mock('next-auth/react', () => ({
  signOut: mockSignOut,
}));

describe('useAuth hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
    // Mock console.log to suppress logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('useLoginToken', () => {
    it('should return null when no token exists', () => {
      const { result } = renderHook(() => useLoginToken());

      expect(result.current[0]).toBeNull();
    });

    it('should return existing token from localStorage', () => {
      const testToken = 'test-token-123';
      localStorage.setItem('tea-token', testToken);

      const { result } = renderHook(() => useLoginToken());

      expect(result.current[0]).toBe(testToken);
    });

    it('should set token in localStorage', () => {
      const { result } = renderHook(() => useLoginToken());
      const testToken = 'new-token-456';

      act(() => {
        result.current[1](testToken);
      });

      expect(result.current[0]).toBe(testToken);
      expect(localStorage.getItem('tea-token')).toBe(testToken);
    });

    it('should remove token when set to null', () => {
      localStorage.setItem('tea-token', 'existing-token');
      const { result } = renderHook(() => useLoginToken());

      act(() => {
        result.current[1](null);
      });

      expect(result.current[0]).toBeNull();
      expect(localStorage.getItem('tea-token')).toBeNull();
    });

    it('should remove token when set to empty string', () => {
      localStorage.setItem('tea-token', 'existing-token');
      const { result } = renderHook(() => useLoginToken());

      act(() => {
        result.current[1]('');
      });

      expect(result.current[0]).toBeNull();
      expect(localStorage.getItem('tea-token')).toBeNull();
    });

    it('should persist token across hook re-renders', () => {
      const testToken = 'persistent-token';
      const { result, rerender } = renderHook(() => useLoginToken());

      act(() => {
        result.current[1](testToken);
      });

      rerender();

      expect(result.current[0]).toBe(testToken);
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw an error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('localStorage full');
      });

      const { result } = renderHook(() => useLoginToken());

      // Should not crash when localStorage fails
      act(() => {
        result.current[1]('test-token');
      });

      expect(result.current[0]).toBe('test-token');

      localStorage.setItem = originalSetItem;
    });
  });

  describe('useEnforceLogin', () => {
    it('should not redirect when user has valid token', () => {
      localStorage.setItem('tea-token', 'valid-token');

      renderHook(() => useEnforceLogin());

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('should redirect to login when no token exists', () => {
      renderHook(() => useEnforceLogin());

      expect(mockReplace).toHaveBeenCalledWith('/login');
    });

    it('should redirect to login when token is empty', () => {
      localStorage.setItem('tea-token', '');

      renderHook(() => useEnforceLogin());

      expect(mockReplace).toHaveBeenCalledWith('/login');
    });

    it('should redirect to login when token is null', () => {
      localStorage.setItem('tea-token', 'null');

      renderHook(() => useEnforceLogin());

      expect(mockReplace).toHaveBeenCalledWith('/login');
    });

    it('should redirect to login when token is "undefined"', () => {
      localStorage.setItem('tea-token', 'undefined');

      renderHook(() => useEnforceLogin());

      expect(mockReplace).toHaveBeenCalledWith('/login');
    });

    it('should re-check token when it changes', () => {
      const { result: tokenResult } = renderHook(() => useLoginToken());
      renderHook(() => useEnforceLogin());

      // Initially should redirect (no token)
      expect(mockReplace).toHaveBeenCalledWith('/login');

      // Set a token
      act(() => {
        tokenResult.current[1]('new-token');
      });

      // Should stop redirecting after token is set
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid token changes', () => {
      const { result: tokenResult } = renderHook(() => useLoginToken());
      renderHook(() => useEnforceLogin());

      act(() => {
        tokenResult.current[1]('token1');
        tokenResult.current[1](null);
        tokenResult.current[1]('token2');
      });

      // Should handle state changes without errors
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  describe('useEnforceLogout', () => {
    it('should redirect to home when user has token', () => {
      localStorage.setItem('tea-token', 'valid-token');

      renderHook(() => useEnforceLogout());

      expect(mockReplace).toHaveBeenCalledWith('/');
    });

    it('should not redirect when no token exists', () => {
      renderHook(() => useEnforceLogout());

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('should not redirect when token is empty', () => {
      localStorage.setItem('tea-token', '');

      renderHook(() => useEnforceLogout());

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('should not redirect when token is null', () => {
      localStorage.setItem('tea-token', 'null');

      renderHook(() => useEnforceLogout());

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('should re-check token when it changes', () => {
      const { result: tokenResult } = renderHook(() => useLoginToken());
      renderHook(() => useEnforceLogout());

      // Initially should not redirect (no token)
      expect(mockReplace).not.toHaveBeenCalled();

      // Set a token
      act(() => {
        tokenResult.current[1]('new-token');
      });

      // Should redirect after token is set
      expect(mockReplace).toHaveBeenCalledWith('/');
    });

    it('should handle concurrent login/logout enforcement', () => {
      localStorage.setItem('tea-token', 'existing-token');

      // Both hooks should work independently
      renderHook(() => useEnforceLogin());
      renderHook(() => useEnforceLogout());

      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  describe('unauthorized function', () => {
    it('should sign out user and redirect to login', async () => {
      localStorage.setItem('tea-token', 'invalid-token');

      await unauthorized();

      expect(mockSignOut).toHaveBeenCalledWith({
        callbackUrl: '/login',
      });
      expect(localStorage.getItem('tea-token')).toBeNull();
    });

    it('should handle multiple unauthorized calls', async () => {
      localStorage.setItem('tea-token', 'invalid-token');

      await Promise.all([unauthorized(), unauthorized(), unauthorized()]);

      expect(mockSignOut).toHaveBeenCalledTimes(3);
      expect(localStorage.getItem('tea-token')).toBeNull();
    });

    it('should work when no token exists', async () => {
      await unauthorized();

      expect(mockSignOut).toHaveBeenCalledWith({
        callbackUrl: '/login',
      });
      expect(localStorage.getItem('tea-token')).toBeNull();
    });

    it('should handle signOut errors gracefully', async () => {
      mockSignOut.mockRejectedValueOnce(new Error('SignOut failed'));
      localStorage.setItem('tea-token', 'invalid-token');

      // Should not throw an error
      await expect(unauthorized()).resolves.toBeUndefined();

      // Token should still be removed
      expect(localStorage.getItem('tea-token')).toBeNull();
    });
  });

  describe('Integration tests', () => {
    it('should work together - login flow', async () => {
      // Start without token
      const { result: tokenResult } = renderHook(() => useLoginToken());
      renderHook(() => useEnforceLogin());

      expect(mockReplace).toHaveBeenCalledWith('/login');

      // User logs in
      act(() => {
        tokenResult.current[1]('login-token');
      });

      // Should stop redirecting
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it('should work together - logout flow', async () => {
      localStorage.setItem('tea-token', 'valid-token');
      const { result: tokenResult } = renderHook(() => useLoginToken());
      renderHook(() => useEnforceLogout());

      expect(mockReplace).toHaveBeenCalledWith('/');

      // User logs out
      act(() => {
        tokenResult.current[1](null);
      });

      // Should stop redirecting after logout
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it('should handle unauthorized during active session', async () => {
      localStorage.setItem('tea-token', 'valid-token');
      const { result: tokenResult } = renderHook(() => useLoginToken());
      renderHook(() => useEnforceLogin());

      // Initially authenticated
      expect(mockReplace).not.toHaveBeenCalled();

      // Server returns 401, trigger unauthorized
      await unauthorized();

      // Should clear token and trigger redirect
      expect(localStorage.getItem('tea-token')).toBeNull();
      expect(tokenResult.current[0]).toBeNull();
      expect(mockSignOut).toHaveBeenCalledWith({
        callbackUrl: '/login',
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle localStorage being disabled', () => {
      // Mock localStorage to throw
      const originalGetItem = localStorage.getItem;
      const originalSetItem = localStorage.setItem;
      const originalRemoveItem = localStorage.removeItem;

      localStorage.getItem = vi.fn(() => {
        throw new Error('localStorage disabled');
      });
      localStorage.setItem = vi.fn(() => {
        throw new Error('localStorage disabled');
      });
      localStorage.removeItem = vi.fn(() => {
        throw new Error('localStorage disabled');
      });

      const { result } = renderHook(() => useLoginToken());

      // Should not crash
      expect(result.current[0]).toBeNull();

      act(() => {
        result.current[1]('test-token');
      });

      // Should handle gracefully
      expect(result.current[0]).toBe('test-token');

      localStorage.getItem = originalGetItem;
      localStorage.setItem = originalSetItem;
      localStorage.removeItem = originalRemoveItem;
    });

    it('should handle corrupted localStorage data', () => {
      // Set invalid JSON in localStorage (simulate corruption)
      Object.defineProperty(localStorage, 'getItem', {
        value: vi.fn(() => '{invalid json}'),
        writable: true,
      });

      const { result } = renderHook(() => useLoginToken());

      // Should handle gracefully and return null for corrupted data
      expect(result.current[0]).toBeNull();
    });

    it('should handle browser memory pressure', () => {
      // Test rapid token changes (simulate memory pressure)
      const { result } = renderHook(() => useLoginToken());

      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current[1](`token-${i}`);
        }
      });

      expect(result.current[0]).toBe('token-999');
    });
  });
});
