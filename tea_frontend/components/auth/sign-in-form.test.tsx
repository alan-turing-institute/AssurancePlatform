import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderWithoutProviders,
  screen,
} from '@/src/__tests__/utils/test-utils';
import SignInForm from './sign-in-form';

const mockPush = vi.fn();
const mockSignIn = vi.fn();

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
  signIn: mockSignIn,
  useSession: () => ({
    data: null,
    status: 'unauthenticated',
  }),
}));

describe('SignInForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockSignIn.mockClear();
  });

  it('should render form with all required fields', () => {
    renderWithoutProviders(<SignInForm />);

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it('should have correct input types and placeholders', () => {
    renderWithoutProviders(<SignInForm />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(usernameInput).toHaveAttribute('type', 'text');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should validate minimum username length', async () => {
    const user = userEvent.setup();
    renderWithoutProviders(<SignInForm />);

    const usernameInput = screen.getByLabelText(/username/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(usernameInput, 'a'); // Less than 2 characters
    await user.click(submitButton);

    expect(
      await screen.findByText(/string must contain at least 2 character/i)
    ).toBeInTheDocument();
  });

  it('should validate minimum password length', async () => {
    const user = userEvent.setup();
    renderWithoutProviders(<SignInForm />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(usernameInput, 'validuser');
    await user.type(passwordInput, '1234567'); // Less than 8 characters
    await user.click(submitButton);

    expect(
      await screen.findByText(/string must contain at least 8 character/i)
    ).toBeInTheDocument();
  });

  it('should validate maximum username length', async () => {
    const user = userEvent.setup();
    renderWithoutProviders(<SignInForm />);

    const usernameInput = screen.getByLabelText(/username/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    const longUsername = 'a'.repeat(51); // More than 50 characters
    await user.type(usernameInput, longUsername);
    await user.click(submitButton);

    expect(
      await screen.findByText(/string must contain at most 50 character/i)
    ).toBeInTheDocument();
  });

  it('should handle form submission with valid data', async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({ ok: true });

    renderWithoutProviders(<SignInForm />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    // Form should be valid and attempt submission
    expect(mockSignIn).toHaveBeenCalledWith('credentials', {
      username: 'testuser',
      password: 'password123',
      redirect: false,
    });
  });

  it('should show loading state during form submission', async () => {
    const user = userEvent.setup();
    mockSignIn.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    renderWithoutProviders(<SignInForm />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    // Should show loading state
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should clear form validation errors when user starts typing', async () => {
    const user = userEvent.setup();
    renderWithoutProviders(<SignInForm />);

    const usernameInput = screen.getByLabelText(/username/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Trigger validation error
    await user.click(submitButton);
    expect(
      await screen.findByText(/string must contain at least 2 character/i)
    ).toBeInTheDocument();

    // Start typing to clear error
    await user.type(usernameInput, 'validuser');

    expect(
      screen.queryByText(/string must contain at least 2 character/i)
    ).not.toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    renderWithoutProviders(<SignInForm />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const form = screen.getByRole('form') || usernameInput.closest('form');

    expect(usernameInput).toHaveAccessibleName();
    expect(passwordInput).toHaveAccessibleName();
    expect(form).toBeInTheDocument();
  });

  it('should handle keyboard navigation correctly', async () => {
    const user = userEvent.setup();
    renderWithoutProviders(<SignInForm />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Tab through form elements
    await user.tab();
    expect(usernameInput).toHaveFocus();

    await user.tab();
    expect(passwordInput).toHaveFocus();

    await user.tab();
    expect(submitButton).toHaveFocus();
  });

  it('should prevent form submission with empty fields', async () => {
    const user = userEvent.setup();
    renderWithoutProviders(<SignInForm />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    expect(mockSignIn).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/string must contain at least 2 character/i)
    ).toBeInTheDocument();
  });

  it('should handle sign in error states', async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({
      ok: false,
      error: 'CredentialsSignin',
    });

    renderWithoutProviders(<SignInForm />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    await vi.waitFor(() => {
      expect(mockSignIn).toHaveBeenCalled();
    });
  });

  it('should show GitHub sign in option', () => {
    renderWithoutProviders(<SignInForm />);

    const githubButton = screen.getByRole('button', {
      name: /continue with github/i,
    });
    expect(githubButton).toBeInTheDocument();
  });

  it('should handle GitHub sign in', async () => {
    const user = userEvent.setup();
    renderWithoutProviders(<SignInForm />);

    const githubButton = screen.getByRole('button', {
      name: /continue with github/i,
    });
    await user.click(githubButton);

    expect(mockSignIn).toHaveBeenCalledWith('github');
  });

  it('should show proper form structure', () => {
    renderWithoutProviders(<SignInForm />);

    // Check for form elements structure
    const usernameField = screen
      .getByLabelText(/username/i)
      .closest('.space-y-2');
    const passwordField = screen
      .getByLabelText(/password/i)
      .closest('.space-y-2');

    expect(usernameField).toBeInTheDocument();
    expect(passwordField).toBeInTheDocument();
  });
});
