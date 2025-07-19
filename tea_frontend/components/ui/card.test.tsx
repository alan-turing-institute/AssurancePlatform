import { describe, expect, it, vi } from 'vitest';
import {
  renderWithoutProviders,
  screen,
} from '@/src/__tests__/utils/test-utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';

// Regex constants for text matching
const CARD_CONTENT_REGEX = /card content/i;
const CARD_TITLE_REGEX = /card title/i;
const CARD_DESCRIPTION_REGEX = /card description/i;
const CARD_FOOTER_REGEX = /card footer/i;
const CUSTOM_CARD_REGEX = /custom card/i;
const HEADER_CONTENT_REGEX = /header content/i;
const FOOTER_BUTTON_REGEX = /footer button/i;

describe('Card', () => {
  describe('Card component', () => {
    it('should render with default props', () => {
      renderWithoutProviders(<Card>Card content</Card>);

      const card = screen.getByText(CARD_CONTENT_REGEX);
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass(
        'rounded-lg',
        'border',
        'bg-card',
        'text-card-foreground',
        'shadow-sm'
      );
    });

    it('should accept custom className', () => {
      renderWithoutProviders(<Card className="custom-class">Custom card</Card>);

      const card = screen.getByText(CUSTOM_CARD_REGEX);
      expect(card).toHaveClass('custom-class');
      // Should also maintain default classes
      expect(card).toHaveClass('rounded-lg', 'border');
    });

    it('should forward ref correctly', () => {
      const ref = vi.fn();

      renderWithoutProviders(<Card ref={ref}>Card with ref</Card>);

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });

    it('should pass through additional props', () => {
      renderWithoutProviders(
        <Card aria-label="Custom card" data-testid="custom-card">
          Card content
        </Card>
      );

      const card = screen.getByTestId('custom-card');
      expect(card).toHaveAttribute('aria-label', 'Custom card');
    });
  });

  describe('CardHeader component', () => {
    it('should render with default props', () => {
      renderWithoutProviders(<CardHeader>Header content</CardHeader>);

      const header = screen.getByText(HEADER_CONTENT_REGEX);
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'p-6');
    });

    it('should accept custom className', () => {
      renderWithoutProviders(
        <CardHeader className="custom-header">Header content</CardHeader>
      );

      const header = screen.getByText(HEADER_CONTENT_REGEX);
      expect(header).toHaveClass('custom-header');
      expect(header).toHaveClass('flex', 'flex-col');
    });

    it('should forward ref correctly', () => {
      const ref = vi.fn();

      renderWithoutProviders(<CardHeader ref={ref}>Header</CardHeader>);

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  describe('CardTitle component', () => {
    it('should render as h3 element with default props', () => {
      renderWithoutProviders(<CardTitle>Card Title</CardTitle>);

      const title = screen.getByText(CARD_TITLE_REGEX);
      expect(title).toBeInTheDocument();
      expect(title.tagName).toBe('H3');
      expect(title).toHaveClass(
        'font-semibold',
        'text-2xl',
        'leading-none',
        'tracking-tight'
      );
    });

    it('should accept custom className', () => {
      renderWithoutProviders(
        <CardTitle className="custom-title">Card Title</CardTitle>
      );

      const title = screen.getByText(CARD_TITLE_REGEX);
      expect(title).toHaveClass('custom-title');
      expect(title).toHaveClass('font-semibold');
    });

    it('should forward ref correctly', () => {
      const ref = vi.fn();

      renderWithoutProviders(<CardTitle ref={ref}>Title</CardTitle>);

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLHeadingElement));
    });
  });

  describe('CardDescription component', () => {
    it('should render as p element with default props', () => {
      renderWithoutProviders(
        <CardDescription>Card Description</CardDescription>
      );

      const description = screen.getByText(CARD_DESCRIPTION_REGEX);
      expect(description).toBeInTheDocument();
      expect(description.tagName).toBe('P');
      expect(description).toHaveClass('text-muted-foreground', 'text-sm');
    });

    it('should accept custom className', () => {
      renderWithoutProviders(
        <CardDescription className="custom-description">
          Card Description
        </CardDescription>
      );

      const description = screen.getByText(CARD_DESCRIPTION_REGEX);
      expect(description).toHaveClass('custom-description');
      expect(description).toHaveClass('text-muted-foreground');
    });

    it('should forward ref correctly', () => {
      const ref = vi.fn();

      renderWithoutProviders(
        <CardDescription ref={ref}>Description</CardDescription>
      );

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLParagraphElement));
    });
  });

  describe('CardContent component', () => {
    it('should render with default props', () => {
      renderWithoutProviders(<CardContent>Card content</CardContent>);

      const content = screen.getByText(CARD_CONTENT_REGEX);
      expect(content).toBeInTheDocument();
      expect(content).toHaveClass('p-6', 'pt-0');
    });

    it('should accept custom className', () => {
      renderWithoutProviders(
        <CardContent className="custom-content">Card content</CardContent>
      );

      const content = screen.getByText(CARD_CONTENT_REGEX);
      expect(content).toHaveClass('custom-content');
      expect(content).toHaveClass('p-6', 'pt-0');
    });

    it('should forward ref correctly', () => {
      const ref = vi.fn();

      renderWithoutProviders(<CardContent ref={ref}>Content</CardContent>);

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  describe('CardFooter component', () => {
    it('should render with default props', () => {
      renderWithoutProviders(<CardFooter>Card footer</CardFooter>);

      const footer = screen.getByText(CARD_FOOTER_REGEX);
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0');
    });

    it('should accept custom className', () => {
      renderWithoutProviders(
        <CardFooter className="custom-footer">Card footer</CardFooter>
      );

      const footer = screen.getByText(CARD_FOOTER_REGEX);
      expect(footer).toHaveClass('custom-footer');
      expect(footer).toHaveClass('flex', 'items-center');
    });

    it('should forward ref correctly', () => {
      const ref = vi.fn();

      renderWithoutProviders(<CardFooter ref={ref}>Footer</CardFooter>);

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  describe('Card composition', () => {
    it('should render complete card with all parts', () => {
      renderWithoutProviders(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent>Card content</CardContent>
          <CardFooter>Card footer</CardFooter>
        </Card>
      );

      expect(screen.getByText(CARD_TITLE_REGEX)).toBeInTheDocument();
      expect(screen.getByText(CARD_DESCRIPTION_REGEX)).toBeInTheDocument();
      expect(screen.getByText(CARD_CONTENT_REGEX)).toBeInTheDocument();
      expect(screen.getByText(CARD_FOOTER_REGEX)).toBeInTheDocument();
    });

    it('should render card with only header and content', () => {
      renderWithoutProviders(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
          <CardContent>Card content</CardContent>
        </Card>
      );

      expect(screen.getByText(CARD_TITLE_REGEX)).toBeInTheDocument();
      expect(screen.getByText(CARD_CONTENT_REGEX)).toBeInTheDocument();
      expect(screen.queryByText(CARD_FOOTER_REGEX)).not.toBeInTheDocument();
    });

    it('should render card with interactive elements', () => {
      const handleClick = vi.fn();

      renderWithoutProviders(
        <Card>
          <CardHeader>
            <CardTitle>Interactive Card</CardTitle>
            <CardDescription>Click the button below</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Some content here</p>
          </CardContent>
          <CardFooter>
            <button onClick={handleClick} type="button">
              Footer Button
            </button>
          </CardFooter>
        </Card>
      );

      const button = screen.getByText(FOOTER_BUTTON_REGEX);
      expect(button).toBeInTheDocument();
      button.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should maintain proper spacing with custom classes', () => {
      renderWithoutProviders(
        <Card className="w-full max-w-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Small Title</CardTitle>
            <CardDescription className="mt-2">
              Custom spacing description
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>Content section 1</div>
            <div>Content section 2</div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <button type="button">Cancel</button>
            <button type="button">Save</button>
          </CardFooter>
        </Card>
      );

      const card = screen.getByText(/Small Title/i).closest('.rounded-lg');
      expect(card).toHaveClass('w-full', 'max-w-md');

      const header = screen.getByText(/Small Title/i).parentElement;
      expect(header).toHaveClass('pb-4');

      const content = screen.getByText(/Content section 1/i).parentElement;
      expect(content).toHaveClass('space-y-4');

      const footer = screen.getByText(/Cancel/i).parentElement;
      expect(footer).toHaveClass('justify-end', 'gap-2');
    });

    it('should support nested cards', () => {
      renderWithoutProviders(
        <Card>
          <CardHeader>
            <CardTitle>Parent Card</CardTitle>
          </CardHeader>
          <CardContent>
            <Card>
              <CardHeader>
                <CardTitle>Nested Card</CardTitle>
              </CardHeader>
              <CardContent>Nested content</CardContent>
            </Card>
          </CardContent>
        </Card>
      );

      expect(screen.getByText(/Parent Card/i)).toBeInTheDocument();
      expect(screen.getByText(/Nested Card/i)).toBeInTheDocument();
      expect(screen.getByText(/Nested content/i)).toBeInTheDocument();

      // Both cards should have the card styles
      const cards = screen
        .getByText(/Parent Card/i)
        .closest('.rounded-lg')
        ?.parentElement?.querySelectorAll('.rounded-lg');
      expect(cards).toHaveLength(2);
    });

    it('should handle long content gracefully', () => {
      const longTitle =
        'This is a very long title that might wrap to multiple lines';
      const longDescription =
        'This is a very long description that contains a lot of text and should handle wrapping properly without breaking the card layout';
      const longContent =
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

      renderWithoutProviders(
        <Card>
          <CardHeader>
            <CardTitle>{longTitle}</CardTitle>
            <CardDescription>{longDescription}</CardDescription>
          </CardHeader>
          <CardContent>{longContent}</CardContent>
        </Card>
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
      expect(screen.getByText(longDescription)).toBeInTheDocument();
      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    it('should support accessibility attributes on all components', () => {
      renderWithoutProviders(
        <Card aria-label="Main card" role="article">
          <CardHeader aria-label="Card header section">
            <CardTitle id="card-title">Accessible Card</CardTitle>
            <CardDescription id="card-desc">
              This card has accessibility attributes
            </CardDescription>
          </CardHeader>
          <CardContent aria-describedby="card-desc">
            Content with description reference
          </CardContent>
          <CardFooter role="contentinfo">Footer with role</CardFooter>
        </Card>
      );

      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('aria-label', 'Main card');

      const title = screen.getByText(/Accessible Card/i);
      expect(title).toHaveAttribute('id', 'card-title');

      const footer = screen.getByRole('contentinfo');
      expect(footer).toBeInTheDocument();
    });
  });
});
