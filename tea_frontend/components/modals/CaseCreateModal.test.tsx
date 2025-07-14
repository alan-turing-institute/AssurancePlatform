import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  renderWithAuth,
  userEvent,
} from '@/src/__tests__/utils/test-utils';
import { CaseCreateModal } from './CaseCreateModal';
import { server } from '@/src/__tests__/mocks/server';
import { http, HttpResponse } from 'msw';

// Mock the hook
const mockCreateCaseModal = {
  isOpen: false,
  onOpen: vi.fn(),
  onClose: vi.fn(),
};

vi.mock('@/hooks/useCreateCaseModal', () => ({
  useCreateCaseModal: () => mockCreateCaseModal,
}));

// Mock Next.js router
const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ caseId: '1' }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock UI Modal component
vi.mock('@/components/ui/modal', () => ({
  Modal: ({
    title,
    description,
    isOpen,
    onClose,
    children,
  }: {
    title: string;
    description: string;
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="modal" role="dialog">
        <h1>{title}</h1>
        <p>{description}</p>
        <button onClick={onClose} data-testid="modal-close">
          Close
        </button>
        {children}
      </div>
    ) : null,
}));

describe('CaseCreateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCaseModal.isOpen = false;
  });

  describe('Modal Visibility', () => {
    it('should not render when modal is closed', () => {
      mockCreateCaseModal.isOpen = false;

      renderWithAuth(<CaseCreateModal />);

      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('should render when modal is open', () => {
      mockCreateCaseModal.isOpen = true;

      renderWithAuth(<CaseCreateModal />);

      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('should display correct title and description', () => {
      mockCreateCaseModal.isOpen = true;

      renderWithAuth(<CaseCreateModal />);

      expect(screen.getByText('Create New Assurance Case')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Please enter a name and description for your new assurance case.'
        )
      ).toBeInTheDocument();
    });
  });

  describe('Form Rendering', () => {
    beforeEach(() => {
      mockCreateCaseModal.isOpen = true;
    });

    it('should render form fields when not loading', () => {
      renderWithAuth(<CaseCreateModal />);

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('should render form with correct placeholders', () => {
      renderWithAuth(<CaseCreateModal />);

      expect(screen.getByPlaceholderText('Case name')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Your case description')
      ).toBeInTheDocument();
    });

    it('should render submit and cancel buttons', () => {
      renderWithAuth(<CaseCreateModal />);

      expect(
        screen.getByRole('button', { name: /submit/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it('should not render template selection (commented out)', () => {
      renderWithAuth(<CaseCreateModal />);

      expect(screen.queryByText(/select a template/i)).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    beforeEach(() => {
      mockCreateCaseModal.isOpen = true;
    });

    it('should show loading spinner during case creation', async () => {
      const user = userEvent.setup();

      // Delay the API response to test loading state
      server.use(
        http.post('*/api/cases/', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({ id: 1 });
        })
      );

      renderWithAuth(<CaseCreateModal />);

      // Fill form
      await user.type(screen.getByPlaceholderText('Case name'), 'Test Case');
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        'Test description'
      );

      // Submit form
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Should show loading spinner
      expect(
        screen.getByRole('status', { name: /loading/i })
      ).toBeInTheDocument();
      expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    });

    it('should disable form fields during loading', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/cases/', async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json({ id: 1 });
        })
      );

      renderWithAuth(<CaseCreateModal />);

      await user.type(screen.getByPlaceholderText('Case name'), 'Test Case');
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        'Test description'
      );

      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Form should be hidden during loading
      expect(
        screen.queryByPlaceholderText('Case name')
      ).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      mockCreateCaseModal.isOpen = true;
    });

    it('should require name field', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseCreateModal />);

      // Submit without filling name
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        'Test description'
      );
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/required/i)).toBeInTheDocument();
      });
    });

    it('should require description field', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseCreateModal />);

      // Submit without filling description
      await user.type(screen.getByPlaceholderText('Case name'), 'Test Case');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/required/i)).toBeInTheDocument();
      });
    });

    it('should require both fields', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseCreateModal />);

      // Submit without filling any fields
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        const requiredMessages = screen.getAllByText(/required/i);
        expect(requiredMessages).toHaveLength(2);
      });
    });

    it('should accept valid form data', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/cases/', () => {
          return HttpResponse.json({ id: 1 });
        })
      );

      renderWithAuth(<CaseCreateModal />);

      await user.type(
        screen.getByPlaceholderText('Case name'),
        'Valid Test Case'
      );
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        'Valid test description'
      );

      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Should not show validation errors
      await waitFor(() => {
        expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Case Creation', () => {
    beforeEach(() => {
      mockCreateCaseModal.isOpen = true;
    });

    it('should create case with correct data', async () => {
      const user = userEvent.setup();

      let capturedRequestBody: any = null;
      server.use(
        http.post('*/api/cases/', async ({ request }) => {
          capturedRequestBody = await request.json();
          return HttpResponse.json({ id: 123 });
        })
      );

      renderWithAuth(<CaseCreateModal />);

      await user.type(screen.getByPlaceholderText('Case name'), 'My Test Case');
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        'My test description'
      );

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(capturedRequestBody).toEqual({
          name: 'My Test Case',
          description: 'My test description',
          lock_uuid: null,
          goals: [],
          color_profile: 'default',
        });
      });
    });

    it('should include authorization header', async () => {
      const user = userEvent.setup();

      let capturedHeaders: Record<string, string> = {};
      server.use(
        http.post('*/api/cases/', ({ request }) => {
          capturedHeaders = Object.fromEntries(request.headers.entries());
          return HttpResponse.json({ id: 123 });
        })
      );

      renderWithAuth(<CaseCreateModal />);

      await user.type(screen.getByPlaceholderText('Case name'), 'Test Case');
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        'Test description'
      );

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(capturedHeaders['authorization']).toBeDefined();
        expect(capturedHeaders['content-type']).toBe('application/json');
      });
    });

    it('should navigate to created case on success', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/cases/', () => {
          return HttpResponse.json({ id: 456 });
        })
      );

      renderWithAuth(<CaseCreateModal />);

      await user.type(
        screen.getByPlaceholderText('Case name'),
        'Navigation Test Case'
      );
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        'Test navigation'
      );

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/case/456');
      });
    });

    it('should close modal on successful creation', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/cases/', () => {
          return HttpResponse.json({ id: 789 });
        })
      );

      renderWithAuth(<CaseCreateModal />);

      await user.type(
        screen.getByPlaceholderText('Case name'),
        'Close Test Case'
      );
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        'Test modal close'
      );

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockCreateCaseModal.onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockCreateCaseModal.isOpen = true;
    });

    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      server.use(
        http.post('*/api/cases/', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      renderWithAuth(<CaseCreateModal />);

      await user.type(
        screen.getByPlaceholderText('Case name'),
        'Error Test Case'
      );
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        'Test error handling'
      );

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should handle network errors', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      server.use(
        http.post('*/api/cases/', () => {
          return HttpResponse.error();
        })
      );

      renderWithAuth(<CaseCreateModal />);

      await user.type(
        screen.getByPlaceholderText('Case name'),
        'Network Error Case'
      );
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        'Test network error'
      );

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should handle API response without id', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      server.use(
        http.post('*/api/cases/', () => {
          return HttpResponse.json({ error: 'Case creation failed' });
        })
      );

      renderWithAuth(<CaseCreateModal />);

      await user.type(screen.getByPlaceholderText('Case name'), 'Failed Case');
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        'Test failure response'
      );

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Cancel Functionality', () => {
    beforeEach(() => {
      mockCreateCaseModal.isOpen = true;
    });

    it('should close modal when cancel button is clicked', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseCreateModal />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockCreateCaseModal.onClose).toHaveBeenCalled();
    });

    it('should clear form errors when canceling', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseCreateModal />);

      // Trigger validation errors first
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getAllByText(/required/i)).toHaveLength(2);
      });

      // Cancel should clear errors
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockCreateCaseModal.onClose).toHaveBeenCalled();
    });

    it('should close modal when modal close button is clicked', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseCreateModal />);

      await user.click(screen.getByTestId('modal-close'));

      expect(mockCreateCaseModal.onClose).toHaveBeenCalled();
    });
  });

  describe('Form State Management', () => {
    beforeEach(() => {
      mockCreateCaseModal.isOpen = true;
    });

    it('should start with empty form fields', () => {
      renderWithAuth(<CaseCreateModal />);

      expect(screen.getByPlaceholderText('Case name')).toHaveValue('');
      expect(screen.getByPlaceholderText('Your case description')).toHaveValue(
        ''
      );
    });

    it('should allow typing in form fields', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseCreateModal />);

      const nameInput = screen.getByPlaceholderText('Case name');
      const descriptionInput = screen.getByPlaceholderText(
        'Your case description'
      );

      await user.type(nameInput, 'Test Case Name');
      await user.type(descriptionInput, 'Test case description');

      expect(nameInput).toHaveValue('Test Case Name');
      expect(descriptionInput).toHaveValue('Test case description');
    });

    it('should reset form when modal reopens', () => {
      const { rerender } = renderWithAuth(<CaseCreateModal />);

      // Close modal
      mockCreateCaseModal.isOpen = false;
      rerender(<CaseCreateModal />);

      // Reopen modal
      mockCreateCaseModal.isOpen = true;
      rerender(<CaseCreateModal />);

      expect(screen.getByPlaceholderText('Case name')).toHaveValue('');
      expect(screen.getByPlaceholderText('Your case description')).toHaveValue(
        ''
      );
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockCreateCaseModal.isOpen = true;
    });

    it('should have proper form labels', () => {
      renderWithAuth(<CaseCreateModal />);

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('should have proper modal role', () => {
      renderWithAuth(<CaseCreateModal />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have proper button types', () => {
      renderWithAuth(<CaseCreateModal />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });

      expect(submitButton).toHaveAttribute('type', 'submit');
      expect(cancelButton).not.toHaveAttribute('type', 'submit');
    });

    it('should show validation errors with proper accessibility', async () => {
      const user = userEvent.setup();

      renderWithAuth(<CaseCreateModal />);

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        const errorMessages = screen.getAllByText(/required/i);
        errorMessages.forEach((error) => {
          expect(error).toHaveAttribute('role', 'alert');
        });
      });
    });
  });

  describe('Session Integration', () => {
    beforeEach(() => {
      mockCreateCaseModal.isOpen = true;
    });

    it('should use session token for API calls', async () => {
      const user = userEvent.setup();

      let capturedHeaders: Record<string, string> = {};
      server.use(
        http.post('*/api/cases/', ({ request }) => {
          capturedHeaders = Object.fromEntries(request.headers.entries());
          return HttpResponse.json({ id: 123 });
        })
      );

      renderWithAuth(<CaseCreateModal />);

      await user.type(screen.getByPlaceholderText('Case name'), 'Session Test');
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        'Test session'
      );

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(capturedHeaders['authorization']).toContain('Token');
      });
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockCreateCaseModal.isOpen = true;
    });

    it('should handle very long input values', async () => {
      const user = userEvent.setup();
      const longText = 'A'.repeat(1000);

      renderWithAuth(<CaseCreateModal />);

      await user.type(screen.getByPlaceholderText('Case name'), longText);
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        longText
      );

      expect(screen.getByPlaceholderText('Case name')).toHaveValue(longText);
      expect(screen.getByPlaceholderText('Your case description')).toHaveValue(
        longText
      );
    });

    it('should handle special characters in input', async () => {
      const user = userEvent.setup();
      const specialText =
        'Test Case with Special Chars: !@#$%^&*()_+-=[]{}|;:,.<>?';

      renderWithAuth(<CaseCreateModal />);

      await user.type(screen.getByPlaceholderText('Case name'), specialText);
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        specialText
      );

      expect(screen.getByPlaceholderText('Case name')).toHaveValue(specialText);
      expect(screen.getByPlaceholderText('Your case description')).toHaveValue(
        specialText
      );
    });

    it('should handle rapid form submissions', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/cases/', () => {
          return HttpResponse.json({ id: 123 });
        })
      );

      renderWithAuth(<CaseCreateModal />);

      await user.type(screen.getByPlaceholderText('Case name'), 'Rapid Test');
      await user.type(
        screen.getByPlaceholderText('Your case description'),
        'Rapid submission test'
      );

      const submitButton = screen.getByRole('button', { name: /submit/i });

      // Rapid clicks
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);

      // Should only make one API call
      expect(mockRouter.push).toHaveBeenCalledTimes(1);
    });
  });
});
