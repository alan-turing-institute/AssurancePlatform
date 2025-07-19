import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../route';

// Mock the global fetch function
global.fetch = vi.fn();

describe('/api/published-assurance-cases API Route', () => {
  const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      API_URL: 'http://localhost:8000',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Authentication', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases'
      );

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.error).toBe('Unauthorized');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should pass Authorization header to backend API', async () => {
      const authToken = 'Bearer token123';
      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: {
            Authorization: authToken,
          },
        }
      );

      const mockResponseData = [
        {
          id: 1,
          name: 'Published Case 1',
          description: 'A published assurance case',
          published_date: '2024-01-01T00:00:00Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponseData,
      } as Response);

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual(mockResponseData);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/published-assurance-cases/',
        {
          headers: {
            Authorization: authToken,
            'Content-Type': 'application/json',
            Connection: 'close',
          },
          cache: 'no-store',
        }
      );
    });
  });

  describe('Successful Responses', () => {
    const authToken = 'Bearer valid-token';

    it('should return published assurance cases data', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: authToken },
        }
      );

      const mockData = [
        {
          id: 1,
          name: 'Safety Case for Autonomous Vehicle',
          description:
            'Comprehensive safety case for level 4 autonomous driving',
          published_date: '2024-01-15T10:30:00Z',
          case_study: 1,
        },
        {
          id: 2,
          name: 'Medical Device Safety Case',
          description: 'Safety assurance for medical monitoring device',
          published_date: '2024-02-01T14:20:00Z',
          case_study: 2,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual(mockData);
      expect(Array.isArray(responseData)).toBe(true);
      expect(responseData).toHaveLength(2);
    });

    it('should handle empty results', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: authToken },
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual([]);
      expect(Array.isArray(responseData)).toBe(true);
    });

    it('should preserve response structure from backend', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: authToken },
        }
      );

      const mockData = {
        results: [
          {
            id: 1,
            name: 'Test Case',
            description: 'Test Description',
            published_date: '2024-01-01T00:00:00Z',
          },
        ],
        count: 1,
        next: null,
        previous: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual(mockData);
      expect(responseData.results).toBeDefined();
      expect(responseData.count).toBe(1);
    });
  });

  describe('Error Handling', () => {
    const authToken = 'Bearer valid-token';

    it('should handle 404 from backend API', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: authToken },
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Not found' }),
      } as Response);

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.error).toBe('Failed to fetch');
    });

    it('should handle 403 Forbidden from backend API', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: 'Bearer invalid-token' },
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ detail: 'Forbidden' }),
      } as Response);

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(403);
      expect(responseData.error).toBe('Failed to fetch');
    });

    it('should handle 500 from backend API', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: authToken },
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal server error' }),
      } as Response);

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Failed to fetch');
    });

    it('should handle network errors', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: authToken },
        }
      );

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Internal server error');
    });

    it('should handle fetch timeout', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: authToken },
        }
      );

      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Internal server error');
    });
  });

  describe('Environment Configuration', () => {
    const authToken = 'Bearer valid-token';

    it('should use API_URL when available', async () => {
      process.env.API_URL = 'http://api.example.com';
      process.env.NEXT_PUBLIC_API_URL = 'http://public.example.com';

      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: authToken },
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api.example.com/api/published-assurance-cases/',
        expect.any(Object)
      );
    });

    it('should fallback to NEXT_PUBLIC_API_URL when API_URL is not set', async () => {
      process.env.API_URL = undefined;
      process.env.NEXT_PUBLIC_API_URL = 'http://public.example.com';

      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: authToken },
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://public.example.com/api/published-assurance-cases/',
        expect.any(Object)
      );
    });

    it('should handle missing environment variables gracefully', async () => {
      process.env.API_URL = undefined;
      process.env.NEXT_PUBLIC_API_URL = undefined;

      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: authToken },
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'undefined/api/published-assurance-cases/',
        expect.any(Object)
      );
    });
  });

  describe('Request Headers', () => {
    const authToken = 'Bearer valid-token';

    it('should set correct headers for backend request', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: authToken },
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            Authorization: authToken,
            'Content-Type': 'application/json',
            Connection: 'close',
          },
          cache: 'no-store',
        })
      );
    });

    it('should disable caching with no-store', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: authToken },
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cache: 'no-store',
        })
      );
    });
  });

  describe('Response Format', () => {
    const authToken = 'Bearer valid-token';

    it('should return JSON response with correct content type', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: authToken },
        }
      );

      const mockData = [{ id: 1, name: 'Test Case' }];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      const response = await GET(request);

      expect(response.headers.get('content-type')).toContain(
        'application/json'
      );
    });

    it('should preserve data types from backend response', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/published-assurance-cases',
        {
          headers: { Authorization: authToken },
        }
      );

      const mockData = [
        {
          id: 1,
          name: 'Test Case',
          published: true,
          created_at: '2024-01-01T00:00:00Z',
          view_count: 42,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      const response = await GET(request);
      const responseData = await response.json();

      expect(typeof responseData[0].id).toBe('number');
      expect(typeof responseData[0].name).toBe('string');
      expect(typeof responseData[0].published).toBe('boolean');
      expect(typeof responseData[0].view_count).toBe('number');
    });
  });
});
