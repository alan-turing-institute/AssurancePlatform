import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { useSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useStore from '@/data/store';
import { server } from '@/src/__tests__/mocks/server';
import { createMockAssuranceCase } from '@/src/__tests__/utils/mock-data';
import {
  mockModalStores,
  resetModalMocks,
} from '@/src/__tests__/utils/modal-test-utils';
import {
  renderWithAuth,
  screen,
  waitFor,
} from '@/src/__tests__/utils/test-utils';
import ActionButtons from './action-buttons';

// Regex constants for test assertions
const DELETE_BUTTON_REGEX = /Delete/;
const CANCEL_BUTTON_REGEX = /Cancel/;
const PROCESSING_REGEX = /Processing/;
const SCREENSHOT_SAVED_REGEX = /Screenshot Saved!/;
const NEW_GOAL_REGEX = /New Goal/;
const FOCUS_REGEX = /Focus/;
const RESET_IDENTIFIERS_REGEX = /Reset Identifiers/;
const RESOURCES_REGEX = /Resources/;
const SHARE_EXPORT_REGEX = /Share & Export/;
const PERMISSIONS_REGEX = /Permissions/;
const NOTES_REGEX = /Notes/;
const CAPTURE_REGEX = /Capture/;
const DELETE_CASE_CONFIRMATION_REGEX = /Are you sure\?/;
const RESET_IDENTIFIERS_MESSAGE_REGEX =
  /Updating the identifiers will systematically reset/;
const ACTION_CANNOT_BE_UNDONE_REGEX = /This action cannot be undone/;

// Mock router
const mockPush = vi.fn();
const mockReload = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({ caseId: '1' }),
  usePathname: () => '/case/1',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock html2canvas
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockImageData'),
  }),
}));

// Mock modal hooks
vi.mock('@/hooks/use-permissions-modal', () => ({
  usePermissionsModal: () => mockModalStores.permissions,
}));

vi.mock('@/hooks/use-share-modal', () => ({
  useShareModal: () => mockModalStores.share,
}));

vi.mock('@/hooks/use-resources-modal', () => ({
  useResourcesModal: () => mockModalStores.resources,
}));

// Mock toastify
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock window.location.reload
Object.defineProperty(window, 'location', {
  value: {
    reload: mockReload,
  },
  writable: true,
});

// Mock NodeCreate component
vi.mock('@/components/common/node-create', () => ({
  default: ({
    isOpen,
    setOpen,
  }: {
    isOpen: boolean;
    setOpen: (open: boolean) => void;
  }) => {
    if (!isOpen) {
      return null;
    }
    return (
      <div data-testid="node-create-modal">
        <button onClick={() => setOpen(false)} type="button">
          Close
        </button>
      </div>
    );
  },
}));

// Mock CaseNotes component
vi.mock('./case-notes', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    if (!isOpen) {
      return null;
    }
    return (
      <div data-testid="case-notes-modal">
        <button onClick={onClose} type="button">
          Close Notes
        </button>
      </div>
    );
  },
}));

describe('ActionButtons', () => {
  const mockNotify = vi.fn();
  const mockNotifyError = vi.fn();
  const mockOnLayout = vi.fn();

  const defaultProps = {
    showCreateGoal: true,
    actions: {
      onLayout: mockOnLayout,
    },
    notify: mockNotify,
    notifyError: mockNotifyError,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetModalMocks();
    mockPush.mockClear();
    mockReload.mockClear();

    // Set default store state
    useStore.setState({
      assuranceCase: createMockAssuranceCase({
        id: 1,
        permissions: 'manage',
      }),
    });

    // Mock authenticated session
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { id: '1', name: 'Test User', email: 'test@example.com' } as any,
        expires: '2025-12-31',
        key: 'mock-token',
      } as any,
      status: 'authenticated',
      update: vi.fn(),
    });
  });

  describe('Rendering based on permissions', () => {
    it('should render all buttons for manage permission', () => {
      renderWithAuth(<ActionButtons {...defaultProps} />);

      expect(screen.getByLabelText(NEW_GOAL_REGEX)).toBeInTheDocument();
      expect(screen.getByLabelText(FOCUS_REGEX)).toBeInTheDocument();
      expect(
        screen.getByLabelText(RESET_IDENTIFIERS_REGEX)
      ).toBeInTheDocument();
      expect(screen.getByLabelText(RESOURCES_REGEX)).toBeInTheDocument();
      expect(screen.getByLabelText(SHARE_EXPORT_REGEX)).toBeInTheDocument();
      expect(screen.getByLabelText(PERMISSIONS_REGEX)).toBeInTheDocument();
      expect(screen.getByLabelText(NOTES_REGEX)).toBeInTheDocument();
      expect(screen.getByLabelText(CAPTURE_REGEX)).toBeInTheDocument();
      expect(screen.getByLabelText(DELETE_BUTTON_REGEX)).toBeInTheDocument();
    });

    it('should hide certain buttons for edit permission', () => {
      useStore.setState({
        assuranceCase: createMockAssuranceCase({
          id: 1,
          permissions: 'edit' as any,
        }),
      });

      renderWithAuth(<ActionButtons {...defaultProps} />);

      expect(screen.getByLabelText(NEW_GOAL_REGEX)).toBeInTheDocument();
      expect(screen.getByLabelText(SHARE_EXPORT_REGEX)).toBeInTheDocument();
      expect(screen.getByLabelText(CAPTURE_REGEX)).toBeInTheDocument();
      expect(
        screen.queryByLabelText(PERMISSIONS_REGEX)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(DELETE_BUTTON_REGEX)
      ).not.toBeInTheDocument();
    });

    it('should hide edit buttons for view permission', () => {
      useStore.setState({
        assuranceCase: createMockAssuranceCase({
          id: 1,
          permissions: 'view' as any,
        }),
      });

      renderWithAuth(<ActionButtons {...defaultProps} />);

      expect(screen.queryByLabelText(NEW_GOAL_REGEX)).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(RESET_IDENTIFIERS_REGEX)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(SHARE_EXPORT_REGEX)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(PERMISSIONS_REGEX)
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText(CAPTURE_REGEX)).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(DELETE_BUTTON_REGEX)
      ).not.toBeInTheDocument();

      // Should still show read-only buttons
      expect(screen.getByLabelText(FOCUS_REGEX)).toBeInTheDocument();
      expect(screen.getByLabelText(RESOURCES_REGEX)).toBeInTheDocument();
      expect(screen.getByLabelText(NOTES_REGEX)).toBeInTheDocument();
    });

    it('should hide edit buttons for review permission', () => {
      useStore.setState({
        assuranceCase: createMockAssuranceCase({
          id: 1,
          permissions: 'review' as any,
        }),
      });

      renderWithAuth(<ActionButtons {...defaultProps} />);

      expect(screen.queryByLabelText(NEW_GOAL_REGEX)).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(RESET_IDENTIFIERS_REGEX)
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText(CAPTURE_REGEX)).not.toBeInTheDocument();

      // Should show Share & Export for review permission
      expect(screen.getByLabelText(SHARE_EXPORT_REGEX)).toBeInTheDocument();
    });

    it('should not render New Goal button when showCreateGoal is false', () => {
      renderWithAuth(
        <ActionButtons {...defaultProps} showCreateGoal={false} />
      );

      expect(screen.queryByLabelText(NEW_GOAL_REGEX)).not.toBeInTheDocument();
    });
  });

  describe('Delete functionality', () => {
    it('should open delete confirmation modal when delete button is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ActionButtons {...defaultProps} />);

      const deleteButton = screen.getByLabelText(DELETE_BUTTON_REGEX);
      await user.click(deleteButton);

      expect(
        screen.getByText(DELETE_CASE_CONFIRMATION_REGEX)
      ).toBeInTheDocument();
      expect(
        screen.getByText(ACTION_CANNOT_BE_UNDONE_REGEX)
      ).toBeInTheDocument();
    });

    it('should close delete modal when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Open modal
      const deleteButton = screen.getByLabelText(DELETE_BUTTON_REGEX);
      await user.click(deleteButton);

      expect(
        screen.getByText(DELETE_CASE_CONFIRMATION_REGEX)
      ).toBeInTheDocument();

      // Close modal
      const cancelButton = screen.getByText(CANCEL_BUTTON_REGEX);
      await user.click(cancelButton);

      await waitFor(() => {
        expect(
          screen.queryByText(DELETE_CASE_CONFIRMATION_REGEX)
        ).not.toBeInTheDocument();
      });
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

      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Open delete modal
      const deleteButton = screen.getByLabelText(DELETE_BUTTON_REGEX);
      await user.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', {
        name: DELETE_BUTTON_REGEX,
      });
      await user.click(confirmButton);

      // Should show loading state
      expect(screen.getByText(PROCESSING_REGEX)).toBeInTheDocument();

      // Should redirect after successful deletion
      await waitFor(() => {
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

      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Open delete modal
      const deleteButton = screen.getByLabelText(DELETE_BUTTON_REGEX);
      await user.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', {
        name: DELETE_BUTTON_REGEX,
      });
      await user.click(confirmButton);

      // Should not redirect on failure
      await waitFor(() => {
        expect(mockPush).not.toHaveBeenCalledWith('/dashboard');
      });

      // Modal should close
      await waitFor(() => {
        expect(
          screen.queryByText(DELETE_CASE_CONFIRMATION_REGEX)
        ).not.toBeInTheDocument();
      });
    });

    it('should not make API call if assuranceCase is null', () => {
      useStore.setState({ assuranceCase: null });

      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Should not render delete button when no case
      expect(
        screen.queryByLabelText(DELETE_BUTTON_REGEX)
      ).not.toBeInTheDocument();
    });
  });

  describe('Screenshot functionality', () => {
    it('should handle successful screenshot capture', async () => {
      const user = userEvent.setup();

      // Mock successful screenshot API
      server.use(
        http.post('/api/screenshot', () => {
          return HttpResponse.json({
            error: false,
            message: 'Screenshot saved successfully',
          });
        })
      );

      // Create mock ReactFlow element
      const mockElement = document.createElement('div');
      mockElement.id = 'ReactFlow';
      document.body.appendChild(mockElement);

      renderWithAuth(<ActionButtons {...defaultProps} />);

      const captureButton = screen.getByLabelText(CAPTURE_REGEX);
      await user.click(captureButton);

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          SCREENSHOT_SAVED_REGEX.source.replace(/[/\\]/g, '')
        );
      });

      // Cleanup
      document.body.removeChild(mockElement);
    });

    it('should handle screenshot API error', async () => {
      const user = userEvent.setup();

      // Mock failed screenshot API
      server.use(
        http.post('/api/screenshot', () => {
          return HttpResponse.json({
            error: true,
            message: 'Failed to save screenshot',
          });
        })
      );

      // Create mock ReactFlow element
      const mockElement = document.createElement('div');
      mockElement.id = 'ReactFlow';
      document.body.appendChild(mockElement);

      renderWithAuth(<ActionButtons {...defaultProps} />);

      const captureButton = screen.getByLabelText(CAPTURE_REGEX);
      await user.click(captureButton);

      await waitFor(() => {
        expect(mockNotifyError).toHaveBeenCalledWith(
          'Failed to save screenshot'
        );
      });

      // Cleanup
      document.body.removeChild(mockElement);
    });

    it('should not capture screenshot if ReactFlow element is not found', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ActionButtons {...defaultProps} />);

      const captureButton = screen.getByLabelText(CAPTURE_REGEX);
      await user.click(captureButton);

      // Should not call any notification since element doesn't exist
      expect(mockNotify).not.toHaveBeenCalled();
      expect(mockNotifyError).not.toHaveBeenCalled();
    });

    it('should not capture screenshot if assuranceCase is null', () => {
      useStore.setState({ assuranceCase: null });
      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Should not render capture button when no case
      expect(screen.queryByLabelText(CAPTURE_REGEX)).not.toBeInTheDocument();
    });
  });

  describe('Modal interactions', () => {
    it('should open permissions modal when permissions button is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ActionButtons {...defaultProps} />);

      const permissionsButton = screen.getByLabelText(PERMISSIONS_REGEX);
      await user.click(permissionsButton);

      expect(mockModalStores.permissions.onOpen).toHaveBeenCalled();
    });

    it('should open share modal when share button is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ActionButtons {...defaultProps} />);

      const shareButton = screen.getByLabelText(SHARE_EXPORT_REGEX);
      await user.click(shareButton);

      expect(mockModalStores.share.onOpen).toHaveBeenCalled();
    });

    it('should open resources modal when resources button is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ActionButtons {...defaultProps} />);

      const resourcesButton = screen.getByLabelText(RESOURCES_REGEX);
      await user.click(resourcesButton);

      expect(mockModalStores.resources.onOpen).toHaveBeenCalled();
    });

    it('should open node create modal when new goal button is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ActionButtons {...defaultProps} />);

      const newGoalButton = screen.getByLabelText(NEW_GOAL_REGEX);
      await user.click(newGoalButton);

      expect(screen.getByTestId('node-create-modal')).toBeInTheDocument();
    });

    it('should close node create modal', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Open modal
      const newGoalButton = screen.getByLabelText(NEW_GOAL_REGEX);
      await user.click(newGoalButton);

      expect(screen.getByTestId('node-create-modal')).toBeInTheDocument();

      // Close modal
      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByTestId('node-create-modal')
        ).not.toBeInTheDocument();
      });
    });

    it('should open case notes modal when notes button is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ActionButtons {...defaultProps} />);

      const notesButton = screen.getByLabelText(NOTES_REGEX);
      await user.click(notesButton);

      expect(screen.getByTestId('case-notes-modal')).toBeInTheDocument();
    });

    it('should close case notes modal', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Open modal
      const notesButton = screen.getByLabelText(NOTES_REGEX);
      await user.click(notesButton);

      expect(screen.getByTestId('case-notes-modal')).toBeInTheDocument();

      // Close modal
      const closeButton = screen.getByText('Close Notes');
      await user.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByTestId('case-notes-modal')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Reset identifiers functionality', () => {
    it('should open reset identifiers confirmation modal', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ActionButtons {...defaultProps} />);

      const resetButton = screen.getByLabelText(RESET_IDENTIFIERS_REGEX);
      await user.click(resetButton);

      expect(
        screen.getByText(DELETE_CASE_CONFIRMATION_REGEX)
      ).toBeInTheDocument();
      expect(
        screen.getByText(RESET_IDENTIFIERS_MESSAGE_REGEX)
      ).toBeInTheDocument();
    });

    it('should handle successful identifier reset', async () => {
      const user = userEvent.setup();

      // Mock successful reset
      server.use(
        http.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/cases/1/update-ids`,
          () => {
            return new HttpResponse(null, { status: 200 });
          }
        )
      );

      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Open reset modal
      const resetButton = screen.getByLabelText(RESET_IDENTIFIERS_REGEX);
      await user.click(resetButton);

      // Confirm reset
      const confirmButton = screen.getByText('Yes, reset all identifiers');
      await user.click(confirmButton);

      // Should show loading state
      expect(screen.getByText(PROCESSING_REGEX)).toBeInTheDocument();

      // Should reload page after successful reset
      await waitFor(() => {
        expect(mockReload).toHaveBeenCalled();
      });
    });

    it('should handle identifier reset failure', async () => {
      const user = userEvent.setup();

      // Mock failed reset
      server.use(
        http.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/cases/1/update-ids`,
          () => {
            return new HttpResponse(null, { status: 500 });
          }
        )
      );

      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Open reset modal
      const resetButton = screen.getByLabelText(RESET_IDENTIFIERS_REGEX);
      await user.click(resetButton);

      // Confirm reset
      const confirmButton = screen.getByText('Yes, reset all identifiers');
      await user.click(confirmButton);

      // Should not reload on failure
      await waitFor(() => {
        expect(mockReload).not.toHaveBeenCalled();
      });
    });
  });

  describe('Focus functionality', () => {
    it('should call onLayout with TB direction when focus button is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ActionButtons {...defaultProps} />);

      const focusButton = screen.getByLabelText(FOCUS_REGEX);
      await user.click(focusButton);

      expect(mockOnLayout).toHaveBeenCalledWith('TB');
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria labels for all buttons', () => {
      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Check all buttons have aria-labels
      const buttons = screen.getAllByRole('button');
      for (const button of buttons) {
        expect(button).toHaveAttribute('type', 'button');
        const srOnly = button.querySelector('.sr-only');
        expect(srOnly).toBeInTheDocument();
      }
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Tab through buttons
      await user.tab();
      expect(screen.getByLabelText(NEW_GOAL_REGEX)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(FOCUS_REGEX)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(RESET_IDENTIFIERS_REGEX)).toHaveFocus();
    });

    it('should have proper button structure for screen readers', () => {
      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Check for sr-only labels
      expect(screen.getByText('Add Goal')).toHaveClass('sr-only');
      expect(screen.getByText('Focus')).toHaveClass('sr-only');
      expect(screen.getByText('Reset Identifiers')).toHaveClass('sr-only');
      expect(screen.getByText('Resources')).toHaveClass('sr-only');
      expect(screen.getByText('Share & Export')).toHaveClass('sr-only');
      expect(screen.getByText('Permissions')).toHaveClass('sr-only');
      expect(screen.getByText('Notes')).toHaveClass('sr-only');
      expect(screen.getByText('Capture')).toHaveClass('sr-only');
      expect(screen.getByText('Delete')).toHaveClass('sr-only');
    });
  });

  describe('Loading states', () => {
    it('should disable buttons during delete operation', async () => {
      const user = userEvent.setup();

      // Mock slow deletion
      server.use(
        http.delete(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/cases/1/`,
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return new HttpResponse(null, { status: 204 });
          }
        )
      );

      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Open delete modal
      const deleteButton = screen.getByLabelText(DELETE_BUTTON_REGEX);
      await user.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', {
        name: DELETE_BUTTON_REGEX,
      });
      await user.click(confirmButton);

      // Check loading state
      const processingButton = screen.getByText(PROCESSING_REGEX);
      expect(processingButton).toBeDisabled();

      const cancelButton = screen.getByText(CANCEL_BUTTON_REGEX);
      expect(cancelButton).toBeDisabled();
    });

    it('should disable buttons during reset operation', async () => {
      const user = userEvent.setup();

      // Mock slow reset
      server.use(
        http.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/cases/1/update-ids`,
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return new HttpResponse(null, { status: 200 });
          }
        )
      );

      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Open reset modal
      const resetButton = screen.getByLabelText(RESET_IDENTIFIERS_REGEX);
      await user.click(resetButton);

      // Confirm reset
      const confirmButton = screen.getByText('Yes, reset all identifiers');
      await user.click(confirmButton);

      // Check loading state
      const processingButton = screen.getByText(PROCESSING_REGEX);
      expect(processingButton).toBeDisabled();
    });
  });

  describe('Edge cases', () => {
    it('should handle missing session token gracefully', async () => {
      // Mock unauthenticated session
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: vi.fn(),
      });

      const user = userEvent.setup();
      renderWithAuth(<ActionButtons {...defaultProps} />);

      // Try to delete - should still make the request but with empty token
      const deleteButton = screen.getByLabelText(DELETE_BUTTON_REGEX);
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', {
        name: DELETE_BUTTON_REGEX,
      });
      await user.click(confirmButton);

      // API call should still be made
      await waitFor(() => {
        expect(mockPush).not.toHaveBeenCalled(); // Won't redirect on auth failure
      });
    });

    it('should render correctly with custom notification functions', async () => {
      const customNotify = vi.fn();
      const customNotifyError = vi.fn();

      const user = userEvent.setup();

      // Mock successful screenshot
      server.use(
        http.post('/api/screenshot', () => {
          return HttpResponse.json({
            error: false,
            message: 'Success',
          });
        })
      );

      // Create mock ReactFlow element
      const mockElement = document.createElement('div');
      mockElement.id = 'ReactFlow';
      document.body.appendChild(mockElement);

      renderWithAuth(
        <ActionButtons
          {...defaultProps}
          notify={customNotify}
          notifyError={customNotifyError}
        />
      );

      const captureButton = screen.getByLabelText(CAPTURE_REGEX);
      await user.click(captureButton);

      await waitFor(() => {
        expect(customNotify).toHaveBeenCalledWith(
          SCREENSHOT_SAVED_REGEX.source.replace(/[/\\]/g, '')
        );
      });

      // Cleanup
      document.body.removeChild(mockElement);
    });
  });
});
