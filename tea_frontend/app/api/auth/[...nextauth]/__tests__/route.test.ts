import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '../route';

// Mock NextAuth
const mockNextAuth = vi.fn();
vi.mock('next-auth', () => mockNextAuth);

// Mock auth options
const mockAuthOptions = {
  secret: 'test-secret',
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {},
};
vi.mock('@/lib/auth-options', () => ({
  authOptions: mockAuthOptions,
}));

describe('/api/auth/[...nextauth] API Route', () => {
  const mockHandler = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNextAuth.mockReturnValue(mockHandler);
  });

  describe('NextAuth Configuration', () => {
    it('should initialize NextAuth with correct auth options', () => {
      // Import the route file to trigger NextAuth initialization
      require('../route');

      expect(mockNextAuth).toHaveBeenCalledWith(mockAuthOptions);
    });

    it('should export NextAuth handler as GET', () => {
      expect(GET).toBe(mockHandler);
    });

    it('should export NextAuth handler as POST', () => {
      expect(POST).toBe(mockHandler);
    });
  });

  describe('HTTP Methods', () => {
    it('should handle GET requests through NextAuth', async () => {
      const mockRequest = new Request('http://localhost:3000/api/auth/signin', {
        method: 'GET',
      });

      mockHandler.mockResolvedValue(
        new Response(JSON.stringify({ signInPage: true }), { status: 200 })
      );

      const response = await GET(mockRequest);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest);
      expect(response.status).toBe(200);
    });

    it('should handle POST requests through NextAuth', async () => {
      const mockRequest = new Request('http://localhost:3000/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'testpass',
        }),
      });

      mockHandler.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const response = await POST(mockRequest);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest);
      expect(response.status).toBe(200);
    });

    it('should handle authentication errors gracefully', async () => {
      const mockRequest = new Request('http://localhost:3000/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'invalid',
          password: 'invalid',
        }),
      });

      mockHandler.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
        })
      );

      const response = await POST(mockRequest);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest);
      expect(response.status).toBe(401);
    });
  });

  describe('Route Configuration Validation', () => {
    it('should properly configure NextAuth with all required options', () => {
      // Verify NextAuth was called with the imported auth options
      expect(mockNextAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: expect.any(String),
          session: expect.objectContaining({
            strategy: 'jwt',
          }),
          providers: expect.any(Array),
          callbacks: expect.any(Object),
        })
      );
    });

    it('should maintain handler consistency between GET and POST', () => {
      expect(GET).toBe(POST);
      expect(typeof GET).toBe('function');
      expect(typeof POST).toBe('function');
    });
  });

  describe('NextAuth Integration', () => {
    it('should pass through NextAuth response headers', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/auth/session',
        {
          method: 'GET',
        }
      );

      const mockResponse = new Response(
        JSON.stringify({ session: { user: { name: 'Test User' } } }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'next-auth.session-token=abc123; Path=/; HttpOnly',
          },
        }
      );

      mockHandler.mockResolvedValue(mockResponse);

      const response = await GET(mockRequest);

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Set-Cookie')).toContain(
        'next-auth.session-token'
      );
    });

    it('should handle NextAuth callback routes', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/auth/callback/github',
        {
          method: 'GET',
        }
      );

      mockHandler.mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { Location: '/dashboard' },
        })
      );

      const response = await GET(mockRequest);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest);
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/dashboard');
    });

    it('should handle NextAuth CSRF protection', async () => {
      const mockRequest = new Request('http://localhost:3000/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csrfToken: 'invalid-csrf-token',
          username: 'testuser',
          password: 'testpass',
        }),
      });

      mockHandler.mockResolvedValue(
        new Response(JSON.stringify({ error: 'CSRF token mismatch' }), {
          status: 400,
        })
      );

      const response = await POST(mockRequest);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error).toBe('CSRF token mismatch');
    });
  });

  describe('Error Handling', () => {
    it('should handle NextAuth initialization errors', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockNextAuth.mockImplementation(() => {
        throw new Error('NextAuth configuration error');
      });

      expect(() => {
        vi.resetModules();
        require('../route');
      }).toThrow('NextAuth configuration error');

      consoleSpy.mockRestore();
    });

    it('should handle runtime errors in NextAuth handler', async () => {
      const mockRequest = new Request('http://localhost:3000/api/auth/signin', {
        method: 'POST',
      });

      mockHandler.mockRejectedValue(new Error('Internal server error'));

      await expect(POST(mockRequest)).rejects.toThrow('Internal server error');
    });
  });
});
