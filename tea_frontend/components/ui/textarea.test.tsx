import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  renderWithoutProviders,
  screen,
} from '@/src/__tests__/utils/test-utils';
import { Textarea } from './textarea';

// Regex constants for text matching
const DESCRIPTION_TEXTAREA_REGEX = /description textarea/i;
const ENTER_COMMENT_REGEX = /enter your comment/i;

describe('Textarea', () => {
  it('should render with default props', () => {
    renderWithoutProviders(<Textarea />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveClass(
      'flex',
      'min-h-[80px]',
      'w-full',
      'rounded-md',
      'border'
    );
  });

  it('should handle value changes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    renderWithoutProviders(<Textarea onChange={handleChange} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'This is a test comment');

    expect(textarea).toHaveValue('This is a test comment');
    expect(handleChange).toHaveBeenCalled();
  });

  it('should handle multiline text input', async () => {
    const user = userEvent.setup();

    renderWithoutProviders(<Textarea />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Line 1{Enter}Line 2{Enter}Line 3');

    expect(textarea).toHaveValue('Line 1\nLine 2\nLine 3');
  });

  it('should display placeholder text', () => {
    renderWithoutProviders(<Textarea placeholder="Enter your comment" />);

    const textarea = screen.getByPlaceholderText(ENTER_COMMENT_REGEX);
    expect(textarea).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    renderWithoutProviders(<Textarea disabled />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveClass(
      'disabled:cursor-not-allowed',
      'disabled:opacity-50'
    );
  });

  it('should accept custom className', () => {
    renderWithoutProviders(<Textarea className="custom-textarea-class" />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveClass('custom-textarea-class');
    // Should also retain default classes
    expect(textarea).toHaveClass('flex', 'min-h-[80px]', 'w-full');
  });

  it('should handle defaultValue', () => {
    renderWithoutProviders(<Textarea defaultValue="Default text content" />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('Default text content');
  });

  it('should handle controlled value', () => {
    const { rerender } = renderWithoutProviders(
      <Textarea readOnly value="controlled value" />
    );

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('controlled value');

    rerender(<Textarea readOnly value="updated controlled value" />);
    expect(textarea).toHaveValue('updated controlled value');
  });

  it('should forward ref correctly', () => {
    const ref = vi.fn();

    renderWithoutProviders(<Textarea ref={ref} />);

    expect(ref).toHaveBeenCalledWith(expect.any(HTMLTextAreaElement));
  });

  it('should have correct accessibility attributes', () => {
    renderWithoutProviders(
      <Textarea
        aria-describedby="description-help"
        aria-label="Description textarea"
        required
      />
    );

    const textarea = screen.getByRole('textbox', {
      name: DESCRIPTION_TEXTAREA_REGEX,
    });
    expect(textarea).toHaveAttribute('aria-label', 'Description textarea');
    expect(textarea).toHaveAttribute('aria-describedby', 'description-help');
    expect(textarea).toBeRequired();
  });

  it('should handle focus and blur events', async () => {
    const user = userEvent.setup();
    const handleFocus = vi.fn();
    const handleBlur = vi.fn();

    renderWithoutProviders(
      <Textarea onBlur={handleBlur} onFocus={handleFocus} />
    );

    const textarea = screen.getByRole('textbox');

    await user.click(textarea);
    expect(handleFocus).toHaveBeenCalledTimes(1);

    await user.tab();
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('should prevent input when readOnly', async () => {
    const user = userEvent.setup();

    renderWithoutProviders(<Textarea readOnly value="readonly content" />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'should not change');

    expect(textarea).toHaveValue('readonly content');
  });

  it('should respect rows attribute', () => {
    renderWithoutProviders(<Textarea rows={10} />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('rows', '10');
  });

  it('should respect cols attribute', () => {
    renderWithoutProviders(<Textarea cols={50} />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('cols', '50');
  });

  it('should handle maxLength attribute', async () => {
    const user = userEvent.setup();

    renderWithoutProviders(<Textarea maxLength={10} />);

    const textarea = screen.getByRole('textbox');
    await user.type(
      textarea,
      'This is a very long text that exceeds the limit'
    );

    expect(textarea).toHaveValue('This is a ');
    expect((textarea as HTMLTextAreaElement).value.length).toBe(10);
  });

  it('should have proper styling classes', () => {
    renderWithoutProviders(<Textarea />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveClass(
      'flex',
      'min-h-[80px]',
      'w-full',
      'rounded-md',
      'border',
      'border-input',
      'bg-background',
      'px-3',
      'py-2',
      'text-sm',
      'ring-offset-background',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-ring',
      'focus-visible:ring-offset-2'
    );
  });

  it('should handle resize attribute', () => {
    renderWithoutProviders(<Textarea style={{ resize: 'none' }} />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveStyle({ resize: 'none' });
  });

  it('should handle autoComplete attribute', () => {
    renderWithoutProviders(<Textarea autoComplete="off" />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('autoComplete', 'off');
  });

  it('should handle spellCheck attribute', () => {
    renderWithoutProviders(<Textarea spellCheck={false} />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('spellcheck', 'false');
  });
});
