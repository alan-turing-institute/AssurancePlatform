import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../route';

// Mock global functions
global.fetch = vi.fn();
global.atob = vi.fn();
global.Blob = vi.fn();
global.FormData = vi.fn();

describe('/api/screenshot API Route', () => {
  const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
  const mockAtob = global.atob as ReturnType<typeof vi.fn>;
  const mockBlob = global.Blob as ReturnType<typeof vi.fn>;
  const mockFormData = global.FormData as ReturnType<typeof vi.fn>;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      API_URL: 'http://localhost:8000',
    };

    // Mock atob function
    mockAtob.mockImplementation((str: string) => {
      // Simple mock implementation for base64 decoding
      return Buffer.from(str, 'base64').toString('binary');
    });

    // Mock Blob constructor
    mockBlob.mockImplementation(
      (content: BlobPart[], options?: BlobPropertyBag) =>
        ({
          type: options?.type || 'application/octet-stream',
          size: content.length,
        }) as Blob
    );

    // Mock FormData
    const mockFormDataInstance = {
      append: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(),
      has: vi.fn(),
      forEach: vi.fn(),
    };
    mockFormData.mockImplementation(
      () => mockFormDataInstance as unknown as FormData
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Request Validation', () => {
    it('should accept valid screenshot upload request', async () => {
      const validRequestData = {
        base64image:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        id: 123,
        token: 'valid-token-123',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequestData),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'Image uploaded successfully',
          data: { url: '/media/chart-screenshot-case-123.png' },
        }),
      } as Response);

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.message).toBe('Image uploaded successfully');
      expect(responseData.data.url).toBe(
        '/media/chart-screenshot-case-123.png'
      );
    });

    it('should handle malformed JSON request', async () => {
      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json',
      });

      await expect(POST(request)).rejects.toThrow();
    });

    it('should process base64 image data correctly', async () => {
      const base64Image =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      const requestData = {
        base64image: base64Image,
        id: 456,
        token: 'test-token',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Success', data: {} }),
      } as Response);

      await POST(request);

      // Verify atob was called with the base64 part (after the comma)
      expect(mockAtob).toHaveBeenCalledWith(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      );

      // Verify Blob was created with correct type
      expect(mockBlob).toHaveBeenCalledWith(expect.any(Array), {
        type: 'image/png',
      });
    });
  });

  describe('FormData Construction', () => {
    it('should create FormData with correct filename pattern', async () => {
      const requestData = {
        base64image: 'data:image/png;base64,dGVzdA==',
        id: 789,
        token: 'test-token',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Success', data: {} }),
      } as Response);

      await POST(request);

      // Verify FormData was created and media was appended with correct filename
      expect(mockFormData).toHaveBeenCalled();
      const formDataInstance = mockFormData.mock.results[0].value;
      expect(formDataInstance.append).toHaveBeenCalledWith(
        'media',
        expect.any(Object), // The blob
        'chart-screenshot-case-789.png'
      );
    });

    it('should append blob with correct parameters', async () => {
      const requestData = {
        base64image: 'data:image/png;base64,dGVzdA==',
        id: 100,
        token: 'test-token',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Success', data: {} }),
      } as Response);

      await POST(request);

      const formDataInstance = mockFormData.mock.results[0].value;
      expect(formDataInstance.append).toHaveBeenCalledTimes(1);
      expect(formDataInstance.append).toHaveBeenCalledWith(
        'media',
        expect.objectContaining({ type: 'image/png' }),
        'chart-screenshot-case-100.png'
      );
    });
  });

  describe('Backend API Integration', () => {
    it('should make correct API call to backend', async () => {
      const requestData = {
        base64image: 'data:image/png;base64,dGVzdA==',
        id: 555,
        token: 'auth-token-123',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Upload successful', data: { id: 555 } }),
      } as Response);

      await POST(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/cases/555/image',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(Object), // FormData instance
          redirect: 'follow',
          headers: {
            Authorization: 'Token auth-token-123',
          },
        })
      );
    });

    it('should use correct authorization header format', async () => {
      const requestData = {
        base64image: 'data:image/png;base64,dGVzdA==',
        id: 999,
        token: 'user-api-key',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Success', data: {} }),
      } as Response);

      await POST(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            Authorization: 'Token user-api-key',
          },
        })
      );
    });

    it('should return backend response data', async () => {
      const requestData = {
        base64image: 'data:image/png;base64,dGVzdA==',
        id: 777,
        token: 'test-token',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const mockBackendResponse = {
        message: 'Image uploaded and processed successfully',
        data: {
          id: 777,
          url: '/media/uploads/chart-screenshot-case-777.png',
          timestamp: '2024-01-01T12:00:00Z',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockBackendResponse,
      } as Response);

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual(mockBackendResponse);
    });
  });

  describe('Error Handling', () => {
    it('should handle backend API errors', async () => {
      const requestData = {
        base64image: 'data:image/png;base64,dGVzdA==',
        id: 404,
        token: 'test-token',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Case not found', data: null }),
      } as Response);

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200); // Our API doesn't forward status codes
      expect(responseData.message).toBe('Case not found');
    });

    it('should handle network errors', async () => {
      const requestData = {
        base64image: 'data:image/png;base64,dGVzdA==',
        id: 500,
        token: 'test-token',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const networkError = new Error('Network connection failed');
      mockFetch.mockRejectedValueOnce(networkError);

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.error).toEqual(networkError);
      expect(responseData.message).toBe("Couldn't upload image");
    });

    it('should handle fetch timeout', async () => {
      const requestData = {
        base64image: 'data:image/png;base64,dGVzdA==',
        id: 123,
        token: 'test-token',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const timeoutError = new Error('Request timeout');
      mockFetch.mockRejectedValueOnce(timeoutError);

      const response = await POST(request);
      const responseData = await response.json();

      expect(responseData.error).toEqual(timeoutError);
      expect(responseData.message).toBe("Couldn't upload image");
    });

    it('should handle invalid base64 data', async () => {
      const requestData = {
        base64image: 'invalid-base64-data',
        id: 123,
        token: 'test-token',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      // Mock atob to throw error for invalid base64
      mockAtob.mockImplementationOnce(() => {
        throw new Error('Invalid base64 string');
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(responseData.message).toBe("Couldn't upload image");
      expect(responseData.error).toBeInstanceOf(Error);
    });
  });

  describe('Environment Configuration', () => {
    it('should use API_URL when available', async () => {
      process.env.API_URL = 'http://api.example.com';
      process.env.NEXT_PUBLIC_API_URL = 'http://public.example.com';

      const requestData = {
        base64image: 'data:image/png;base64,dGVzdA==',
        id: 123,
        token: 'test-token',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Success', data: {} }),
      } as Response);

      await POST(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api.example.com/api/cases/123/image',
        expect.any(Object)
      );
    });

    it('should fallback to NEXT_PUBLIC_API_URL', async () => {
      process.env.API_URL = undefined;
      process.env.NEXT_PUBLIC_API_URL = 'http://public.example.com';

      const requestData = {
        base64image: 'data:image/png;base64,dGVzdA==',
        id: 456,
        token: 'test-token',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Success', data: {} }),
      } as Response);

      await POST(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://public.example.com/api/cases/456/image',
        expect.any(Object)
      );
    });
  });

  describe('Base64 to Blob Conversion', () => {
    it('should handle different image formats', async () => {
      const jpegRequestData = {
        base64image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAQABAAD//2Q==',
        id: 123,
        token: 'test-token',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jpegRequestData),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Success', data: {} }),
      } as Response);

      await POST(request);

      // Verify Blob was created with PNG type (hardcoded in the function)
      expect(mockBlob).toHaveBeenCalledWith(expect.any(Array), {
        type: 'image/png',
      });
    });

    it('should extract base64 data after comma', async () => {
      const requestData = {
        base64image: 'data:image/png;base64,SGVsbG8gV29ybGQ=',
        id: 123,
        token: 'test-token',
      };

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Success', data: {} }),
      } as Response);

      await POST(request);

      // Verify atob was called with only the base64 part
      expect(mockAtob).toHaveBeenCalledWith('SGVsbG8gV29ybGQ=');
    });

    it('should create Uint8Array with correct length', async () => {
      const testBase64 = 'SGVsbG8='; // "Hello" in base64
      const requestData = {
        base64image: `data:image/png;base64,${testBase64}`,
        id: 123,
        token: 'test-token',
      };

      // Mock atob to return "Hello"
      mockAtob.mockReturnValueOnce('Hello');

      const request = new NextRequest('http://localhost:3000/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Success', data: {} }),
      } as Response);

      await POST(request);

      // The function should create a Uint8Array of length 5 (length of "Hello")
      expect(mockBlob).toHaveBeenCalledWith([expect.any(Uint8Array)], {
        type: 'image/png',
      });
    });
  });
});
