import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/src/__tests__/mocks/server';
import {
  render,
  renderWithAuth,
  renderWithoutProviders,
  screen,
} from '@/src/__tests__/utils/test-utils';
import LogoutButton from './LogoutButton';

// Mock the ActionTooltip component to focus on LogoutButton logic
vi.mock('../ui/action-tooltip', () => ({
  default: ({
    children,
    label,
  }: {
    children: React.ReactNode;
    label: string;
  }) => <div title={label}>{children}</div>,
}));

const mockPush = vi.fn();
const mockSignOut = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
      },
      key: 'mock-token-key',
      provider: 'github',
    },
    status: 'authenticated',
  }),
  signOut: () => mockSignOut(),
}));

describe('LogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockSignOut.mockClear();
  });

  it('should render logout button with icon and accessibility label', () => {
    renderWithoutProviders(<LogoutButton />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Logout');

    // Check for screen reader text
    expect(
      screen.getByText('Logout', { selector: '.sr-only' })
    ).toBeInTheDocument();

    // Check for logout icon (LogOutIcon from lucide-react)
    const icon = button.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should have correct button styling', () => {
    renderWithoutProviders(<LogoutButton />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('inline-flex', 'items-center', 'justify-center');
    // Checking for size and variant classes from Button component
    expect(button).toHaveClass('h-9'); // small size
  });

  it('should handle successful logout', async () => {
    const user = userEvent.setup();

    // Mock successful logout API response
    server.use(
      http.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/logout/`,
        () => {
          return new HttpResponse(null, { status: 200 });
        }
      )
    );

    renderWithoutProviders(<LogoutButton />);

    const button = screen.getByRole('button');
    await user.click(button);

    // Wait for async operations to complete
    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('should handle logout API failure gracefully', async () => {
    const user = userEvent.setup();

    // Mock failed logout API response
    server.use(
      http.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/logout/`,
        () => {
          return new HttpResponse(null, { status: 500 });
        }
      )
    );

    renderWithoutProviders(<LogoutButton />);

    const button = screen.getByRole('button');
    await user.click(button);

    // Should not call signOut or redirect on API failure
    await vi.waitFor(() => {
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it('should send correct authorization header in logout request', async () => {
    const user = userEvent.setup();
    let requestHeaders: Headers | undefined;

    // Capture request headers
    server.use(
      http.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/logout/`,
        ({ request }) => {
          requestHeaders = request.headers;
          return new HttpResponse(null, { status: 200 });
        }
      )
    );

    renderWithoutProviders(<LogoutButton />);

    const button = screen.getByRole('button');
    await user.click(button);

    await vi.waitFor(() => {
      expect(requestHeaders?.get('Authorization')).toBe('Token mock-token-key');
      expect(requestHeaders?.get('Content-Type')).toBe('application/json');
    });
  });

  it('should be accessible via keyboard', async () => {
    const user = userEvent.setup();

    server.use(
      http.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/logout/`,
        () => {
          return new HttpResponse(null, { status: 200 });
        }
      )
    );

    renderWithoutProviders(<LogoutButton />);

    const button = screen.getByRole('button');

    // Focus the button
    await user.tab();
    expect(button).toHaveFocus();

    // Activate with Enter key
    await user.keyboard('[Enter]');

    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle component mounting state correctly', () => {
    renderWithoutProviders(<LogoutButton />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();

    // Component should render properly after mounting
    expect(button).toBeEnabled();
  });

  it('should render with providers context', () => {
    renderWithAuth(<LogoutButton />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Logout');
  });

  it('should use environment variable for API URL', async () => {
    const user = userEvent.setup();
    let requestUrl: string | undefined;

    server.use(
      http.post('*', ({ request }) => {
        requestUrl = request.url;
        return new HttpResponse(null, { status: 200 });
      })
    );

    renderWithoutProviders(<LogoutButton />);

    const button = screen.getByRole('button');
    await user.click(button);

    await vi.waitFor(() => {
      expect(requestUrl).toContain('/api/auth/logout/');
    });
  });

  it('should handle multiple rapid clicks gracefully', async () => {
    const user = userEvent.setup();

    server.use(
      http.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/logout/`,
        () => {
          return new HttpResponse(null, { status: 200 });
        }
      )
    );

    renderWithoutProviders(<LogoutButton />);

    const button = screen.getByRole('button');

    // Click multiple times rapidly
    await user.click(button);
    await user.click(button);
    await user.click(button);

    // Should still work correctly
    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});
