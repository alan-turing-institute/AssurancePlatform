import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('authOptions', () => {
  beforeEach(() => {
    // Set up test environment variables
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret');
    vi.stubEnv('GITHUB_APP_CLIENT_ID', 'test-github-id');
    vi.stubEnv('GITHUB_APP_CLIENT_SECRET', 'test-github-secret');
    vi.stubEnv('API_URL', 'http://localhost:8000');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8000');
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Module structure', () => {
    it('should export authOptions object', async () => {
      const module = await import('../auth-options');
      expect(module.authOptions).toBeDefined();
      expect(typeof module.authOptions).toBe('object');
    });

    it('should have required configuration properties', async () => {
      const { authOptions } = await import('../auth-options');

      expect(authOptions).toHaveProperty('secret');
      expect(authOptions).toHaveProperty('session');
      expect(authOptions).toHaveProperty('providers');
      expect(authOptions).toHaveProperty('callbacks');
    });

    it('should have JWT session strategy', async () => {
      const { authOptions } = await import('../auth-options');

      expect(authOptions.session).toEqual({ strategy: 'jwt' });
    });

    it('should have providers array', async () => {
      const { authOptions } = await import('../auth-options');

      expect(Array.isArray(authOptions.providers)).toBe(true);
      expect(authOptions.providers.length).toBeGreaterThan(0);
    });

    it('should have all required callbacks', async () => {
      const { authOptions } = await import('../auth-options');

      expect(authOptions.callbacks).toBeDefined();
      expect(typeof authOptions.callbacks?.signIn).toBe('function');
      expect(typeof authOptions.callbacks?.redirect).toBe('function');
      expect(typeof authOptions.callbacks?.session).toBe('function');
      expect(typeof authOptions.callbacks?.jwt).toBe('function');
    });
  });

  describe('Callback functions', () => {
    it('should handle redirect callback with NEXTAUTH_URL', async () => {
      const { authOptions } = await import('../auth-options');

      const result = await authOptions.callbacks?.redirect?.({
        url: '/some-url',
        baseUrl: 'http://localhost:3000',
      });

      expect(result).toBe('http://localhost:3000/dashboard');
    });

    it('should handle redirect callback with baseUrl fallback', async () => {
      vi.stubEnv('NEXTAUTH_URL', '');

      const { authOptions } = await import('../auth-options');

      const result = await authOptions.callbacks?.redirect?.({
        url: '/some-url',
        baseUrl: 'http://fallback:3000',
      });

      expect(result).toBe('http://fallback:3000/dashboard');
    });

    it('should handle session callback', async () => {
      const { authOptions } = await import('../auth-options');

      const mockSession = {
        user: { name: 'Test User' },
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const mockToken = { key: 'session-token', provider: 'github' };

      const result = await authOptions.callbacks?.session?.({
        session: mockSession,
        token: mockToken,
        user: { id: 'user-id', email: 'test@example.com', emailVerified: null },
        newSession: {},
        trigger: 'update',
      });

      expect(result).toEqual({
        user: { name: 'Test User' },
        expires: expect.any(String),
        key: 'session-token',
        provider: 'github',
      });
    });

    it('should handle jwt callback for new user', async () => {
      const { authOptions } = await import('../auth-options');

      const mockToken = {};
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        key: 'user-token',
        provider: 'github',
      };

      const result = await authOptions.callbacks?.jwt?.({
        token: mockToken,
        user: mockUser,
        account: null,
      });

      expect(result).toEqual({
        key: 'user-token',
        provider: 'github',
      });
    });

    it('should handle jwt callback for existing token', async () => {
      const { authOptions } = await import('../auth-options');

      const mockToken = {
        key: 'existing-token',
        provider: 'credentials',
        sub: 'user-id',
      };

      const result = await authOptions.callbacks?.jwt?.({
        token: mockToken,
        user: { id: 'user-id', email: 'test@example.com', emailVerified: null },
        account: null,
      });

      expect(result).toEqual(mockToken);
    });

    it('should handle signIn callback for non-GitHub providers', async () => {
      const { authOptions } = await import('../auth-options');

      const result = await authOptions.callbacks?.signIn?.({
        user: { id: '1', email: 'test@example.com' },
        account: {
          provider: 'credentials',
          providerAccountId: '1',
          type: 'credentials',
        },
        profile: undefined,
        email: { verificationRequest: false },
        credentials: undefined,
      });

      expect(result).toBe(true);
    });

    it('should reject signIn when user is falsy', async () => {
      const { authOptions } = await import('../auth-options');

      const result = await authOptions.callbacks?.signIn?.({
        user: { id: '', email: 'test@example.com', emailVerified: null },
        account: {
          provider: 'credentials',
          providerAccountId: '1',
          type: 'credentials',
        },
        profile: undefined,
        email: { verificationRequest: false },
        credentials: undefined,
      });

      expect(result).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle missing environment variables gracefully', () => {
      vi.stubEnv('NEXTAUTH_SECRET', '');
      vi.stubEnv('GITHUB_APP_CLIENT_ID', '');
      vi.stubEnv('GITHUB_APP_CLIENT_SECRET', '');

      expect(async () => {
        await import('../auth-options');
      }).not.toThrow();
    });

    it('should handle redirect error when no base URL available', async () => {
      vi.stubEnv('NEXTAUTH_URL', '');

      const { authOptions } = await import('../auth-options');

      await expect(
        authOptions.callbacks?.redirect?.({
          url: '/some-url',
          baseUrl: '',
        } as { url: string; baseUrl: string })
      ).rejects.toThrow(
        'NEXTAUTH_URL must be configured for authentication redirects'
      );
    });

    it('should handle missing API URL for GitHub auth', async () => {
      vi.stubEnv('API_URL', '');
      vi.stubEnv('NEXT_PUBLIC_API_URL', '');

      const { authOptions } = await import('../auth-options');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Empty implementation for test
      });

      const result = await authOptions.callbacks?.signIn?.({
        user: { id: '1' },
        account: {
          provider: 'github',
          access_token: 'token',
          providerAccountId: '1',
          type: 'oauth',
        },
        profile: { email: 'test@github.com' },
        email: { verificationRequest: false },
        credentials: undefined,
      });

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'API_URL or NEXT_PUBLIC_API_URL must be configured for GitHub authentication'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Configuration flexibility', () => {
    it('should handle different provider configurations', async () => {
      const { authOptions } = await import('../auth-options');

      // Should handle providers being defined without errors
      expect(authOptions.providers).toBeDefined();
      expect(authOptions.providers.length).toBeGreaterThanOrEqual(1);
    });

    it('should use environment variable for secret', async () => {
      const { authOptions } = await import('../auth-options');

      expect(authOptions.secret).toBe('test-secret');
    });

    it('should handle API URL fallback logic', () => {
      // Test API_URL priority
      expect(process.env.API_URL).toBe('http://localhost:8000');

      vi.stubEnv('API_URL', '');
      expect(process.env.NEXT_PUBLIC_API_URL).toBe('http://localhost:8000');
    });
  });

  describe('Integration tests', () => {
    it('should support complete auth flow structure', async () => {
      const { authOptions } = await import('../auth-options');

      // Verify the complete structure needed for NextAuth
      expect(authOptions).toMatchObject({
        secret: expect.any(String),
        session: { strategy: 'jwt' },
        providers: expect.any(Array),
        callbacks: {
          signIn: expect.any(Function),
          redirect: expect.any(Function),
          session: expect.any(Function),
          jwt: expect.any(Function),
        },
      });
    });

    it('should handle session transformation correctly', async () => {
      const { authOptions } = await import('../auth-options');

      const testSession = {
        user: { id: '1', name: 'Test' },
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const testToken = { key: 'test-key', provider: 'test-provider' };

      const sessionResult = await authOptions.callbacks?.session?.({
        session: testSession,
        token: testToken,
        user: { id: 'user-id', email: 'test@example.com', emailVerified: null },
        newSession: {},
        trigger: 'update',
      });

      expect(sessionResult).toEqual({
        user: { id: '1', name: 'Test' },
        expires: expect.any(String),
        key: 'test-key',
        provider: 'test-provider',
      });
    });

    it('should handle JWT token flow correctly', async () => {
      const { authOptions } = await import('../auth-options');

      // Test initial JWT creation
      const initialJWT = await authOptions.callbacks?.jwt?.({
        token: {},
        user: {
          id: 'user-id',
          email: 'test@example.com',
          key: 'new-key',
          provider: 'new-provider',
        },
        account: null,
      });

      expect(initialJWT).toEqual({
        key: 'new-key',
        provider: 'new-provider',
      });

      // Test JWT persistence
      const persistedJWT = await authOptions.callbacks?.jwt?.({
        token: initialJWT || {},
        user: { id: 'user-id', email: 'test@example.com', emailVerified: null },
        account: null,
      });

      expect(persistedJWT).toEqual(initialJWT);
    });
  });
});
