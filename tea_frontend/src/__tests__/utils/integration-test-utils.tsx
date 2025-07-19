import {
  type RenderResult,
  waitFor as rtlWaitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Session } from 'next-auth';
import type React from 'react';
import { expect, vi } from 'vitest';
import { server } from '../mocks/server';
import { render, renderWithAuth } from './test-utils';

// Mock router for navigation testing
export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
};

// Mock search params
export const mockSearchParams = new URLSearchParams() as unknown as ReturnType<
  typeof useSearchParams
>;

// Setup navigation mocks
export const setupNavigationMocks = () => {
  vi.mocked(useRouter).mockReturnValue(mockRouter as any);
  vi.mocked(useSearchParams).mockReturnValue(mockSearchParams);
};

// Helper for multi-page navigation flows
export class NavigationFlow {
  private currentPath = '/';
  private history: string[] = [];

  constructor(initialPath = '/') {
    this.currentPath = initialPath;
    this.history.push(initialPath);
  }

  async navigateTo(path: string) {
    this.history.push(path);
    this.currentPath = path;
    mockRouter.push(path);

    // Simulate navigation delay
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async goBack() {
    if (this.history.length > 1) {
      this.history.pop();
      this.currentPath = this.history[this.history.length - 1];
      mockRouter.back();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  getCurrentPath() {
    return this.currentPath;
  }

  getHistory() {
    return [...this.history];
  }

  reset() {
    this.currentPath = '/';
    this.history = ['/'];
    vi.clearAllMocks();
  }
}

// Helper for complete auth flows
export class AuthFlow {
  private session: Session | null = null;
  private user = userEvent.setup();

  async login(email: string, password: string, component: React.ReactElement) {
    const { getByLabelText, getByRole } = render(component);

    // Fill in login form
    const emailInput = getByLabelText(/email/i);
    const passwordInput = getByLabelText(/password/i);
    const submitButton = getByRole('button', { name: /sign in/i });

    await this.user.type(emailInput, email);
    await this.user.type(passwordInput, password);
    await this.user.click(submitButton);

    // Wait for authentication to complete
    await rtlWaitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
    });

    // Update session
    this.session = {
      user: {
        email,
        name: 'Test User',
        image: null,
      },
      expires: '2025-12-31',
    } as any;

    return this.session;
  }

  async logout() {
    // Simulate logout API call
    server.use(
      http.post('/api/auth/logout', () => {
        return new Response(null, { status: 200 });
      })
    );

    this.session = null;
    mockRouter.push('/login');
  }

  async register(
    email: string,
    password: string,
    name: string,
    component: React.ReactElement
  ) {
    const { getByLabelText, getByRole } = render(component);

    // Fill in registration form
    const nameInput = getByLabelText(/name/i);
    const emailInput = getByLabelText(/email/i);
    const passwordInput = getByLabelText(/password/i);
    const confirmPasswordInput = getByLabelText(/confirm password/i);
    const submitButton = getByRole('button', { name: /sign up/i });

    await this.user.type(nameInput, name);
    await this.user.type(emailInput, email);
    await this.user.type(passwordInput, password);
    await this.user.type(confirmPasswordInput, password);
    await this.user.click(submitButton);

    // Wait for registration to complete
    await rtlWaitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
    });

    // Update session
    this.session = {
      user: {
        email,
        name,
        image: null,
      },
      expires: '2025-12-31',
    } as any;

    return this.session;
  }

  getSession() {
    return this.session;
  }

  isAuthenticated() {
    return this.session !== null;
  }
}

// Helper for API state management in tests
export class ApiStateManager {
  private apiResponses: Map<string, any> = new Map();
  private apiErrors: Map<string, Error> = new Map();

  setResponse(endpoint: string, response: any) {
    this.apiResponses.set(endpoint, response);

    // Setup MSW handler
    server.use(
      http.get(endpoint, () => {
        return Response.json(response);
      })
    );
  }

  setError(
    endpoint: string,
    error: Error | { status: number; message: string }
  ) {
    this.apiErrors.set(
      endpoint,
      error instanceof Error ? error : new Error(error.message)
    );

    // Setup MSW handler for error
    server.use(
      http.get(endpoint, () => {
        if ('status' in error) {
          return new Response(JSON.stringify({ message: error.message }), {
            status: error.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(null, { status: 500 });
      })
    );
  }

  clearAll() {
    this.apiResponses.clear();
    this.apiErrors.clear();
    server.resetHandlers();
  }

  getResponse(endpoint: string) {
    return this.apiResponses.get(endpoint);
  }

  hasError(endpoint: string) {
    return this.apiErrors.has(endpoint);
  }
}

// Helper for waiting for async operations with better error messages
export async function waitForAsync(
  callback: () => void | Promise<void>,
  options: {
    timeout?: number;
    interval?: number;
    errorMessage?: string;
  } = {}
) {
  const {
    timeout = 5000,
    interval = 50,
    errorMessage = 'Async operation timed out',
  } = options;

  try {
    await rtlWaitFor(callback, { timeout, interval });
  } catch (error) {
    throw new Error(
      `${errorMessage}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Helper for simulating user interactions across pages
export class UserJourney {
  private user = userEvent.setup();
  private navigation: NavigationFlow;
  private auth: AuthFlow;
  private apiState: ApiStateManager;
  private currentRender: RenderResult | null = null;

  constructor() {
    this.navigation = new NavigationFlow();
    this.auth = new AuthFlow();
    this.apiState = new ApiStateManager();
  }

  async startAt(
    component: React.ReactElement,
    options?: { authenticated?: boolean }
  ) {
    setupNavigationMocks();

    if (options?.authenticated) {
      this.currentRender = renderWithAuth(component);
    } else {
      this.currentRender = render(component);
    }

    return this.currentRender;
  }

  async click(element: Element | string) {
    if (!this.currentRender) {
      throw new Error('No component rendered. Call startAt() first.');
    }

    const target =
      typeof element === 'string'
        ? this.currentRender.getByRole('button', {
            name: new RegExp(element, 'i'),
          })
        : element;

    await this.user.click(target);
  }

  async type(element: Element | string, text: string) {
    if (!this.currentRender) {
      throw new Error('No component rendered. Call startAt() first.');
    }

    const target =
      typeof element === 'string'
        ? this.currentRender.getByLabelText(new RegExp(element, 'i'))
        : element;

    await this.user.type(target, text);
  }

  async select(element: Element | string, value: string) {
    if (!this.currentRender) {
      throw new Error('No component rendered. Call startAt() first.');
    }

    const target =
      typeof element === 'string'
        ? this.currentRender.getByLabelText(new RegExp(element, 'i'))
        : element;

    await this.user.selectOptions(target, value);
  }

  async upload(element: Element | string, file: File) {
    if (!this.currentRender) {
      throw new Error('No component rendered. Call startAt() first.');
    }

    const target =
      typeof element === 'string'
        ? this.currentRender.getByLabelText(new RegExp(element, 'i'))
        : element;

    await this.user.upload(target as HTMLElement, file);
  }

  async waitForElement(testId: string | RegExp) {
    if (!this.currentRender) {
      throw new Error('No component rendered. Call startAt() first.');
    }

    await rtlWaitFor(() => {
      this.currentRender!.getByTestId(testId);
    });
  }

  async waitForText(text: string | RegExp) {
    if (!this.currentRender) {
      throw new Error('No component rendered. Call startAt() first.');
    }

    await rtlWaitFor(() => {
      this.currentRender!.getByText(text);
    });
  }

  getNavigation() {
    return this.navigation;
  }

  getAuth() {
    return this.auth;
  }

  getApiState() {
    return this.apiState;
  }

  cleanup() {
    this.navigation.reset();
    this.apiState.clearAll();
    this.currentRender = null;
    vi.clearAllMocks();
  }
}

// Helper for testing WebSocket connections
export class WebSocketTestHelper {
  private mockSocket: any;
  private handlers: Map<string, Function> = new Map();

  constructor() {
    this.mockSocket = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn((event: string, handler: Function) => {
        this.handlers.set(event, handler);
      }),
      removeEventListener: vi.fn((event: string) => {
        this.handlers.delete(event);
      }),
      readyState: WebSocket.OPEN,
    };
  }

  simulateMessage(data: any) {
    const handler = this.handlers.get('message');
    if (handler) {
      handler({ data: JSON.stringify(data) });
    }
  }

  simulateError(error: Error) {
    const handler = this.handlers.get('error');
    if (handler) {
      handler(error);
    }
  }

  simulateClose() {
    this.mockSocket.readyState = WebSocket.CLOSED;
    const handler = this.handlers.get('close');
    if (handler) {
      handler();
    }
  }

  getMockSocket() {
    return this.mockSocket;
  }

  getSentMessages() {
    return this.mockSocket.send.mock.calls.map((call: any[]) =>
      JSON.parse(call[0])
    );
  }
}

// Export a pre-configured test environment
export function createIntegrationTestEnvironment() {
  const journey = new UserJourney();

  return {
    journey,
    navigation: journey.getNavigation(),
    auth: journey.getAuth(),
    api: journey.getApiState(),
    cleanup: () => journey.cleanup(),
  };
}
