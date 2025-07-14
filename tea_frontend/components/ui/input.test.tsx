import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  render,
  renderWithoutProviders,
  screen,
} from '@/src/__tests__/utils/test-utils';
import { Input } from './input';

describe('Input', () => {
  it('should render with default props', () => {
    renderWithoutProviders(<Input />);

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass('flex', 'h-10', 'w-full', 'rounded-md', 'border');
  });

  it('should render with different input types', () => {
    const { rerender } = renderWithoutProviders(<Input type="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');

    rerender(<Input type="password" />);
    const passwordInput = screen.getByDisplayValue('');
    expect(passwordInput).toHaveAttribute('type', 'password');

    rerender(<Input type="number" />);
    expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number');
  });

  it('should handle value changes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    renderWithoutProviders(<Input onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test value');

    expect(input).toHaveValue('test value');
    expect(handleChange).toHaveBeenCalled();
  });

  it('should display placeholder text', () => {
    renderWithoutProviders(<Input placeholder="Enter your name" />);

    const input = screen.getByPlaceholderText('Enter your name');
    expect(input).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    renderWithoutProviders(<Input disabled />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
    expect(input).toHaveClass(
      'disabled:cursor-not-allowed',
      'disabled:opacity-50'
    );
  });

  it('should accept custom className', () => {
    renderWithoutProviders(<Input className="custom-input-class" />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('custom-input-class');
  });

  it('should handle defaultValue', () => {
    renderWithoutProviders(<Input defaultValue="default text" />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('default text');
  });

  it('should handle controlled value', () => {
    const { rerender } = renderWithoutProviders(
      <Input readOnly value="controlled value" />
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('controlled value');

    rerender(<Input readOnly value="updated value" />);
    expect(input).toHaveValue('updated value');
  });

  it('should forward ref correctly', () => {
    const ref = vi.fn();

    renderWithoutProviders(<Input ref={ref} />);

    expect(ref).toHaveBeenCalledWith(expect.any(HTMLInputElement));
  });

  it('should have correct accessibility attributes', () => {
    renderWithoutProviders(
      <Input
        aria-describedby="username-help"
        aria-label="Username input"
        required
      />
    );

    const input = screen.getByRole('textbox', { name: /username input/i });
    expect(input).toHaveAttribute('aria-label', 'Username input');
    expect(input).toHaveAttribute('aria-describedby', 'username-help');
    expect(input).toBeRequired();
  });

  it('should handle focus and blur events', async () => {
    const user = userEvent.setup();
    const handleFocus = vi.fn();
    const handleBlur = vi.fn();

    renderWithoutProviders(<Input onBlur={handleBlur} onFocus={handleFocus} />);

    const input = screen.getByRole('textbox');

    await user.click(input);
    expect(handleFocus).toHaveBeenCalledTimes(1);

    await user.tab();
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('should prevent input when readOnly', async () => {
    const user = userEvent.setup();

    renderWithoutProviders(<Input readOnly value="readonly value" />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'should not change');

    expect(input).toHaveValue('readonly value');
  });

  it('should handle file input type correctly', () => {
    renderWithoutProviders(<Input accept=".jpg,.png" type="file" />);

    const fileInput = screen.getByRole('textbox', { hidden: true }); // file inputs are hidden by default
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput).toHaveAttribute('accept', '.jpg,.png');
  });

  it('should have proper styling classes', () => {
    renderWithoutProviders(<Input />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveClass(
      'flex',
      'h-10',
      'w-full',
      'rounded-md',
      'border',
      'border-input',
      'bg-background',
      'px-3',
      'py-2',
      'text-sm',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none',
      'focus-visible:ring-2'
    );
  });
});
