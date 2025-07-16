import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  renderWithoutProviders,
  screen,
} from '@/src/__tests__/utils/test-utils';
import { Button } from './button';

// Regex constants for text matching
const CLICK_ME_REGEX = /click me/i;
const DISABLED_REGEX = /disabled/i;
const CUSTOM_REGEX = /custom/i;
const LINK_BUTTON_REGEX = /link button/i;
const SUBMIT_FORM_REGEX = /submit form/i;

describe('Button', () => {
  it('should render with default props', () => {
    renderWithoutProviders(<Button>Click me</Button>);

    const button = screen.getByRole('button', { name: CLICK_ME_REGEX });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('inline-flex', 'items-center', 'justify-center');
  });

  it('should render with different variants', () => {
    const { rerender } = renderWithoutProviders(
      <Button variant="primary">Primary</Button>
    );
    expect(screen.getByRole('button')).toHaveClass('bg-indigo-500');

    rerender(<Button variant="destructive">Destructive</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-rose-500');

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button')).toHaveClass('border', 'border-input');

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-secondary');

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button')).toHaveClass('hover:bg-accent');

    rerender(<Button variant="link">Link</Button>);
    expect(screen.getByRole('button')).toHaveClass(
      'text-primary',
      'underline-offset-4'
    );
  });

  it('should render with different sizes', () => {
    const { rerender } = renderWithoutProviders(
      <Button size="sm">Small</Button>
    );
    expect(screen.getByRole('button')).toHaveClass('h-9', 'px-3');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-11', 'px-8');

    rerender(<Button size="icon">Icon</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-10', 'w-10');
  });

  it('should handle click events', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    renderWithoutProviders(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole('button', { name: CLICK_ME_REGEX });
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    renderWithoutProviders(<Button disabled>Disabled</Button>);

    const button = screen.getByRole('button', { name: DISABLED_REGEX });
    expect(button).toBeDisabled();
    expect(button).toHaveClass(
      'disabled:pointer-events-none',
      'disabled:opacity-50'
    );
  });

  it('should accept custom className', () => {
    renderWithoutProviders(<Button className="custom-class">Custom</Button>);

    const button = screen.getByRole('button', { name: CUSTOM_REGEX });
    expect(button).toHaveClass('custom-class');
  });

  it('should render as child component when asChild is true', () => {
    renderWithoutProviders(
      <Button asChild>
        <a href="/">Link Button</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: LINK_BUTTON_REGEX });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/');
  });

  it('should forward ref correctly', () => {
    const ref = vi.fn();

    renderWithoutProviders(<Button ref={ref}>Ref Button</Button>);

    expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
  });

  it('should have correct accessibility attributes', () => {
    renderWithoutProviders(
      <Button aria-label="Submit form" type="submit">
        Submit
      </Button>
    );

    const button = screen.getByRole('button', { name: SUBMIT_FORM_REGEX });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('aria-label', 'Submit form');
  });

  it('should prevent click when disabled', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    renderWithoutProviders(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    const button = screen.getByRole('button', { name: DISABLED_REGEX });
    await user.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });
});
