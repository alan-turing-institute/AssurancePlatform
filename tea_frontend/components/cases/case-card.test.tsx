import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/src/__tests__/mocks/server';
import { createMockAssuranceCase } from '@/src/__tests__/utils/mock-data';
import { renderWithAuth, screen } from '@/src/__tests__/utils/test-utils';
import CaseCard from './case-card';

// Mock the AlertModal component
vi.mock('@/components/modals/alertModal', () => ({
  AlertModal: ({
    isOpen,
    onClose,
    onConfirm,
    loading,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    loading: boolean;
  }) => {
    if (!isOpen) {
      return null;
    }
    return (
      <div data-testid="alert-modal">
        <p>Are you sure you want to delete this case?</p>
        <button onClick={onClose}>Cancel</button>
        <button disabled={loading} onClick={onConfirm}>
          {loading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    );
  },
}));

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({}),
}));

describe('CaseCard', () => {
  const mockAssuranceCase = createMockAssuranceCase({
    id: 1,
    name: 'Test Safety Case',
    description: 'A comprehensive safety assurance case',
    created_date: '2024-01-15T10:30:00Z',
    images: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  it('should render case information correctly', () => {
    renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

    expect(screen.getByText('Test Safety Case')).toBeInTheDocument();
    expect(
      screen.getByText('A comprehensive safety assurance case')
    ).toBeInTheDocument();

    // Check formatted date
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
  });

  it('should render action buttons', () => {
    renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

    // Check for action buttons (Eye, Edit, Delete icons)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);

    // Check for specific action icons
    expect(screen.getByTestId('view-case-button')).toBeInTheDocument();
    expect(screen.getByTestId('edit-case-button')).toBeInTheDocument();
    expect(screen.getByTestId('delete-case-button')).toBeInTheDocument();
  });

  it('should navigate to case view when view button is clicked', async () => {
    const user = userEvent.setup();
    renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

    const viewButton = screen.getByTestId('view-case-button');
    await user.click(viewButton);

    expect(mockPush).toHaveBeenCalledWith('/case/1');
  });

  it('should navigate to case edit when edit button is clicked', async () => {
    const user = userEvent.setup();
    renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

    const editButton = screen.getByTestId('edit-case-button');
    await user.click(editButton);

    expect(mockPush).toHaveBeenCalledWith('/case/1?edit=true');
  });

  it('should open delete confirmation modal when delete button is clicked', async () => {
    const user = userEvent.setup();
    renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

    const deleteButton = screen.getByTestId('delete-case-button');
    await user.click(deleteButton);

    expect(screen.getByTestId('alert-modal')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to delete this case?')
    ).toBeInTheDocument();
  });

  it('should close delete modal when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

    // Open modal
    const deleteButton = screen.getByTestId('delete-case-button');
    await user.click(deleteButton);

    expect(screen.getByTestId('alert-modal')).toBeInTheDocument();

    // Close modal
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(screen.queryByTestId('alert-modal')).not.toBeInTheDocument();
  });

  it('should handle successful case deletion', async () => {
    const user = userEvent.setup();

    // Mock successful deletion
    server.use(
      http.delete(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/cases/1/`,
        () => {
          return new HttpResponse(null, { status: 204 });
        }
      )
    );

    renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

    // Open delete modal
    const deleteButton = screen.getByTestId('delete-case-button');
    await user.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByText('Delete');
    await user.click(confirmButton);

    // Should show loading state
    expect(screen.getByText('Deleting...')).toBeInTheDocument();

    // Should redirect after successful deletion
    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should handle case deletion failure', async () => {
    const user = userEvent.setup();

    // Mock failed deletion
    server.use(
      http.delete(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/cases/1/`,
        () => {
          return new HttpResponse(null, { status: 500 });
        }
      )
    );

    renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

    // Open delete modal
    const deleteButton = screen.getByTestId('delete-case-button');
    await user.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByText('Delete');
    await user.click(confirmButton);

    // Should not redirect on failure
    await vi.waitFor(() => {
      expect(mockPush).not.toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should render placeholder when no image is available', () => {
    renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

    // Should render skeleton or placeholder for image
    const imageContainer = screen.getByTestId('case-image-container');
    expect(imageContainer).toBeInTheDocument();
  });

  it('should render case with image when available', () => {
    const caseWithImage = createMockAssuranceCase({
      ...mockAssuranceCase,
      images: [{ url: 'https://example.com/case-image.png' }] as any,
    });

    renderWithAuth(<CaseCard assuranceCase={caseWithImage} />);

    const image = screen.getByAltText('Test Safety Case');
    expect(image).toBeInTheDocument();
  });

  it('should have proper card structure and styling', () => {
    renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

    // Check for card components
    const card = screen.getByTestId('case-card');
    expect(card).toBeInTheDocument();

    // Check for proper sections
    expect(screen.getByTestId('case-header')).toBeInTheDocument();
    expect(screen.getByTestId('case-content')).toBeInTheDocument();
    expect(screen.getByTestId('case-footer')).toBeInTheDocument();
  });

  it('should format date correctly for different timezones', () => {
    const caseWithDifferentDate = createMockAssuranceCase({
      ...mockAssuranceCase,
      created_date: '2024-06-30T23:59:59Z',
    });

    renderWithAuth(<CaseCard assuranceCase={caseWithDifferentDate} />);

    // Should display formatted date
    expect(screen.getByText(/Jun 30, 2024/)).toBeInTheDocument();
  });

  it('should be accessible via keyboard navigation', async () => {
    const user = userEvent.setup();
    renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

    // Tab through buttons
    await user.tab();
    expect(screen.getByTestId('view-case-button')).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId('edit-case-button')).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId('delete-case-button')).toHaveFocus();
  });

  it('should handle long case names and descriptions', () => {
    const caseWithLongText = createMockAssuranceCase({
      ...mockAssuranceCase,
      name: 'This is a very long case name that should be handled properly in the UI without breaking the layout',
      description:
        'This is a very long description that contains a lot of text to test how the component handles text overflow and maintains proper layout structure',
    });

    renderWithAuth(<CaseCard assuranceCase={caseWithLongText} />);

    expect(
      screen.getByText(/This is a very long case name/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This is a very long description/)
    ).toBeInTheDocument();
  });

  it('should handle missing or invalid date gracefully', () => {
    const caseWithInvalidDate = createMockAssuranceCase({
      ...mockAssuranceCase,
      created_date: '',
    });

    renderWithAuth(<CaseCard assuranceCase={caseWithInvalidDate} />);

    // Should still render the card without crashing
    expect(screen.getByText('Test Safety Case')).toBeInTheDocument();
  });
});
