import { HttpResponse, http } from 'msw';

// Mock API base URL (should match your backend)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const handlers = [
  // Authentication endpoints
  http.post(`${API_BASE_URL}/api/auth/login/`, () => {
    return HttpResponse.json({
      user: {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
      },
      token: 'mock-jwt-token',
    });
  }),

  http.post(`${API_BASE_URL}/api/auth/register/`, () => {
    return HttpResponse.json({
      user: {
        id: 2,
        username: 'newuser',
        email: 'new@example.com',
        first_name: 'New',
        last_name: 'User',
      },
      token: 'mock-jwt-token',
    });
  }),

  http.get(`${API_BASE_URL}/api/auth/user/`, () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
    });
  }),

  // Assurance Cases endpoints
  http.get(`${API_BASE_URL}/api/cases/`, () => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'Test Assurance Case',
        description: 'A test case for testing',
        created_date: '2024-01-01T00:00:00Z',
        owner: 1,
        view_groups: [],
        edit_groups: [],
        review_groups: [],
      },
    ]);
  }),

  http.get(`${API_BASE_URL}/api/cases/:id/`, ({ params }) => {
    return HttpResponse.json({
      id: Number.parseInt(params.id as string, 10),
      name: 'Test Assurance Case',
      description: 'A test case for testing',
      created_date: '2024-01-01T00:00:00Z',
      owner: 1,
      view_groups: [],
      edit_groups: [],
      review_groups: [],
      goals: [],
      property_claims: [],
      evidence: [],
      contexts: [],
      strategies: [],
    });
  }),

  http.post(`${API_BASE_URL}/api/cases/`, () => {
    return HttpResponse.json(
      {
        id: 3,
        name: 'New Test Case',
        description: 'Newly created test case',
        created_date: new Date().toISOString(),
        owner: 1,
        view_groups: [],
        edit_groups: [],
        review_groups: [],
      },
      { status: 201 }
    );
  }),

  // Comments endpoints
  http.get(`${API_BASE_URL}/api/comments/`, () => {
    return HttpResponse.json([]);
  }),

  http.post(`${API_BASE_URL}/api/comments/`, () => {
    return HttpResponse.json(
      {
        id: 1,
        content: 'Test comment',
        author: 1,
        created_date: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // Users endpoints
  http.get(`${API_BASE_URL}/api/users/`, () => {
    return HttpResponse.json([
      {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
      },
    ]);
  }),

  // Templates endpoint
  http.get('/api/templates', () => {
    return HttpResponse.json([
      {
        id: 'minimal',
        name: 'Minimal Template',
        description: 'A minimal assurance case template',
      },
    ]);
  }),

  // Public API endpoints
  http.get(`${API_BASE_URL}/api/public/published-cases/`, () => {
    return HttpResponse.json([]);
  }),

  // GitHub integration
  http.get(`${API_BASE_URL}/api/github/repositories/`, () => {
    return HttpResponse.json([]);
  }),

  // Fallback for unhandled requests
  http.all('*', ({ request }) => {
    return new HttpResponse(null, { status: 404 });
  }),
];
