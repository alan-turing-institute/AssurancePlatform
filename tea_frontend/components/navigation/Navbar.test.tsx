import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  render,
  renderWithAuth,
  screen,
} from '@/src/__tests__/utils/test-utils';
import { Navbar } from './navbar';

// Mock the navigation components to focus on Navbar logic
vi.mock('./mobile-nav', () => ({
  MobileNav: ({ sidebarOpen, setSidebarOpen }: any) => (
    <div data-sidebar-open={sidebarOpen} data-testid="mobile-nav">
      <button onClick={() => setSidebarOpen(!sidebarOpen)}>
        Toggle Mobile Nav
      </button>
    </div>
  ),
}));

vi.mock('./desktop-nav', () => ({
  default: () => <div data-testid="desktop-nav">Desktop Navigation</div>,
}));

vi.mock('./menu-toggle', () => ({
  default: ({ setSidebarOpen }: any) => (
    <button data-testid="menu-toggle" onClick={() => setSidebarOpen(true)}>
      Menu Toggle
    </button>
  ),
}));

vi.mock('@/components/FeedbackBanner', () => ({
  default: () => <div data-testid="feedback-banner">Feedback Banner</div>,
}));

// Mock next/navigation with different pathname scenarios
const mockUsePathname = vi.fn();
vi.mock('next/navigation', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    usePathname: () => mockUsePathname(),
  };
});

describe('Navbar', () => {
  const renderNavbar = (children = <div>Test Content</div>) => {
    return render(<Navbar>{children}</Navbar>);
  };

  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
  });

  it('should render all navigation components', () => {
    renderNavbar();

    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
    expect(screen.getByTestId('desktop-nav')).toBeInTheDocument();
    expect(screen.getByTestId('menu-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-banner')).toBeInTheDocument();
  });

  it('should render children content in main section', () => {
    renderNavbar(<div data-testid="custom-content">Custom Content</div>);

    const mainSection = screen.getByRole('main');
    expect(mainSection).toBeInTheDocument();
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
  });

  it('should display correct page name for root path', () => {
    mockUsePathname.mockReturnValue('/');
    renderNavbar();

    expect(screen.getByText('assurance cases')).toBeInTheDocument();
  });

  it('should display correct page name for case studies path', () => {
    mockUsePathname.mockReturnValue('/dashboard/case-studies');
    renderNavbar();

    expect(screen.getByText('Case Studies')).toBeInTheDocument();
  });

  it('should display last path segment as page name for other paths', () => {
    mockUsePathname.mockReturnValue('/dashboard/settings/profile');
    renderNavbar();

    expect(screen.getByText('profile')).toBeInTheDocument();
  });

  it('should handle menu toggle interaction', async () => {
    const user = userEvent.setup();
    renderNavbar();

    const menuToggle = screen.getByTestId('menu-toggle');
    await user.click(menuToggle);

    const mobileNav = screen.getByTestId('mobile-nav');
    expect(mobileNav).toHaveAttribute('data-sidebar-open', 'true');
  });

  it('should have proper layout structure', () => {
    renderNavbar();

    // Check for main layout container
    const mainContainer = screen.getByRole('main');
    expect(mainContainer).toHaveClass('bg-background', 'text-foreground');

    // Check for sticky header
    const header = mainContainer.previousElementSibling;
    expect(header).toHaveClass('sticky', 'top-0', 'z-40', 'h-16');
  });

  it('should render with authentication context', () => {
    renderWithAuth(
      <Navbar>
        <div>Authenticated Content</div>
      </Navbar>
    );

    expect(screen.getByText('Authenticated Content')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
  });

  it('should have responsive design classes', () => {
    renderNavbar();

    // Check for desktop layout
    const desktopContainer = screen.getByTestId('desktop-nav').parentElement;
    expect(desktopContainer).toHaveClass('lg:pl-72');

    // Check for responsive header spacing
    const header = screen.getByRole('main').previousElementSibling;
    expect(header).toHaveClass(
      'gap-x-4',
      'sm:gap-x-6',
      'px-4',
      'sm:px-6',
      'lg:px-8'
    );
  });

  it('should handle empty path segments correctly', () => {
    mockUsePathname.mockReturnValue('/dashboard/');
    renderNavbar();

    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('should capitalize page names correctly', () => {
    mockUsePathname.mockReturnValue('/dashboard/user-management');
    renderNavbar();

    const pageTitle = screen.getByRole('heading', { level: 2 });
    expect(pageTitle).toHaveClass('capitalize');
    expect(pageTitle).toHaveTextContent('user-management');
  });

  it('should manage sidebar state independently', async () => {
    const user = userEvent.setup();
    renderNavbar();

    const mobileNav = screen.getByTestId('mobile-nav');
    expect(mobileNav).toHaveAttribute('data-sidebar-open', 'false');

    // Toggle via menu button
    const menuToggle = screen.getByTestId('menu-toggle');
    await user.click(menuToggle);
    expect(mobileNav).toHaveAttribute('data-sidebar-open', 'true');

    // Toggle via mobile nav button
    const mobileNavToggle = screen.getByText('Toggle Mobile Nav');
    await user.click(mobileNavToggle);
    expect(mobileNav).toHaveAttribute('data-sidebar-open', 'false');
  });

  it('should have proper semantic structure', () => {
    renderNavbar();

    // Check for main landmark
    expect(screen.getByRole('main')).toBeInTheDocument();

    // Check for page heading
    const pageHeading = screen.getByRole('heading', { level: 2 });
    expect(pageHeading).toBeInTheDocument();

    // Check for navigation components
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
    expect(screen.getByTestId('desktop-nav')).toBeInTheDocument();
  });
});
