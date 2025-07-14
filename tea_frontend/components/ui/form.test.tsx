import { zodResolver } from '@hookform/resolvers/zod';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  render,
  renderWithoutProviders,
  screen,
} from '@/src/__tests__/utils/test-utils';
import { Button } from './button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './form';
import { Input } from './input';

const testSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

type TestFormData = z.infer<typeof testSchema>;

describe('Form Components', () => {
  const TestForm = ({
    onSubmit,
  }: {
    onSubmit?: (data: TestFormData) => void;
  }) => {
    const form = useForm<TestFormData>({
      resolver: zodResolver(testSchema),
      defaultValues: {
        username: '',
        email: '',
      },
    });

    return (
      <Form {...form}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit || vi.fn())}
        >
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="Enter username" {...field} />
                </FormControl>
                <FormDescription>
                  This is your public display name.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="Enter email" type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Submit</Button>
        </form>
      </Form>
    );
  };

  it('should render form with all components', () => {
    renderWithoutProviders(<TestForm />);

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter email/i)).toBeInTheDocument();
    expect(
      screen.getByText('This is your public display name.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('should show validation errors for required fields', async () => {
    const user = userEvent.setup();
    renderWithoutProviders(<TestForm />);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    expect(
      screen.getByText('Username must be at least 2 characters')
    ).toBeInTheDocument();
    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
  });

  it('should show validation error for invalid email', async () => {
    const user = userEvent.setup();
    renderWithoutProviders(<TestForm />);

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn();
    renderWithoutProviders(<TestForm onSubmit={mockSubmit} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email/i);

    await user.type(usernameInput, 'testuser');
    await user.type(emailInput, 'test@example.com');

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    expect(mockSubmit).toHaveBeenCalledWith({
      username: 'testuser',
      email: 'test@example.com',
    });
  });

  it('should clear validation errors when valid input is provided', async () => {
    const user = userEvent.setup();
    renderWithoutProviders(<TestForm />);

    // First trigger validation errors
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    expect(
      screen.getByText('Username must be at least 2 characters')
    ).toBeInTheDocument();

    // Then provide valid input
    const usernameInput = screen.getByLabelText(/username/i);
    await user.type(usernameInput, 'validuser');

    // Error should be cleared
    expect(
      screen.queryByText('Username must be at least 2 characters')
    ).not.toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    renderWithoutProviders(<TestForm />);

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email/i);

    // Check that inputs are properly labeled
    expect(usernameInput).toHaveAccessibleName('Username');
    expect(emailInput).toHaveAccessibleName('Email');

    // Check that description is properly associated
    const description = screen.getByText('This is your public display name.');
    expect(usernameInput).toHaveAccessibleDescription(
      'This is your public display name.'
    );
  });

  it('should mark form fields as invalid when there are errors', async () => {
    const user = userEvent.setup();
    renderWithoutProviders(<TestForm />);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email/i);

    expect(usernameInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('should handle FormLabel error state styling', async () => {
    const user = userEvent.setup();
    renderWithoutProviders(<TestForm />);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    // Wait for validation to trigger
    await screen.findByText('Username must be at least 2 characters');

    const usernameLabel = screen.getByText('Username');
    expect(usernameLabel).toHaveClass('text-rose-500');
  });

  it('should handle controlled form field updates', async () => {
    const user = userEvent.setup();
    renderWithoutProviders(<TestForm />);

    const usernameInput = screen.getByLabelText(/username/i);

    await user.type(usernameInput, 'newuser');
    expect(usernameInput).toHaveValue('newuser');

    await user.clear(usernameInput);
    expect(usernameInput).toHaveValue('');
  });

  it('should render FormMessage only when there is an error', async () => {
    const user = userEvent.setup();
    renderWithoutProviders(<TestForm />);

    // Initially no error messages should be shown
    expect(
      screen.queryByText('Username must be at least 2 characters')
    ).not.toBeInTheDocument();

    // Trigger validation
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    // Now error messages should be visible
    expect(
      screen.getByText('Username must be at least 2 characters')
    ).toBeInTheDocument();
  });

  it('should render FormDescription consistently', () => {
    renderWithoutProviders(<TestForm />);

    const description = screen.getByText('This is your public display name.');
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass('text-sm', 'text-muted-foreground');
  });
});
