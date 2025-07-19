import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { useRouter } from 'next/navigation';
import type { Session } from 'next-auth';
import { signIn, useSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/src/__tests__/mocks/server';
import {
  renderWithoutProviders,
  screen,
  waitFor,
} from '@/src/__tests__/utils/test-utils';
import RegisterForm from './register-form';

// Mock next-auth signIn function
vi.mock('next-auth/react', async () => {
  const actual = await vi.importActual('next-auth/react');
  return {
    ...actual,
    signIn: vi.fn(),
    useSession: vi.fn(() => ({
      data: null,
      status: 'unauthenticated',
    })),
  };
});

// Mock useRouter
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual('next/navigation');
  return {
    ...actual,
    useRouter: vi.fn(),
  };
});

// Regex constants for text matching
const USERNAME_LABEL_REGEX = /username/i;
const EMAIL_LABEL_REGEX = /email address/i;
const PASSWORD_LABEL_REGEX = /^password$/i;
const CONFIRM_PASSWORD_REGEX = /confirm password/i;
const SUBMIT_BUTTON_REGEX = /submit/i;
const CREATING_ACCOUNT_REGEX = /creating account/i;
const LOGIN_LINK_REGEX = /login here/i;
const ALREADY_MEMBER_REGEX = /already a member/i;

// Validation error regex patterns
const STRING_MIN_2_CHAR_REGEX =
  /string must contain at least 2 character\(s\)/i;
const STRING_MAX_250_CHAR_REGEX =
  /string must contain at most 250 character\(s\)/i;
const USERNAME_NO_SPACES_REGEX = /username cannot contain spaces/i;
const INVALID_EMAIL_REGEX = /invalid email/i;
const PASSWORD_REQUIREMENTS_REGEX =
  /password must contain at least one uppercase letter, one number, and one special character/i;
const STRING_MIN_8_CHAR_REGEX =
  /string must contain at least 8 character\(s\)/i;
const PASSWORDS_MUST_MATCH_REGEX =
  /your passwords must match, please try again/i;
const PASSWORDS_MUST_MATCH_SHORT_REGEX = /your passwords must match/i;

// Error message regex patterns
const USERNAME_ALREADY_EXISTS_REGEX =
  /a user with that username already exists/i;
const ENTER_VALID_EMAIL_REGEX = /enter a valid email address/i;
const PASSWORD_TOO_COMMON_REGEX = /this password is too common/i;
const UNABLE_CREATE_ACCOUNT_REGEX = /unable to create account at this time/i;
const REGISTRATION_FAILED_REGEX = /registration failed. please try again/i;
const REGISTRATION_SUCCESS_LOGIN_FAILED_REGEX =
  /registration successful but login failed. please try logging in manually/i;
const REGISTRATION_UNEXPECTED_RESPONSE_REGEX =
  /registration completed but unexpected response format/i;
const REGISTRATION_MAY_HAVE_SUCCEEDED_REGEX =
  /registration may have succeeded. please try logging in/i;
const USERNAME_ALREADY_TAKEN_REGEX = /username already taken/i;
const USERNAME_ALREADY_EXISTS_SHORT_REGEX = /username already exists/i;

// Test data constants
const VALID_USERNAME = 'testuser123';
const VALID_EMAIL = 'test@example.com';
const VALID_PASSWORD = 'Test123!@#';
const INVALID_EMAIL = 'not@valid';
const SHORT_USERNAME = 'a';
const LONG_USERNAME = 'a'.repeat(251);
const USERNAME_WITH_SPACES = 'test user';
const WEAK_PASSWORD = 'password';
const PASSWORD_NO_UPPERCASE = 'test123!@#';
const PASSWORD_NO_NUMBER = 'Test!@#abc';
const PASSWORD_NO_SPECIAL = 'Test12345';
const SHORT_PASSWORD = 'Test1!';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

describe('RegisterForm', () => {
  const mockPush = vi.fn();
  const mockSignIn = signIn as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
    });
    mockSignIn.mockResolvedValue({ ok: true });
  });

  describe('Form Rendering', () => {
    it('should render all required form fields', () => {
      renderWithoutProviders(<RegisterForm />);

      // Check all form fields are present
      expect(screen.getByLabelText(USERNAME_LABEL_REGEX)).toBeInTheDocument();
      expect(screen.getByLabelText(EMAIL_LABEL_REGEX)).toBeInTheDocument();
      expect(screen.getByLabelText(PASSWORD_LABEL_REGEX)).toBeInTheDocument();
      expect(screen.getByLabelText(CONFIRM_PASSWORD_REGEX)).toBeInTheDocument();

      // Check submit button
      expect(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      ).toBeInTheDocument();

      // Check login link
      expect(screen.getByText(ALREADY_MEMBER_REGEX)).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: LOGIN_LINK_REGEX })
      ).toHaveAttribute('href', '/login');
    });

    it('should render with correct input types', () => {
      renderWithoutProviders(<RegisterForm />);

      const usernameInput = screen.getByLabelText(USERNAME_LABEL_REGEX);
      const emailInput = screen.getByLabelText(EMAIL_LABEL_REGEX);
      const passwordInput = screen.getByLabelText(PASSWORD_LABEL_REGEX);
      const confirmPasswordInput = screen.getByLabelText(
        CONFIRM_PASSWORD_REGEX
      );

      // Username input doesn't have explicit type attribute, defaults to text
      expect(usernameInput.tagName).toBe('INPUT');
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    });

    it('should render with correct placeholders', () => {
      renderWithoutProviders(<RegisterForm />);

      expect(screen.getByPlaceholderText('Alan Turing')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('example@gmail.com')
      ).toBeInTheDocument();
    });
  });

  describe('Username Validation', () => {
    it('should show error for username shorter than 2 characters', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      const usernameInput = screen.getByLabelText(USERNAME_LABEL_REGEX);
      await user.type(usernameInput, SHORT_USERNAME);

      // Submit form to trigger validation
      const submitButton = screen.getByRole('button', {
        name: SUBMIT_BUTTON_REGEX,
      });
      await user.click(submitButton);

      await waitFor(() => {
        // Multiple fields might show this error, so we use getAllByText
        const errors = screen.getAllByText(STRING_MIN_2_CHAR_REGEX);
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    it('should show error for username longer than 250 characters', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      const usernameInput = screen.getByLabelText(USERNAME_LABEL_REGEX);
      await user.type(usernameInput, LONG_USERNAME);

      // Submit form to trigger validation
      const submitButton = screen.getByRole('button', {
        name: SUBMIT_BUTTON_REGEX,
      });
      await user.click(submitButton);

      await waitFor(() => {
        const errors = screen.getAllByText(STRING_MAX_250_CHAR_REGEX);
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    it('should show error for username with spaces', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      const usernameInput = screen.getByLabelText(USERNAME_LABEL_REGEX);
      await user.type(usernameInput, USERNAME_WITH_SPACES);

      // Submit form to trigger validation
      const submitButton = screen.getByRole('button', {
        name: SUBMIT_BUTTON_REGEX,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(USERNAME_NO_SPACES_REGEX)).toBeInTheDocument();
      });
    });

    it('should accept valid username', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      const usernameInput = screen.getByLabelText(USERNAME_LABEL_REGEX);
      await user.type(usernameInput, VALID_USERNAME);

      // Fill other required fields to submit form
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      const submitButton = screen.getByRole('button', {
        name: SUBMIT_BUTTON_REGEX,
      });
      await user.click(submitButton);

      // Should not show username validation errors
      expect(
        screen.queryByText(USERNAME_NO_SPACES_REGEX)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(STRING_MIN_2_CHAR_REGEX)
      ).not.toBeInTheDocument();
    });
  });

  describe('Email Validation', () => {
    it('should show error for invalid email format', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Mock API to ensure we're testing client-side validation
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          // This should not be called if validation fails
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Fill all required fields to ensure form submits
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), INVALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      // Submit form to trigger validation
      const submitButton = screen.getByRole('button', {
        name: SUBMIT_BUTTON_REGEX,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(INVALID_EMAIL_REGEX)).toBeInTheDocument();
      });
    });

    it('should accept valid email format', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Fill all fields with valid data
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      const submitButton = screen.getByRole('button', {
        name: SUBMIT_BUTTON_REGEX,
      });
      await user.click(submitButton);

      // Should not show email validation error
      expect(screen.queryByText(INVALID_EMAIL_REGEX)).not.toBeInTheDocument();
    });
  });

  describe('Password Validation', () => {
    it('should show error for password without uppercase letter', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      const passwordInput = screen.getByLabelText(PASSWORD_LABEL_REGEX);
      await user.type(passwordInput, PASSWORD_NO_UPPERCASE);

      // Submit form to trigger validation
      const submitButton = screen.getByRole('button', {
        name: SUBMIT_BUTTON_REGEX,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(PASSWORD_REQUIREMENTS_REGEX)
        ).toBeInTheDocument();
      });
    });

    it('should show error for password without number', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      const passwordInput = screen.getByLabelText(PASSWORD_LABEL_REGEX);
      await user.type(passwordInput, PASSWORD_NO_NUMBER);

      // Submit form to trigger validation
      const submitButton = screen.getByRole('button', {
        name: SUBMIT_BUTTON_REGEX,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(PASSWORD_REQUIREMENTS_REGEX)
        ).toBeInTheDocument();
      });
    });

    it('should show error for password without special character', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      const passwordInput = screen.getByLabelText(PASSWORD_LABEL_REGEX);
      await user.type(passwordInput, PASSWORD_NO_SPECIAL);

      // Submit form to trigger validation
      const submitButton = screen.getByRole('button', {
        name: SUBMIT_BUTTON_REGEX,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(PASSWORD_REQUIREMENTS_REGEX)
        ).toBeInTheDocument();
      });
    });

    it('should show error for password shorter than 8 characters', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      const passwordInput = screen.getByLabelText(PASSWORD_LABEL_REGEX);
      await user.type(passwordInput, SHORT_PASSWORD);

      // Submit form to trigger validation
      const submitButton = screen.getByRole('button', {
        name: SUBMIT_BUTTON_REGEX,
      });
      await user.click(submitButton);

      await waitFor(() => {
        const errors = screen.getAllByText(STRING_MIN_8_CHAR_REGEX);
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    it('should accept valid password', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Fill all fields with valid data
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      const submitButton = screen.getByRole('button', {
        name: SUBMIT_BUTTON_REGEX,
      });
      await user.click(submitButton);

      // Should not show password validation errors
      expect(
        screen.queryByText(PASSWORD_REQUIREMENTS_REGEX)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(STRING_MIN_8_CHAR_REGEX)
      ).not.toBeInTheDocument();
    });
  });

  describe('Password Matching Validation', () => {
    it('should show error when passwords do not match', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Fill form with valid data but mismatched passwords
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        'DifferentPassword123!'
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(
          screen.getByText(PASSWORDS_MUST_MATCH_REGEX)
        ).toBeInTheDocument();
      });
    });

    it('should not show error when passwords match', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Fill form with valid data and matching passwords
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      // Mock successful registration
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(
          screen.queryByText(PASSWORDS_MUST_MATCH_SHORT_REGEX)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Successful Registration Flow', () => {
    it('should handle successful registration with 204 response and auto-login', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Mock successful registration with 204 response
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Fill form with valid data
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('credentials', {
          redirect: false,
          username: VALID_USERNAME,
          password: VALID_PASSWORD,
        });
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should handle successful registration with JSON response containing key', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Mock successful registration with JSON response
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          return HttpResponse.json({ key: 'auth-token-123' });
        })
      );

      // Fill form with valid data
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('credentials', {
          redirect: false,
          username: VALID_USERNAME,
          password: VALID_PASSWORD,
        });
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should redirect to dashboard if already authenticated', () => {
      // Mock authenticated session
      vi.mocked(useSession).mockReturnValue({
        data: { key: 'auth-token' } as unknown as Session,
        status: 'authenticated',
        update: vi.fn(),
      });

      renderWithoutProviders(<RegisterForm />);

      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle 400 error with field-specific errors', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Mock 400 error with field-specific errors
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          return HttpResponse.json(
            {
              username: ['A user with that username already exists.'],
              email: ['Enter a valid email address.'],
              password1: ['This password is too common.'],
            },
            { status: 400 }
          );
        })
      );

      // Fill and submit form
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(
          screen.getByText(USERNAME_ALREADY_EXISTS_REGEX)
        ).toBeInTheDocument();
        expect(screen.getByText(ENTER_VALID_EMAIL_REGEX)).toBeInTheDocument();
        expect(screen.getByText(PASSWORD_TOO_COMMON_REGEX)).toBeInTheDocument();
      });
    });

    it('should handle 400 error with non_field_errors', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Mock 400 error with non_field_errors
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          return HttpResponse.json(
            {
              non_field_errors: ['Unable to create account at this time.'],
            },
            { status: 400 }
          );
        })
      );

      // Fill and submit form
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(
          screen.getByText(UNABLE_CREATE_ACCOUNT_REGEX)
        ).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Mock network error
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          return HttpResponse.error();
        })
      );

      // Fill and submit form
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(screen.getByText(REGISTRATION_FAILED_REGEX)).toBeInTheDocument();
      });
    });

    it('should handle server errors (500)', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Mock server error
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      // Fill and submit form
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(screen.getByText(REGISTRATION_FAILED_REGEX)).toBeInTheDocument();
      });
    });

    it('should handle successful registration but failed auto-login', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Mock successful registration
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Mock failed login
      mockSignIn.mockResolvedValue({ ok: false, error: 'Invalid credentials' });

      // Fill and submit form
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(
          screen.getByText(REGISTRATION_SUCCESS_LOGIN_FAILED_REGEX)
        ).toBeInTheDocument();
      });
    });

    it('should handle unexpected JSON response format', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Mock unexpected response format
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          return HttpResponse.json({ unexpected: 'format' });
        })
      );

      // Fill and submit form
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(
          screen.getByText(REGISTRATION_UNEXPECTED_RESPONSE_REGEX)
        ).toBeInTheDocument();
      });
    });

    it('should handle invalid JSON response', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Mock invalid JSON response
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          return new HttpResponse('Invalid JSON', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      // Fill and submit form
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(
          screen.getByText(REGISTRATION_MAY_HAVE_SUCCEEDED_REGEX)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Mock slow response
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Fill and submit form
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      // Check loading state
      expect(
        screen.getByRole('button', { name: CREATING_ACCOUNT_REGEX })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: CREATING_ACCOUNT_REGEX })
      ).toBeDisabled();

      // Wait for completion
      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled();
      });
    });

    it('should disable submit button while loading', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Mock slow response
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Fill and submit form
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      const submitButton = screen.getByRole('button', {
        name: SUBMIT_BUTTON_REGEX,
      });
      await user.click(submitButton);

      // Button should be disabled during loading
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent('Creating Account...');

      // Wait for completion
      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for all form fields', () => {
      renderWithoutProviders(<RegisterForm />);

      // Check that all inputs have associated labels
      const usernameInput = screen.getByLabelText(USERNAME_LABEL_REGEX);
      const emailInput = screen.getByLabelText(EMAIL_LABEL_REGEX);
      const passwordInput = screen.getByLabelText(PASSWORD_LABEL_REGEX);
      const confirmPasswordInput = screen.getByLabelText(
        CONFIRM_PASSWORD_REGEX
      );

      expect(usernameInput).toHaveAccessibleName('Username');
      expect(emailInput).toHaveAccessibleName('Email Address');
      expect(passwordInput).toHaveAccessibleName('Password');
      expect(confirmPasswordInput).toHaveAccessibleName('Confirm Password');
    });

    it('should display error messages in accessible way', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Fill form to trigger validation
      const usernameInput = screen.getByLabelText(USERNAME_LABEL_REGEX);
      await user.type(usernameInput, SHORT_USERNAME);
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      // Submit to trigger validation
      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        const errorMessage = screen.getByText(STRING_MIN_2_CHAR_REGEX);
        expect(errorMessage).toBeInTheDocument();
        // Error message should be associated with the input field
        const formItem = errorMessage.closest('[role="group"], .space-y-2');
        expect(formItem).toContainElement(usernameInput);
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Tab through all form fields
      await user.tab(); // Focus username
      expect(screen.getByLabelText(USERNAME_LABEL_REGEX)).toHaveFocus();

      await user.tab(); // Focus email
      expect(screen.getByLabelText(EMAIL_LABEL_REGEX)).toHaveFocus();

      await user.tab(); // Focus password
      expect(screen.getByLabelText(PASSWORD_LABEL_REGEX)).toHaveFocus();

      await user.tab(); // Focus confirm password
      expect(screen.getByLabelText(CONFIRM_PASSWORD_REGEX)).toHaveFocus();

      await user.tab(); // Focus submit button
      expect(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      ).toHaveFocus();
    });

    it('should announce form errors to screen readers', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Mock 400 error
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          return HttpResponse.json(
            {
              username: ['Username already taken'],
            },
            { status: 400 }
          );
        })
      );

      // Fill and submit form
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        const errorDiv = screen
          .getByText(USERNAME_ALREADY_TAKEN_REGEX)
          .closest('div');
        expect(errorDiv).toHaveClass(
          'mb-6',
          'rounded-md',
          'border',
          'border-rose-700'
        );
      });
    });
  });

  describe('Form Submission and API Call Verification', () => {
    it('should call API with correct payload', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      let capturedRequest: Request | null = null;

      // Mock and capture the request
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, ({ request }) => {
          capturedRequest = request.clone();
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Fill and submit form
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(async () => {
        expect(capturedRequest).not.toBeNull();
        const body = await capturedRequest?.json();
        expect(body).toEqual({
          username: VALID_USERNAME,
          email: VALID_EMAIL,
          password1: VALID_PASSWORD,
          password2: VALID_PASSWORD,
        });
      });
    });

    it('should use correct API URL based on environment', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      let capturedUrl: string | null = null;

      // Mock and capture the URL
      server.use(
        http.post('*/api/auth/register/', ({ request }) => {
          capturedUrl = request.url;
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Fill and submit form
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(capturedUrl).not.toBeNull();
        expect(capturedUrl).toContain('/api/auth/register/');
      });
    });

    it('should clear errors on new submission attempt', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // First submission - trigger error
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          return HttpResponse.json(
            {
              username: ['Username already exists'],
            },
            { status: 400 }
          );
        })
      );

      // Fill and submit form
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), VALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(
          screen.getByText(USERNAME_ALREADY_EXISTS_SHORT_REGEX)
        ).toBeInTheDocument();
      });

      // Update mock for successful response
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Change username and resubmit
      await user.clear(screen.getByLabelText(USERNAME_LABEL_REGEX));
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        'newusername'
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(
          screen.queryByText(USERNAME_ALREADY_EXISTS_SHORT_REGEX)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Form State Management', () => {
    it('should maintain form values after validation errors', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      // Mock API to ensure we're testing client-side validation
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          // This should not be called if validation fails
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Fill form with invalid data
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        VALID_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), INVALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        VALID_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        VALID_PASSWORD
      );

      // Submit to trigger validation
      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      await waitFor(() => {
        expect(screen.getByText(INVALID_EMAIL_REGEX)).toBeInTheDocument();
      });

      // Check that form values are maintained
      expect(screen.getByLabelText(USERNAME_LABEL_REGEX)).toHaveValue(
        VALID_USERNAME
      );
      expect(screen.getByLabelText(EMAIL_LABEL_REGEX)).toHaveValue(
        INVALID_EMAIL
      );
      expect(screen.getByLabelText(PASSWORD_LABEL_REGEX)).toHaveValue(
        VALID_PASSWORD
      );
      expect(screen.getByLabelText(CONFIRM_PASSWORD_REGEX)).toHaveValue(
        VALID_PASSWORD
      );
    });

    it('should not submit form with validation errors', async () => {
      const user = userEvent.setup();
      renderWithoutProviders(<RegisterForm />);

      let apiCallMade = false;

      // Mock API to track if it was called
      server.use(
        http.post(`${API_BASE_URL}/api/auth/register/`, () => {
          apiCallMade = true;
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Fill form with invalid data
      await user.type(
        screen.getByLabelText(USERNAME_LABEL_REGEX),
        SHORT_USERNAME
      );
      await user.type(screen.getByLabelText(EMAIL_LABEL_REGEX), INVALID_EMAIL);
      await user.type(
        screen.getByLabelText(PASSWORD_LABEL_REGEX),
        WEAK_PASSWORD
      );
      await user.type(
        screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
        WEAK_PASSWORD
      );

      await user.click(
        screen.getByRole('button', { name: SUBMIT_BUTTON_REGEX })
      );

      // Wait a bit to ensure no API call is made
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(apiCallMade).toBe(false);
    });
  });
});
