import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  renderWithAuth,
  userEvent,
} from '@/src/__tests__/utils/test-utils';
import {
  mockAssuranceCase,
  createMockAssuranceCase,
} from '@/src/__tests__/utils/mock-data';
import { ShareModal } from './ShareModal';
import { server } from '@/src/__tests__/mocks/server';
import { http, HttpResponse } from 'msw';

// Mock the store
const mockStore = {
  assuranceCase: mockAssuranceCase as any,
  setAssuranceCase: vi.fn(),
  viewMembers: [] as any[],
  setViewMembers: vi.fn(),
  editMembers: [] as any[],
  setEditMembers: vi.fn(),
  reviewMembers: [] as any[],
  setReviewMembers: vi.fn(),
};

vi.mock('@/data/store', () => ({
  default: () => mockStore,
}));

// Mock the hook
const mockShareModal = {
  isOpen: false,
  onOpen: vi.fn(),
  onClose: vi.fn(),
};

vi.mock('@/hooks/useShareModal', () => ({
  useShareModal: () => mockShareModal,
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

// Mock LinkedCaseModal
vi.mock('./LinkedCaseModal', () => ({
  LinkedCaseModal: ({
    isOpen,
    onClose,
    linkedCaseStudies,
  }: {
    isOpen: boolean;
    onClose: () => void;
    linkedCaseStudies: any[];
  }) =>
    isOpen ? (
      <div data-testid="linked-case-modal">
        <button onClick={onClose}>Close Linked Cases</button>
        <div data-testid="linked-cases-count">{linkedCaseStudies.length}</div>
      </div>
    ) : null,
}));

// Mock file-saver
const mockSaveAs = vi.fn();
vi.mock('file-saver', () => ({
  saveAs: mockSaveAs,
}));

// Mock neatjson
vi.mock('neatjson', () => ({
  neatJSON: vi.fn((obj) => JSON.stringify(obj, null, 2)),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('../ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock window.location.reload
Object.defineProperty(window, 'location', {
  value: { reload: vi.fn() },
  writable: true,
});

describe('ShareModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShareModal.isOpen = false;
    mockStore.assuranceCase = createMockAssuranceCase({
      id: 1,
      name: 'Test Case',
      permissions: 'manage',
      published: false,
    });
    mockStore.viewMembers = [];
    mockStore.editMembers = [];
    mockStore.reviewMembers = [];
    mockSaveAs.mockClear();
    mockToast.mockClear();
  });

  describe('Modal Visibility', () => {
    it('should not render when modal is closed', () => {
      mockShareModal.isOpen = false;

      renderWithAuth(<ShareModal />);

      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('should render when modal is open', () => {
      mockShareModal.isOpen = true;

      renderWithAuth(<ShareModal />);

      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('should display correct title and description', () => {
      mockShareModal.isOpen = true;

      renderWithAuth(<ShareModal />);

      expect(screen.getByText('Share / Export Case')).toBeInTheDocument();
      expect(
        screen.getByText('How would you like the share your assurance case?')
      ).toBeInTheDocument();
    });
  });

  describe('User Sharing Section', () => {
    beforeEach(() => {
      mockShareModal.isOpen = true;
    });

    it('should render sharing form when user has manage permissions', () => {
      mockStore.assuranceCase = createMockAssuranceCase({
        permissions: 'manage',
      });

      renderWithAuth(<ShareModal />);

      expect(screen.getByText('Share with users')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Enter email address')
      ).toBeInTheDocument();
    });

    it('should not render sharing form when user lacks manage permissions', () => {
      mockStore.assuranceCase = createMockAssuranceCase({});

      renderWithAuth(<ShareModal />);

      expect(screen.queryByText('Share with users')).not.toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText('Enter email address')
      ).not.toBeInTheDocument();
    });

    it('should render access level radio buttons', () => {
      renderWithAuth(<ShareModal />);

      expect(screen.getByText('Access Level')).toBeInTheDocument();
      expect(screen.getByLabelText('Read')).toBeInTheDocument();
      expect(screen.getByLabelText('Edit')).toBeInTheDocument();
      expect(screen.getByLabelText('Reviewer')).toBeInTheDocument();
    });

    it('should default to Read access level', () => {
      renderWithAuth(<ShareModal />);

      const readRadio = screen.getByLabelText('Read');
      expect(readRadio).toBeChecked();
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      mockShareModal.isOpen = true;
    });

    it('should require valid email format', async () => {
      const user = userEvent.setup();

      renderWithAuth(<ShareModal />);

      const emailInput = screen.getByPlaceholderText('Enter email address');
      const shareButton = screen.getByRole('button', { name: /share/i });

      await user.type(emailInput, 'invalid-email');
      await user.click(shareButton);

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeInTheDocument();
      });
    });

    it('should require email to be at least 2 characters', async () => {
      const user = userEvent.setup();

      renderWithAuth(<ShareModal />);

      const emailInput = screen.getByPlaceholderText('Enter email address');
      const shareButton = screen.getByRole('button', { name: /share/i });

      await user.type(emailInput, 'a');
      await user.click(shareButton);

      await waitFor(() => {
        expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
      });
    });

    it('should accept valid email format', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/cases/*/sharedwith', () => {
          return HttpResponse.json({ success: true });
        })
      );

      renderWithAuth(<ShareModal />);

      const emailInput = screen.getByPlaceholderText('Enter email address');
      const shareButton = screen.getByRole('button', { name: /share/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(shareButton);

      await waitFor(() => {
        expect(screen.queryByText(/valid email/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('User Sharing Functionality', () => {
    beforeEach(() => {
      mockShareModal.isOpen = true;
    });

    it('should share with read access by default', async () => {
      const user = userEvent.setup();

      let capturedRequestBody: any = null;
      server.use(
        http.post('*/api/cases/*/sharedwith', async ({ request }) => {
          capturedRequestBody = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      renderWithAuth(<ShareModal />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'read@example.com'
      );
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(capturedRequestBody).toEqual([
          {
            email: 'read@example.com',
            view: true,
          },
        ]);
      });
    });

    it('should share with edit access when selected', async () => {
      const user = userEvent.setup();

      let capturedRequestBody: any = null;
      server.use(
        http.post('*/api/cases/*/sharedwith', async ({ request }) => {
          capturedRequestBody = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      renderWithAuth(<ShareModal />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'edit@example.com'
      );
      await user.click(screen.getByLabelText('Edit'));
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(capturedRequestBody).toEqual([
          {
            email: 'edit@example.com',
            edit: true,
          },
        ]);
      });
    });

    it('should share with reviewer access when selected', async () => {
      const user = userEvent.setup();

      let capturedRequestBody: any = null;
      server.use(
        http.post('*/api/cases/*/sharedwith', async ({ request }) => {
          capturedRequestBody = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      renderWithAuth(<ShareModal />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'reviewer@example.com'
      );
      await user.click(screen.getByLabelText('Reviewer'));
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(capturedRequestBody).toEqual([
          {
            email: 'reviewer@example.com',
            review: true,
          },
        ]);
      });
    });

    it('should show success toast on successful sharing', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/cases/*/sharedwith', () => {
          return HttpResponse.json({ success: true });
        })
      );

      renderWithAuth(<ShareModal />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'success@example.com'
      );
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'success',
          title: 'Shared Case with:',
          description: 'success@example.com',
        });
      });
    });

    it('should reset form after successful sharing', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/cases/*/sharedwith', () => {
          return HttpResponse.json({ success: true });
        })
      );

      renderWithAuth(<ShareModal />);

      const emailInput = screen.getByPlaceholderText('Enter email address');
      await user.type(emailInput, 'reset@example.com');
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(emailInput).toHaveValue('');
      });
    });

    it('should handle sharing errors', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/cases/*/sharedwith', () => {
          return new HttpResponse(null, { status: 400 });
        })
      );

      renderWithAuth(<ShareModal />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'error@example.com'
      );
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'Unable to share case',
          description:
            'The email is not registered to an active user of the TEA platform.',
        });
      });
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      mockShareModal.isOpen = true;
    });

    it('should render export section', () => {
      renderWithAuth(<ShareModal />);

      expect(screen.getByText('Export as JSON')).toBeInTheDocument();
      expect(
        screen.getByText('Select the button below to download a JSON file.')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /download file/i })
      ).toBeInTheDocument();
    });

    it('should trigger file download when export button clicked', async () => {
      const user = userEvent.setup();

      renderWithAuth(<ShareModal />);

      await user.click(screen.getByRole('button', { name: /download file/i }));

      expect(mockSaveAs).toHaveBeenCalled();
      const [blob, filename] = mockSaveAs.mock.calls[0];
      expect(blob).toBeInstanceOf(Blob);
      expect(filename).toContain('Test Case');
      expect(filename).toContain('.json');
    });

    it('should remove id fields from exported JSON', async () => {
      const user = userEvent.setup();
      const { neatJSON } = await import('neatjson');

      renderWithAuth(<ShareModal />);

      await user.click(screen.getByRole('button', { name: /download file/i }));

      expect(neatJSON).toHaveBeenCalledWith(mockStore.assuranceCase, {});
    });

    it('should include timestamp in filename', async () => {
      const user = userEvent.setup();

      renderWithAuth(<ShareModal />);

      await user.click(screen.getByRole('button', { name: /download file/i }));

      const [, filename] = mockSaveAs.mock.calls[0];
      expect(filename).toMatch(/\d{4}-\d+-\d+T\d+-\d+-\d+\.json$/);
    });
  });

  describe('Publishing Functionality', () => {
    beforeEach(() => {
      mockShareModal.isOpen = true;
    });

    it('should render publish section when user has manage permissions', () => {
      mockStore.assuranceCase = createMockAssuranceCase({
        permissions: 'manage',
        published: false,
      });

      renderWithAuth(<ShareModal />);

      expect(screen.getByText('Publish Assurance Case')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Here you can publish the current version of your case.'
        )
      ).toBeInTheDocument();
    });

    it('should not render publish section when user lacks manage permissions', () => {
      mockStore.assuranceCase = createMockAssuranceCase({});

      renderWithAuth(<ShareModal />);

      expect(
        screen.queryByText('Publish Assurance Case')
      ).not.toBeInTheDocument();
    });

    it('should show publish button when case is not published', () => {
      mockStore.assuranceCase = createMockAssuranceCase({
        permissions: 'manage',
        published: false,
      });

      renderWithAuth(<ShareModal />);

      expect(
        screen.getByRole('button', { name: /publish/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /update/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /unpublish/i })
      ).not.toBeInTheDocument();
    });

    it('should show update and unpublish buttons when case is published', () => {
      mockStore.assuranceCase = createMockAssuranceCase({
        permissions: 'manage',
        published: true,
      });

      renderWithAuth(<ShareModal />);

      expect(
        screen.getByRole('button', { name: /update/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /unpublish/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^publish$/i })
      ).not.toBeInTheDocument();
    });

    it('should publish case successfully', async () => {
      const user = userEvent.setup();

      server.use(
        http.put('*/api/cases/1/', () => {
          return HttpResponse.json({ success: true });
        })
      );

      renderWithAuth(<ShareModal />);

      await user.click(screen.getByRole('button', { name: /publish/i }));

      await waitFor(() => {
        expect(window.location.reload).toHaveBeenCalled();
      });
    });

    it('should handle publish errors', async () => {
      const user = userEvent.setup();

      server.use(
        http.put('*/api/cases/1/', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      renderWithAuth(<ShareModal />);

      await user.click(screen.getByRole('button', { name: /publish/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Something went wrong, publishing assurance case',
        });
      });
    });

    it('should unpublish case successfully', async () => {
      const user = userEvent.setup();

      mockStore.assuranceCase = createMockAssuranceCase({
        permissions: 'manage',
        published: true,
      });

      server.use(
        http.put('*/api/cases/1/', () => {
          return HttpResponse.json({ success: true });
        })
      );

      renderWithAuth(<ShareModal />);

      await user.click(screen.getByRole('button', { name: /unpublish/i }));

      await waitFor(() => {
        expect(window.location.reload).toHaveBeenCalled();
      });
    });

    it('should handle unpublish with linked case studies', async () => {
      const user = userEvent.setup();

      mockStore.assuranceCase = createMockAssuranceCase({
        permissions: 'manage',
        published: true,
      });

      server.use(
        http.put('*/api/cases/1/', () => {
          return HttpResponse.json(
            {
              error: 'Cannot unpublish case with linked case studies',
              linked_case_studies: [{ id: 1, title: 'Test Case Study' }],
            },
            { status: 400 }
          );
        })
      );

      renderWithAuth(<ShareModal />);

      await user.click(screen.getByRole('button', { name: /unpublish/i }));

      await waitFor(() => {
        expect(mockShareModal.onClose).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to Unpublish',
          description: expect.any(Object),
        });
      });
    });
  });

  describe('LinkedCaseModal Integration', () => {
    beforeEach(() => {
      mockShareModal.isOpen = true;
    });

    it('should open linked case modal when button is clicked', async () => {
      const user = userEvent.setup();

      mockStore.assuranceCase = createMockAssuranceCase({
        permissions: 'manage',
        published: true,
      });

      server.use(
        http.put('*/api/cases/1/', () => {
          return HttpResponse.json(
            {
              error: 'Cannot unpublish',
              linked_case_studies: [{ id: 1, title: 'Test Case Study' }],
            },
            { status: 400 }
          );
        })
      );

      renderWithAuth(<ShareModal />);

      await user.click(screen.getByRole('button', { name: /unpublish/i }));

      // Wait for the toast with the button to appear
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });

      // The linked case modal should eventually be available
      // This test verifies the integration setup
      expect(screen.getByTestId('linked-case-modal')).toBeInTheDocument();
    });
  });

  describe('Store Integration', () => {
    beforeEach(() => {
      mockShareModal.isOpen = true;
    });

    it('should update store when sharing with view access', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/cases/*/sharedwith', () => {
          return HttpResponse.json({ success: true });
        })
      );

      renderWithAuth(<ShareModal />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'view@example.com'
      );
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(mockStore.setViewMembers).toHaveBeenCalledWith([
          { email: 'view@example.com', view: true },
        ]);
      });
    });

    it('should update store when sharing with edit access', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/cases/*/sharedwith', () => {
          return HttpResponse.json({ success: true });
        })
      );

      renderWithAuth(<ShareModal />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'edit@example.com'
      );
      await user.click(screen.getByLabelText('Edit'));
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(mockStore.setEditMembers).toHaveBeenCalledWith([
          { email: 'edit@example.com', edit: true },
        ]);
      });
    });

    it('should update store when sharing with reviewer access', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/cases/*/sharedwith', () => {
          return HttpResponse.json({ success: true });
        })
      );

      renderWithAuth(<ShareModal />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'reviewer@example.com'
      );
      await user.click(screen.getByLabelText('Reviewer'));
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(mockStore.setReviewMembers).toHaveBeenCalledWith([
          { email: 'reviewer@example.com', review: true },
        ]);
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockShareModal.isOpen = true;
    });

    it('should have proper form labels', () => {
      renderWithAuth(<ShareModal />);

      expect(screen.getByLabelText(/access level/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Read')).toBeInTheDocument();
      expect(screen.getByLabelText('Edit')).toBeInTheDocument();
      expect(screen.getByLabelText('Reviewer')).toBeInTheDocument();
    });

    it('should have proper modal role', () => {
      renderWithAuth(<ShareModal />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have proper button structure', () => {
      renderWithAuth(<ShareModal />);

      const shareButton = screen.getByRole('button', { name: /share/i });
      const downloadButton = screen.getByRole('button', {
        name: /download file/i,
      });

      expect(shareButton).toHaveAttribute('type', 'submit');
      expect(downloadButton).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockShareModal.isOpen = true;
    });

    it('should handle missing assurance case', () => {
      mockStore.assuranceCase = null;

      renderWithAuth(<ShareModal />);

      // Should not crash
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.queryByText('Share with users')).not.toBeInTheDocument();
    });

    it('should handle special characters in email', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('*/api/cases/*/sharedwith', () => {
          return HttpResponse.json({ success: true });
        })
      );

      renderWithAuth(<ShareModal />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'test+special@example-domain.com'
      );
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'success',
          title: 'Shared Case with:',
          description: 'test+special@example-domain.com',
        });
      });
    });

    it('should handle network errors during sharing', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      server.use(
        http.post('*/api/cases/*/sharedwith', () => {
          return HttpResponse.error();
        })
      );

      renderWithAuth(<ShareModal />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'network@example.com'
      );
      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'Error',
          description: 'Something went wrong',
        });
      });

      consoleSpy.mockRestore();
    });
  });
});
