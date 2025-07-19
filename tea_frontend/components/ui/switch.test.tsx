import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  renderWithoutProviders,
  screen,
} from '@/src/__tests__/utils/test-utils';
import { Switch } from './switch';

// Regex constants for text matching
const TOGGLE_NOTIFICATIONS_REGEX = /toggle notifications/i;
const ENABLE_FEATURE_REGEX = /enable feature/i;
const CUSTOM_SWITCH_REGEX = /custom switch/i;
const SUBMIT_REGEX = /submit/i;

describe('Switch', () => {
  it('should render with default props', () => {
    renderWithoutProviders(<Switch />);

    const switchElement = screen.getByRole('switch');
    expect(switchElement).toBeInTheDocument();
    expect(switchElement).toHaveAttribute('aria-checked', 'false');
    expect(switchElement).toHaveAttribute('data-state', 'unchecked');
  });

  it('should toggle when clicked', async () => {
    const user = userEvent.setup();

    renderWithoutProviders(<Switch />);

    const switchElement = screen.getByRole('switch');

    // Initially unchecked
    expect(switchElement).toHaveAttribute('aria-checked', 'false');
    expect(switchElement).toHaveAttribute('data-state', 'unchecked');

    // Click to check
    await user.click(switchElement);
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
    expect(switchElement).toHaveAttribute('data-state', 'checked');

    // Click to uncheck
    await user.click(switchElement);
    expect(switchElement).toHaveAttribute('aria-checked', 'false');
    expect(switchElement).toHaveAttribute('data-state', 'unchecked');
  });

  it('should handle controlled checked state', () => {
    const { rerender } = renderWithoutProviders(<Switch checked={false} />);

    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'false');

    rerender(<Switch checked />);
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
  });

  it('should call onCheckedChange when toggled', async () => {
    const user = userEvent.setup();
    const handleCheckedChange = vi.fn();

    renderWithoutProviders(<Switch onCheckedChange={handleCheckedChange} />);

    const switchElement = screen.getByRole('switch');

    await user.click(switchElement);
    expect(handleCheckedChange).toHaveBeenCalledTimes(1);
    expect(handleCheckedChange).toHaveBeenCalledWith(true);

    await user.click(switchElement);
    expect(handleCheckedChange).toHaveBeenCalledTimes(2);
    expect(handleCheckedChange).toHaveBeenCalledWith(false);
  });

  it('should be disabled when disabled prop is true', () => {
    renderWithoutProviders(<Switch disabled />);

    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-disabled', 'true');
    expect(switchElement).toHaveClass(
      'disabled:cursor-not-allowed',
      'disabled:opacity-50'
    );
  });

  it('should not toggle when disabled', async () => {
    const user = userEvent.setup();
    const handleCheckedChange = vi.fn();

    renderWithoutProviders(
      <Switch disabled onCheckedChange={handleCheckedChange} />
    );

    const switchElement = screen.getByRole('switch');

    await user.click(switchElement);
    expect(handleCheckedChange).not.toHaveBeenCalled();
    expect(switchElement).toHaveAttribute('aria-checked', 'false');
  });

  it('should accept custom className', () => {
    renderWithoutProviders(<Switch className="custom-switch-class" />);

    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveClass('custom-switch-class');
    // Should also retain default classes
    expect(switchElement).toHaveClass('peer', 'inline-flex', 'h-6', 'w-11');
  });

  it('should have proper accessibility attributes', () => {
    renderWithoutProviders(<Switch aria-label="Toggle notifications" />);

    const switchElement = screen.getByRole('switch', {
      name: TOGGLE_NOTIFICATIONS_REGEX,
    });
    expect(switchElement).toHaveAttribute('aria-label', 'Toggle notifications');
  });

  it('should forward ref correctly', () => {
    const ref = vi.fn();

    renderWithoutProviders(<Switch ref={ref} />);

    expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
  });

  it('should toggle with keyboard Space key', async () => {
    const user = userEvent.setup();
    const handleCheckedChange = vi.fn();

    renderWithoutProviders(
      <Switch
        aria-label="Enable feature"
        onCheckedChange={handleCheckedChange}
      />
    );

    const switchElement = screen.getByRole('switch', {
      name: ENABLE_FEATURE_REGEX,
    });

    // Focus the switch
    switchElement.focus();
    expect(switchElement).toHaveFocus();

    // Press Space to toggle
    await user.keyboard('[Space]');
    expect(handleCheckedChange).toHaveBeenCalledWith(true);
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
  });

  it('should have proper styling classes', () => {
    renderWithoutProviders(<Switch />);

    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveClass(
      'peer',
      'inline-flex',
      'h-6',
      'w-11',
      'shrink-0',
      'cursor-pointer',
      'items-center',
      'rounded-full',
      'border-2',
      'border-transparent',
      'transition-colors',
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-ring',
      'focus-visible:ring-offset-2',
      'focus-visible:ring-offset-background'
    );
  });

  it('should have correct styles when checked', () => {
    renderWithoutProviders(<Switch defaultChecked />);

    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('data-state', 'checked');
    expect(switchElement).toHaveClass('data-[state=checked]:bg-primary');
  });

  it('should have correct styles when unchecked', () => {
    renderWithoutProviders(<Switch />);

    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('data-state', 'unchecked');
    expect(switchElement).toHaveClass('data-[state=unchecked]:bg-input');
  });

  it('should handle defaultChecked prop', () => {
    renderWithoutProviders(<Switch defaultChecked />);

    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
    expect(switchElement).toHaveAttribute('data-state', 'checked');
  });

  it('should support name attribute', () => {
    renderWithoutProviders(<Switch name="notifications" />);

    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('name', 'notifications');
  });

  it('should support value attribute', () => {
    renderWithoutProviders(<Switch value="on" />);

    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('value', 'on');
  });

  it('should support required attribute', () => {
    renderWithoutProviders(<Switch required />);

    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-required', 'true');
  });

  it('should render thumb element', () => {
    renderWithoutProviders(<Switch />);

    const switchElement = screen.getByRole('switch');
    const thumbElement = switchElement.querySelector('.pointer-events-none');

    expect(thumbElement).toBeInTheDocument();
    expect(thumbElement).toHaveClass(
      'pointer-events-none',
      'block',
      'h-5',
      'w-5',
      'rounded-full',
      'bg-background',
      'shadow-lg',
      'ring-0',
      'transition-transform'
    );
  });

  it('should translate thumb when checked', () => {
    renderWithoutProviders(<Switch defaultChecked />);

    const switchElement = screen.getByRole('switch');
    const thumbElement = switchElement.querySelector('.pointer-events-none');

    expect(thumbElement).toHaveClass('data-[state=checked]:translate-x-5');
  });

  it('should not translate thumb when unchecked', () => {
    renderWithoutProviders(<Switch />);

    const switchElement = screen.getByRole('switch');
    const thumbElement = switchElement.querySelector('.pointer-events-none');

    expect(thumbElement).toHaveClass('data-[state=unchecked]:translate-x-0');
  });

  it('should handle form submission', () => {
    const handleSubmit = vi.fn((e) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      return formData.get('custom-switch');
    });

    renderWithoutProviders(
      <form onSubmit={handleSubmit}>
        <Switch defaultChecked name="custom-switch" />
        <button type="submit">Submit</button>
      </form>
    );

    const form = screen
      .getByRole('button', { name: SUBMIT_REGEX })
      .closest('form');
    form?.dispatchEvent(new Event('submit', { bubbles: true }));

    expect(handleSubmit).toHaveBeenCalled();
  });

  it('should work with label element', async () => {
    const user = userEvent.setup();

    renderWithoutProviders(
      <>
        <label htmlFor="custom-switch">Custom Switch</label>
        <Switch id="custom-switch" />
      </>
    );

    const label = screen.getByText(CUSTOM_SWITCH_REGEX);
    const switchElement = screen.getByRole('switch');

    // Click label should toggle switch
    await user.click(label);
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
  });
});
