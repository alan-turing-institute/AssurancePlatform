import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockAssuranceCase,
  mockAssuranceCase,
} from '@/src/__tests__/utils/mock-data';
import {
  renderWithAuth,
  screen,
  userEvent,
} from '@/src/__tests__/utils/test-utils';
import CaseDetails from './case-details';

// Mock the store
const mockStore = {
  assuranceCase: mockAssuranceCase as any,
};

vi.mock('@/data/store', () => ({
  default: () => mockStore,
}));

// Mock child components
vi.mock('./CaseEditForm', () => ({
  default: ({
    onClose,
    setUnresolvedChanges,
  }: {
    onClose: () => void;
    setUnresolvedChanges: (val: boolean) => void;
  }) => (
    <div data-testid="case-edit-form">
      <button onClick={onClose}>Close Form</button>
      <button onClick={() => setUnresolvedChanges(true)}>Make Changes</button>
      <button onClick={() => setUnresolvedChanges(false)}>Save Changes</button>
    </div>
  ),
}));

vi.mock('../ui/case-sheet', () => ({
  default: ({
    title,
    description,
    isOpen,
    onClose,
    onChange,
    children,
  }: {
    title: string;
    description: string;
    isOpen: boolean;
    onClose: () => void;
    onChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (
    <div data-open={isOpen} data-testid="case-sheet">
      <h1>{title}</h1>
      <p>{description}</p>
      <button onClick={() => onChange(false)}>Sheet Close</button>
      <button onClick={onClose}>Direct Close</button>
      {children}
    </div>
  ),
}));

vi.mock('../modals/alertModal', () => ({
  AlertModal: ({
    isOpen,
    onClose,
    onConfirm,
    message,
    confirmButtonText,
    cancelButtonText,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    message: string;
    confirmButtonText: string;
    cancelButtonText: string;
  }) =>
    isOpen ? (
      <div data-testid="alert-modal">
        <p>{message}</p>
        <button onClick={onConfirm}>{confirmButtonText}</button>
        <button onClick={onClose}>{cancelButtonText}</button>
      </div>
    ) : null,
}));

describe('CaseDetails', () => {
  const mockSetOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.assuranceCase = createMockAssuranceCase({
      permissions: 'manage',
    });
  });

  describe('Component Mounting', () => {
    it('should not render before mounting', () => {
      // Mock useState to simulate unmounted state
      const useStateSpy = vi.spyOn(React, 'useState');
      useStateSpy.mockReturnValueOnce([false, vi.fn()]); // isMounted = false
      useStateSpy.mockReturnValueOnce([false, vi.fn()]); // loading
      useStateSpy.mockReturnValueOnce([false, vi.fn()]); // unresolvedChanges
      useStateSpy.mockReturnValueOnce([false, vi.fn()]); // alertOpen

      const { container } = renderWithAuth(
        <CaseDetails isOpen={true} setOpen={mockSetOpen} />
      );

      expect(container.firstChild).toBeNull();
      useStateSpy.mockRestore();
    });

    it('should render after mounting', () => {
      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      expect(screen.getByTestId('case-sheet')).toBeInTheDocument();
    });
  });

  describe('Sheet Rendering', () => {
    it('should render with correct title for manage permissions', () => {
      mockStore.assuranceCase = createMockAssuranceCase({
        permissions: 'manage',
      });

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      expect(screen.getByText('Update Assurance Case')).toBeInTheDocument();
    });

    it('should render with correct title for non-manage permissions', () => {
      mockStore.assuranceCase = createMockAssuranceCase({});

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      expect(screen.getByText('Assurance Case')).toBeInTheDocument();
    });

    it('should render with correct description', () => {
      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      expect(
        screen.getByText(
          'Use this form to update your assurance case name and description.'
        )
      ).toBeInTheDocument();
    });

    it('should pass open state to sheet', () => {
      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      expect(screen.getByTestId('case-sheet')).toHaveAttribute(
        'data-open',
        'true'
      );
    });

    it('should render CaseEditForm inside sheet', () => {
      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      expect(screen.getByTestId('case-edit-form')).toBeInTheDocument();
    });
  });

  describe('Close Handling', () => {
    it('should handle direct close without unsaved changes', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      const directCloseButton = screen.getByText('Direct Close');
      await user.click(directCloseButton);

      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });

    it('should handle sheet close without unsaved changes', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      const sheetCloseButton = screen.getByText('Sheet Close');
      await user.click(sheetCloseButton);

      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });

    it('should close from edit form without unsaved changes', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      const formCloseButton = screen.getByText('Close Form');
      await user.click(formCloseButton);

      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });

  describe('Unsaved Changes Handling', () => {
    it('should show alert modal when closing with unsaved changes', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      // Make changes to trigger unsaved state
      const makeChangesButton = screen.getByText('Make Changes');
      await user.click(makeChangesButton);

      // Try to close via sheet
      const sheetCloseButton = screen.getByText('Sheet Close');
      await user.click(sheetCloseButton);

      // Should show alert modal instead of closing
      expect(screen.getByTestId('alert-modal')).toBeInTheDocument();
      expect(mockSetOpen).not.toHaveBeenCalled();
    });

    it('should display correct alert modal message', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      const makeChangesButton = screen.getByText('Make Changes');
      await user.click(makeChangesButton);

      const sheetCloseButton = screen.getByText('Sheet Close');
      await user.click(sheetCloseButton);

      expect(
        screen.getByText(
          'You have changes that have not been updated. Would you like to discard these changes?'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('Yes, discard changes!')).toBeInTheDocument();
      expect(screen.getByText('No, keep editing')).toBeInTheDocument();
    });

    it('should close when confirming discard changes', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      // Make changes
      const makeChangesButton = screen.getByText('Make Changes');
      await user.click(makeChangesButton);

      // Try to close
      const sheetCloseButton = screen.getByText('Sheet Close');
      await user.click(sheetCloseButton);

      // Confirm discard
      const discardButton = screen.getByText('Yes, discard changes!');
      await user.click(discardButton);

      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });

    it('should not close when canceling discard changes', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      // Make changes
      const makeChangesButton = screen.getByText('Make Changes');
      await user.click(makeChangesButton);

      // Try to close
      const sheetCloseButton = screen.getByText('Sheet Close');
      await user.click(sheetCloseButton);

      // Cancel discard
      const cancelButton = screen.getByText('No, keep editing');
      await user.click(cancelButton);

      expect(mockSetOpen).not.toHaveBeenCalled();
      expect(screen.queryByTestId('alert-modal')).not.toBeInTheDocument();
    });

    it('should allow closing after saving changes', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      // Make changes
      const makeChangesButton = screen.getByText('Make Changes');
      await user.click(makeChangesButton);

      // Save changes
      const saveChangesButton = screen.getByText('Save Changes');
      await user.click(saveChangesButton);

      // Now should be able to close without alert
      const sheetCloseButton = screen.getByText('Sheet Close');
      await user.click(sheetCloseButton);

      expect(mockSetOpen).toHaveBeenCalledWith(false);
      expect(screen.queryByTestId('alert-modal')).not.toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    it('should reset alert state when closing', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      // Make changes and trigger alert
      const makeChangesButton = screen.getByText('Make Changes');
      await user.click(makeChangesButton);

      const sheetCloseButton = screen.getByText('Sheet Close');
      await user.click(sheetCloseButton);

      expect(screen.getByTestId('alert-modal')).toBeInTheDocument();

      // Discard changes (close)
      const discardButton = screen.getByText('Yes, discard changes!');
      await user.click(discardButton);

      // Alert should be hidden
      expect(screen.queryByTestId('alert-modal')).not.toBeInTheDocument();
    });

    it('should reset unresolved changes state when closing', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      // Make changes
      const makeChangesButton = screen.getByText('Make Changes');
      await user.click(makeChangesButton);

      // Close directly (this should reset the state)
      const directCloseButton = screen.getByText('Direct Close');
      await user.click(directCloseButton);

      // Re-render to test if state is reset
      mockSetOpen.mockClear();
      const { rerender } = renderWithAuth(
        <CaseDetails isOpen={true} setOpen={mockSetOpen} />
      );

      // Should be able to close without alert now
      const sheetCloseButton = screen.getByText('Sheet Close');
      await user.click(sheetCloseButton);

      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });

  describe('Props Integration', () => {
    it('should respond to isOpen prop changes', () => {
      const { rerender } = renderWithAuth(
        <CaseDetails isOpen={false} setOpen={mockSetOpen} />
      );

      expect(screen.getByTestId('case-sheet')).toHaveAttribute(
        'data-open',
        'false'
      );

      rerender(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      expect(screen.getByTestId('case-sheet')).toHaveAttribute(
        'data-open',
        'true'
      );
    });

    it('should call setOpen prop when closing', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      const directCloseButton = screen.getByText('Direct Close');
      await user.click(directCloseButton);

      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });

  describe('Store Integration', () => {
    it('should use assurance case data from store', () => {
      mockStore.assuranceCase = createMockAssuranceCase({});

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      // Should show title based on permissions from store
      expect(screen.getByText('Assurance Case')).toBeInTheDocument();
    });

    it('should handle missing permissions in store data', () => {
      mockStore.assuranceCase = createMockAssuranceCase({
        permissions: undefined,
      });

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      // Should handle undefined permissions gracefully
      expect(screen.getByText('Assurance Case')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should render with proper heading structure', () => {
      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Update Assurance Case');
    });

    it('should have accessible modal behavior', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      // Make changes to trigger modal
      const makeChangesButton = screen.getByText('Make Changes');
      await user.click(makeChangesButton);

      const sheetCloseButton = screen.getByText('Sheet Close');
      await user.click(sheetCloseButton);

      // Alert modal should be accessible
      const alertModal = screen.getByTestId('alert-modal');
      expect(alertModal).toBeInTheDocument();

      // Should have action buttons
      expect(
        screen.getByRole('button', { name: /yes, discard changes/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /no, keep editing/i })
      ).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null assurance case gracefully', () => {
      mockStore.assuranceCase = null;

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      // Should not crash and render basic structure
      expect(screen.getByTestId('case-sheet')).toBeInTheDocument();
    });

    it('should handle multiple rapid state changes', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      // Rapidly change states
      const makeChangesButton = screen.getByText('Make Changes');
      const saveChangesButton = screen.getByText('Save Changes');

      await user.click(makeChangesButton);
      await user.click(saveChangesButton);
      await user.click(makeChangesButton);

      // Should handle state changes without crashing
      expect(screen.getByTestId('case-edit-form')).toBeInTheDocument();
    });

    it('should handle concurrent close attempts', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseDetails isOpen={true} setOpen={mockSetOpen} />);

      // Try multiple close methods simultaneously
      const directCloseButton = screen.getByText('Direct Close');
      const sheetCloseButton = screen.getByText('Sheet Close');

      await Promise.all([
        user.click(directCloseButton),
        user.click(sheetCloseButton),
      ]);

      // Should handle gracefully
      expect(mockSetOpen).toHaveBeenCalled();
    });
  });
});
