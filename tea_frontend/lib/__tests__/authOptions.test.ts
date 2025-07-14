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
      const module = await import('../authOptions');
      expect(module.authOptions).toBeDefined();
      expect(typeof module.authOptions).toBe('object');
    });

    it('should have required configuration properties', async () => {
      const { authOptions } = await import('../authOptions');

      expect(authOptions).toHaveProperty('secret');
      expect(authOptions).toHaveProperty('session');
      expect(authOptions).toHaveProperty('providers');
      expect(authOptions).toHaveProperty('callbacks');
    });

    it('should have JWT session strategy', async () => {
      const { authOptions } = await import('../authOptions');

      expect(authOptions.session).toEqual({ strategy: 'jwt' });
    });

    it('should have providers array', async () => {
      const { authOptions } = await import('../authOptions');

      expect(Array.isArray(authOptions.providers)).toBe(true);
      expect(authOptions.providers.length).toBeGreaterThan(0);
    });

    it('should have all required callbacks', async () => {
      const { authOptions } = await import('../authOptions');

      expect(authOptions.callbacks).toBeDefined();
      expect(typeof authOptions.callbacks!.signIn).toBe('function');
      expect(typeof authOptions.callbacks!.redirect).toBe('function');
      expect(typeof authOptions.callbacks!.session).toBe('function');
      expect(typeof authOptions.callbacks!.jwt).toBe('function');
    });
  });

  describe('Callback functions', () => {
    it('should handle redirect callback with NEXTAUTH_URL', async () => {
      const { authOptions } = await import('../authOptions');

      const result = await authOptions.callbacks?.redirect?.({
        url: '/some-url',
        baseUrl: 'http://localhost:3000',
      } as any);

      expect(result).toBe('http://localhost:3000/dashboard');
    });

    it('should handle redirect callback with baseUrl fallback', async () => {
      vi.stubEnv('NEXTAUTH_URL', '');

      const { authOptions } = await import('../authOptions');

      const result = await authOptions.callbacks?.redirect?.({
        url: '/some-url',
        baseUrl: 'http://fallback:3000',
      } as any);

      expect(result).toBe('http://fallback:3000/dashboard');
    });

    it('should handle session callback', async () => {
      const { authOptions } = await import('../authOptions');

      const mockSession = { user: { name: 'Test User' } };
      const mockToken = { key: 'session-token', provider: 'github' };

      const result = await authOptions.callbacks?.session?.({
        session: mockSession,
        user: undefined,
        token: mockToken,
      } as any);

      expect(result).toEqual({
        user: { name: 'Test User' },
        key: 'session-token',
        provider: 'github',
      });
    });

    it('should handle jwt callback for new user', async () => {
      const { authOptions } = await import('../authOptions');

      const mockToken = {};
      const mockUser = { key: 'user-token', provider: 'github' };

      const result = await authOptions.callbacks?.jwt?.({
        token: mockToken,
        user: mockUser,
        account: undefined,
        profile: undefined,
        isNewUser: undefined,
      } as any);

      expect(result).toEqual({
        key: 'user-token',
        provider: 'github',
      });
    });

    it('should handle jwt callback for existing token', async () => {
      const { authOptions } = await import('../authOptions');

      const mockToken = {
        key: 'existing-token',
        provider: 'credentials',
        sub: 'user-id',
      };

      const result = await authOptions.callbacks?.jwt?.({
        token: mockToken,
        user: undefined,
        account: undefined,
        profile: undefined,
        isNewUser: undefined,
      } as any);

      expect(result).toEqual(mockToken);
    });

    it('should handle signIn callback for non-GitHub providers', async () => {
      const { authOptions } = await import('../authOptions');

      const result = await authOptions.callbacks?.signIn?.({
        user: { id: '1', email: 'test@example.com' },
        account: { provider: 'credentials' },
        profile: undefined,
        email: 'test@example.com',
        credentials: undefined,
      } as any);

      expect(result).toBe(true);
    });

    it('should reject signIn when user is null', async () => {
      const { authOptions } = await import('../authOptions');

      const result = await authOptions.callbacks?.signIn?.({
        user: null,
        account: { provider: 'credentials' },
        profile: undefined,
        email: 'test@example.com',
        credentials: undefined,
      } as any);

      expect(result).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle missing environment variables gracefully', async () => {
      vi.stubEnv('NEXTAUTH_SECRET', '');
      vi.stubEnv('GITHUB_APP_CLIENT_ID', '');
      vi.stubEnv('GITHUB_APP_CLIENT_SECRET', '');

      expect(async () => {
        await import('../authOptions');
      }).not.toThrow();
    });

    it('should handle redirect error when no base URL available', async () => {
      vi.stubEnv('NEXTAUTH_URL', '');

      const { authOptions } = await import('../authOptions');

      await expect(
        authOptions.callbacks?.redirect?.({
          url: '/some-url',
          baseUrl: '',
        } as any)
      ).rejects.toThrow(
        'NEXTAUTH_URL must be configured for authentication redirects'
      );
    });

    it('should handle missing API URL for GitHub auth', async () => {
      vi.stubEnv('API_URL', '');
      vi.stubEnv('NEXT_PUBLIC_API_URL', '');

      const { authOptions } = await import('../authOptions');

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = await authOptions.callbacks?.signIn?.({
        user: { id: '1' },
        account: { provider: 'github', access_token: 'token' },
        profile: { email: 'test@github.com' },
        email: 'test@github.com',
        credentials: undefined,
      } as any);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'API_URL or NEXT_PUBLIC_API_URL must be configured for GitHub authentication'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Configuration flexibility', () => {
    it('should handle different provider configurations', async () => {
      const { authOptions } = await import('../authOptions');

      // Should handle providers being defined without errors
      expect(authOptions.providers).toBeDefined();
      expect(authOptions.providers.length).toBeGreaterThanOrEqual(1);
    });

    it('should use environment variable for secret', async () => {
      const { authOptions } = await import('../authOptions');

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
      const { authOptions } = await import('../authOptions');

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
      const { authOptions } = await import('../authOptions');

      const testSession = { user: { id: '1', name: 'Test' } };
      const testToken = { key: 'test-key', provider: 'test-provider' };

      const sessionResult = await authOptions.callbacks?.session?.({
        session: testSession,
        token: testToken,
        user: undefined,
      } as any);

      expect(sessionResult).toEqual({
        user: { id: '1', name: 'Test' },
        key: 'test-key',
        provider: 'test-provider',
      });
    });

    it('should handle JWT token flow correctly', async () => {
      const { authOptions } = await import('../authOptions');

      // Test initial JWT creation
      const initialJWT = await authOptions.callbacks?.jwt?.({
        token: {},
        user: { key: 'new-key', provider: 'new-provider' },
        account: undefined,
        profile: undefined,
        isNewUser: undefined,
      } as any);

      expect(initialJWT).toEqual({
        key: 'new-key',
        provider: 'new-provider',
      });

      // Test JWT persistence
      const persistedJWT = await authOptions.callbacks?.jwt?.({
        token: initialJWT,
        user: undefined,
        account: undefined,
        profile: undefined,
        isNewUser: undefined,
      } as any);

      expect(persistedJWT).toEqual(initialJWT);
    });
  });
});
