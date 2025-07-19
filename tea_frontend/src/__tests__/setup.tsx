import '@testing-library/jest-dom';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import type React from 'react';
import { afterAll, afterEach, beforeAll, expect, vi } from 'vitest';
import { server } from './mocks/server';

// Set up environment variables for tests
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Setup MSW
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
});

afterAll(() => {
  server.close();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
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
  useParams: () => ({}),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

// Mock Next.js image component
vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line @next/next/no-img-element
    // biome-ignore lint/performance/noImgElement: This is a test mock for Next.js Image component
    return <img alt="" {...props} />;
  },
}));

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: null,
    status: 'unauthenticated',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock ReactFlow with proper provider setup
const mockReactFlowStore = {
  getState: vi.fn(() => ({
    nodes: [],
    edges: [],
    nodeInternals: new Map(),
    onNodesChange: vi.fn(),
    onEdgesChange: vi.fn(),
    onConnect: vi.fn(),
    fitView: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    addNodes: vi.fn(),
    addEdges: vi.fn(),
    getNode: vi.fn(),
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
  })),
  setState: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
  destroy: vi.fn(),
};

vi.mock('reactflow', () => {
  const ReactLib = require('react');
  return {
    default: ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => {
      const MockReactFlowProvider = ({
        children: providerChildren,
      }: {
        children: React.ReactNode;
      }) => {
        return ReactLib.createElement(
          'div',
          { 'data-testid': 'react-flow-provider' },
          providerChildren
        );
      };
      return ReactLib.createElement(
        MockReactFlowProvider,
        {},
        ReactLib.createElement(
          'div',
          { 'data-testid': 'react-flow', ...props },
          children
        )
      );
    },
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => {
      return ReactLib.createElement(
        'div',
        { 'data-testid': 'react-flow-provider' },
        children
      );
    },
    MiniMap: () => {
      return ReactLib.createElement('div', {
        'data-testid': 'react-flow-minimap',
      });
    },
    Controls: () => {
      return ReactLib.createElement('div', {
        'data-testid': 'react-flow-controls',
      });
    },
    Background: () => {
      return ReactLib.createElement('div', {
        'data-testid': 'react-flow-background',
      });
    },
    useReactFlow: () => ({
      fitView: vi.fn(),
      getNode: vi.fn(),
      getNodes: vi.fn(() => []),
      getEdges: vi.fn(() => []),
      setNodes: vi.fn(),
      setEdges: vi.fn(),
      getIntersectingNodes: vi.fn(() => []),
      project: vi.fn((position) => position),
      toObject: vi.fn(() => ({
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      })),
    }),
    useStore: () => mockReactFlowStore.getState(),
    useStoreApi: () => mockReactFlowStore,
    addEdge: vi.fn((params, edges) => [...edges, params]),
    applyNodeChanges: vi.fn((_changes, nodes) => nodes),
    applyEdgeChanges: vi.fn((_changes, edges) => edges),
    useNodesState: () => [[], vi.fn(), vi.fn()],
    useEdgesState: () => [[], vi.fn(), vi.fn()],
    Handle: ({
      type,
      position,
      id,
    }: {
      type: string;
      position: string;
      id?: string;
    }) => {
      return ReactLib.createElement('div', {
        'data-testid': `handle-${type}-${position}`,
        'data-id': id,
      });
    },
    Position: {
      Top: 'top',
      Right: 'right',
      Bottom: 'bottom',
      Left: 'left',
    },
    MarkerType: {
      Arrow: 'arrow',
      ArrowClosed: 'arrowclosed',
    },
  };
});

// Mock toast hook
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toasts: [],
    toast: vi.fn(),
    dismiss: vi.fn(),
  }),
  toast: vi.fn(),
}));

// Mock zustand store with safe defaults
const mockStoreState = {
  assuranceCase: null,
  setAssuranceCase: vi.fn(),
  orphanedElements: [],
  setOrphanedElements: vi.fn(),
  viewMembers: [],
  setViewMembers: vi.fn(),
  editMembers: [],
  setEditMembers: vi.fn(),
  reviewMembers: [],
  setReviewMembers: vi.fn(),
  nodes: [],
  edges: [],
  setNodes: vi.fn(),
  setEdges: vi.fn(),
  onNodesChange: vi.fn(),
  onEdgesChange: vi.fn(),
  onConnect: vi.fn(),
};

vi.mock('@/data/store', () => ({
  default: () => mockStoreState,
}));

// Mock all modal hooks to prevent modals from rendering in tests
vi.mock('@/hooks/use-permissions-modal', () => ({
  usePermissionsModal: () => ({
    isOpen: false,
    onOpen: vi.fn(),
    onClose: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-case-create-modal', () => ({
  useCaseCreateModal: () => ({
    isOpen: false,
    onOpen: vi.fn(),
    onClose: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-import-modal', () => ({
  useImportModal: () => ({
    isOpen: false,
    onOpen: vi.fn(),
    onClose: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-share-modal', () => ({
  useShareModal: () => ({
    isOpen: false,
    onOpen: vi.fn(),
    onClose: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-email-modal', () => ({
  useEmailModal: () => ({
    isOpen: false,
    onOpen: vi.fn(),
    onClose: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-resources-modal', () => ({
  useResourcesModal: () => ({
    isOpen: false,
    onOpen: vi.fn(),
    onClose: vi.fn(),
  }),
}));

// Mock the entire ModalProvider to prevent modal rendering in tests
vi.mock('@/providers/modal-provider', () => ({
  ModalProvider: () => null,
}));

// Mock Radix UI Dialog components that are causing issues
vi.mock('@radix-ui/react-dialog', () => {
  const ReactLib = require('react');
  return {
    Root: ({
      children,
      open,
    }: {
      children: React.ReactNode;
      open?: boolean;
    }) =>
      open
        ? ReactLib.createElement(
            'div',
            { 'data-testid': 'dialog-root' },
            children
          )
        : null,
    Trigger: ({ children }: { children: React.ReactNode }) =>
      ReactLib.createElement(
        'div',
        { 'data-testid': 'dialog-trigger' },
        children
      ),
    Portal: ({ children }: { children: React.ReactNode }) =>
      ReactLib.createElement(
        'div',
        { 'data-testid': 'dialog-portal' },
        children
      ),
    Overlay: ({ children }: { children: React.ReactNode }) =>
      ReactLib.createElement(
        'div',
        { 'data-testid': 'dialog-overlay' },
        children
      ),
    Content: ({ children }: { children: React.ReactNode }) =>
      ReactLib.createElement(
        'div',
        { 'data-testid': 'dialog-content' },
        children
      ),
    Close: ({ children }: { children: React.ReactNode }) =>
      ReactLib.createElement(
        'button',
        { 'data-testid': 'dialog-close' },
        children
      ),
    Title: ({ children }: { children: React.ReactNode }) =>
      ReactLib.createElement('h2', { 'data-testid': 'dialog-title' }, children),
    Description: ({ children }: { children: React.ReactNode }) =>
      ReactLib.createElement(
        'p',
        { 'data-testid': 'dialog-description' },
        children
      ),
  };
});

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Add missing pointer event methods to HTMLElement prototype
if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
}

if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = vi.fn();
}

if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = vi.fn();
}

// Add missing scrollIntoView method
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// Add polyfill for HTMLDialogElement methods
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement
  ) {
    this.open = true;
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
    this.removeAttribute('open');
  });
}

// Add polyfill for HTMLFormElement.requestSubmit
if (
  typeof HTMLFormElement !== 'undefined' &&
  !HTMLFormElement.prototype.requestSubmit
) {
  HTMLFormElement.prototype.requestSubmit = function (submitter?: HTMLElement) {
    const event = new Event('submit', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'submitter', { value: submitter });

    if (!this.dispatchEvent(event)) {
      return;
    }

    // For dialog forms with method="dialog", close the dialog
    if (this.method === 'dialog') {
      const dialog = this.closest('dialog');
      if (dialog && typeof dialog.close === 'function') {
        dialog.close();
      }
    }
  };
}

// Add DragEvent polyfill for file testing
if (typeof global.DragEvent === 'undefined') {
  global.DragEvent = class MockDragEvent extends Event {
    dataTransfer: DataTransfer | null;
    clientX: number;
    clientY: number;
    screenX: number;
    screenY: number;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;

    constructor(type: string, eventInitDict?: DragEventInit) {
      super(type, eventInitDict);
      this.dataTransfer = eventInitDict?.dataTransfer || null;
      this.clientX = eventInitDict?.clientX || 0;
      this.clientY = eventInitDict?.clientY || 0;
      this.screenX = eventInitDict?.screenX || 0;
      this.screenY = eventInitDict?.screenY || 0;
      this.ctrlKey = eventInitDict?.ctrlKey || false;
      this.shiftKey = eventInitDict?.shiftKey || false;
      this.altKey = eventInitDict?.altKey || false;
      this.metaKey = eventInitDict?.metaKey || false;
    }
  } as any;
}
