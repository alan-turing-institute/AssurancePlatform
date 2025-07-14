import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  renderWithAuth,
} from '@/src/__tests__/utils/test-utils';
import {
  mockAssuranceCase,
  createMockAssuranceCase,
} from '@/src/__tests__/utils/mock-data';
import CaseContainer from './CaseContainer';
import { server } from '@/src/__tests__/mocks/server';
import { http, HttpResponse } from 'msw';

// Mock the store
const mockStore = {
  assuranceCase: null as any,
  setAssuranceCase: vi.fn(),
  setOrphanedElements: vi.fn(),
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

// Mock next/navigation
const mockParams = { caseId: '1' };
vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock ReactFlow components
vi.mock('reactflow', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="reactflow-provider">{children}</div>
  ),
}));

// Mock child components
vi.mock('./Flow', () => ({
  default: () => <div data-testid="flow-component">Flow Component</div>,
}));

vi.mock('./CaseDetails', () => ({
  default: ({
    isOpen,
    setOpen,
  }: {
    isOpen: boolean;
    setOpen: (open: boolean) => void;
  }) => (
    <div data-testid="case-details" data-open={isOpen}>
      <button onClick={() => setOpen(!isOpen)}>Toggle Details</button>
    </div>
  ),
}));

vi.mock('../Header', () => ({
  default: ({ setOpen }: { setOpen: (open: boolean) => void }) => (
    <div data-testid="header">
      <button onClick={() => setOpen(true)}>Open Details</button>
    </div>
  ),
}));

vi.mock('@/components/Websocket', () => ({
  default: () => (
    <div data-testid="websocket-component">WebSocket Component</div>
  ),
}));

vi.mock('@/lib/case-helper', () => ({
  addHiddenProp: vi.fn((data) => Promise.resolve({ ...data, hidden: false })),
}));

describe('CaseContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.assuranceCase = null;
    mockStore.setAssuranceCase.mockClear();
    mockStore.setOrphanedElements.mockClear();
  });

  describe('Loading State', () => {
    it('should display loading spinner while fetching case data', () => {
      renderWithAuth(<CaseContainer caseId="1" />);

      expect(
        screen.getByRole('status', { name: /loading/i })
      ).toBeInTheDocument();
      expect(screen.getByText('Rendering your chart...')).toBeInTheDocument();
    });

    it('should show correct loading animation elements', () => {
      renderWithAuth(<CaseContainer caseId="1" />);

      const spinner = screen.getByRole('status', { name: /loading/i });
      expect(spinner).toHaveClass('animate-spin');
      expect(screen.getByText('Rendering your chart...')).toHaveClass(
        'text-muted-foreground'
      );
    });
  });

  describe('Case Loading', () => {
    it('should fetch case data when component mounts with caseId prop', async () => {
      const testCase = createMockAssuranceCase({ id: 1, name: 'Test Case' });

      server.use(
        http.get('*/api/cases/1/', () => {
          return HttpResponse.json(testCase);
        }),
        http.get('*/api/cases/1/sandbox', () => {
          return HttpResponse.json([]);
        })
      );

      renderWithAuth(<CaseContainer caseId="1" />);

      await waitFor(() => {
        expect(mockStore.setAssuranceCase).toHaveBeenCalledWith(
          expect.objectContaining({ id: 1, name: 'Test Case', hidden: false })
        );
      });
    });

    it('should fetch case data using params when no caseId prop provided', async () => {
      const testCase = createMockAssuranceCase({ id: 1, name: 'Params Case' });

      server.use(
        http.get('*/api/cases/1/', () => {
          return HttpResponse.json(testCase);
        }),
        http.get('*/api/cases/1/sandbox', () => {
          return HttpResponse.json([]);
        })
      );

      renderWithAuth(<CaseContainer />);

      await waitFor(() => {
        expect(mockStore.setAssuranceCase).toHaveBeenCalledWith(
          expect.objectContaining({ id: 1, name: 'Params Case', hidden: false })
        );
      });
    });

    it('should fetch orphaned elements after case is loaded', async () => {
      const testCase = createMockAssuranceCase({ id: 1 });
      const orphanedElements = [
        { id: 1, type: 'evidence', name: 'Orphaned Evidence' },
      ];

      server.use(
        http.get('*/api/cases/1/', () => {
          return HttpResponse.json(testCase);
        }),
        http.get('*/api/cases/1/sandbox', () => {
          return HttpResponse.json(orphanedElements);
        })
      );

      renderWithAuth(<CaseContainer caseId="1" />);

      await waitFor(() => {
        expect(mockStore.setOrphanedElements).toHaveBeenCalledWith(
          orphanedElements
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors gracefully', async () => {
      server.use(
        http.get('*/api/cases/999/', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      renderWithAuth(<CaseContainer caseId="999" />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Render Not Found Page');
      });

      consoleSpy.mockRestore();
    });

    it('should handle 403 forbidden errors', async () => {
      server.use(
        http.get('*/api/cases/1/', () => {
          return new HttpResponse(null, { status: 403 });
        })
      );

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      renderWithAuth(<CaseContainer caseId="1" />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Render Not Found Page');
      });

      consoleSpy.mockRestore();
    });

    it('should handle 401 unauthorized errors', async () => {
      const unauthorizedMock = vi.fn();
      vi.doMock('@/hooks/useAuth', () => ({
        unauthorized: unauthorizedMock,
        useLoginToken: () => ['mock-token'],
      }));

      server.use(
        http.get('*/api/cases/1/', () => {
          return new HttpResponse(null, { status: 401 });
        })
      );

      renderWithAuth(<CaseContainer caseId="1" />);

      await waitFor(() => {
        expect(unauthorizedMock).toHaveBeenCalled();
      });
    });

    it('should handle network errors during case fetch', async () => {
      server.use(
        http.get('*/api/cases/1/', () => {
          return HttpResponse.error();
        })
      );

      renderWithAuth(<CaseContainer caseId="1" />);

      // Should remain in loading state or show error message
      await waitFor(() => {
        expect(
          screen.queryByTestId('reactflow-provider')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Successful Case Rendering', () => {
    beforeEach(async () => {
      const testCase = createMockAssuranceCase({ id: 1, name: 'Test Case' });
      mockStore.assuranceCase = testCase;

      server.use(
        http.get('*/api/cases/1/', () => {
          return HttpResponse.json(testCase);
        }),
        http.get('*/api/cases/1/sandbox', () => {
          return HttpResponse.json([]);
        })
      );
    });

    it('should render ReactFlow provider when case is loaded', async () => {
      renderWithAuth(<CaseContainer caseId="1" />);

      await waitFor(() => {
        expect(screen.getByTestId('reactflow-provider')).toBeInTheDocument();
      });
    });

    it('should render all child components when case is loaded', async () => {
      renderWithAuth(<CaseContainer caseId="1" />);

      await waitFor(() => {
        expect(screen.getByTestId('header')).toBeInTheDocument();
        expect(screen.getByTestId('flow-component')).toBeInTheDocument();
        expect(screen.getByTestId('case-details')).toBeInTheDocument();
        expect(screen.getByTestId('websocket-component')).toBeInTheDocument();
      });
    });

    it('should render feedback button', async () => {
      renderWithAuth(<CaseContainer caseId="1" />);

      await waitFor(() => {
        const feedbackButton = screen.getByRole('link');
        expect(feedbackButton).toHaveAttribute(
          'href',
          'https://alan-turing-institute.github.io/AssurancePlatform/community/community-support/'
        );
        expect(feedbackButton).toHaveAttribute('target', '_blank');
      });
    });

    it('should not display loading spinner when case is loaded', async () => {
      renderWithAuth(<CaseContainer caseId="1" />);

      await waitFor(() => {
        expect(
          screen.queryByRole('status', { name: /loading/i })
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('No Case Found State', () => {
    it('should display "No Case Found" when case is null', async () => {
      mockStore.assuranceCase = null;

      server.use(
        http.get('*/api/cases/1/', () => {
          return HttpResponse.json(null);
        })
      );

      renderWithAuth(<CaseContainer caseId="1" />);

      await waitFor(() => {
        expect(screen.getByText('No Case Found')).toBeInTheDocument();
      });
    });

    it('should not render ReactFlow components when no case found', async () => {
      mockStore.assuranceCase = null;

      server.use(
        http.get('*/api/cases/1/', () => {
          return HttpResponse.json(null);
        })
      );

      renderWithAuth(<CaseContainer caseId="1" />);

      await waitFor(() => {
        expect(
          screen.queryByTestId('reactflow-provider')
        ).not.toBeInTheDocument();
        expect(screen.queryByTestId('flow-component')).not.toBeInTheDocument();
      });
    });
  });

  describe('CaseDetails Integration', () => {
    it('should manage case details modal state', async () => {
      const testCase = createMockAssuranceCase({ id: 1 });
      mockStore.assuranceCase = testCase;

      renderWithAuth(<CaseContainer caseId="1" />);

      await waitFor(() => {
        const caseDetails = screen.getByTestId('case-details');
        expect(caseDetails).toHaveAttribute('data-open', 'false');
      });

      // Open details via header button
      const openButton = screen.getByText('Open Details');
      openButton.click();

      await waitFor(() => {
        const caseDetails = screen.getByTestId('case-details');
        expect(caseDetails).toHaveAttribute('data-open', 'true');
      });
    });
  });

  describe('Authentication Integration', () => {
    it('should use session token for API requests', async () => {
      const testCase = createMockAssuranceCase({ id: 1 });

      let capturedHeaders: Record<string, string> = {};
      server.use(
        http.get('*/api/cases/1/', ({ request }) => {
          capturedHeaders = Object.fromEntries(request.headers.entries());
          return HttpResponse.json(testCase);
        }),
        http.get('*/api/cases/1/sandbox', () => {
          return HttpResponse.json([]);
        })
      );

      renderWithAuth(<CaseContainer caseId="1" />);

      await waitFor(() => {
        expect(capturedHeaders['authorization']).toBeDefined();
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('should refetch data when caseId prop changes', async () => {
      const case1 = createMockAssuranceCase({ id: 1, name: 'Case 1' });
      const case2 = createMockAssuranceCase({ id: 2, name: 'Case 2' });

      server.use(
        http.get('*/api/cases/1/', () => HttpResponse.json(case1)),
        http.get('*/api/cases/2/', () => HttpResponse.json(case2)),
        http.get('*/api/cases/*/sandbox', () => HttpResponse.json([]))
      );

      const { rerender } = renderWithAuth(<CaseContainer caseId="1" />);

      await waitFor(() => {
        expect(mockStore.setAssuranceCase).toHaveBeenCalledWith(
          expect.objectContaining({ id: 1, name: 'Case 1' })
        );
      });

      mockStore.setAssuranceCase.mockClear();
      rerender(<CaseContainer caseId="2" />);

      await waitFor(() => {
        expect(mockStore.setAssuranceCase).toHaveBeenCalledWith(
          expect.objectContaining({ id: 2, name: 'Case 2' })
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper loading state accessibility', () => {
      renderWithAuth(<CaseContainer caseId="1" />);

      const loadingContainer = screen
        .getByText('Rendering your chart...')
        .closest('div');
      expect(loadingContainer).toHaveClass(
        'flex',
        'justify-center',
        'items-center',
        'min-h-screen'
      );
    });

    it('should have accessible feedback button', async () => {
      const testCase = createMockAssuranceCase({ id: 1 });
      mockStore.assuranceCase = testCase;

      renderWithAuth(<CaseContainer caseId="1" />);

      await waitFor(() => {
        const feedbackButton = screen.getByRole('link');
        expect(feedbackButton).toBeInTheDocument();
        // The button should be keyboard accessible and have proper focus styles
      });
    });
  });
});
