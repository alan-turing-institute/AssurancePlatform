import { type RenderOptions, render } from '@testing-library/react';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import type React from 'react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { Toaster } from '@/components/ui/toaster';
import { ModalProvider } from '@/providers/modal-provider';
import { ThemeProvider } from '@/providers/theme-provider';

// Mock session data
const mockSession = {
  user: {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    image: null,
  },
  expires: '2025-12-31',
};

// Provider wrapper for tests
interface ProvidersProps {
  children: React.ReactNode;
  session?: Session | null;
}

const Providers = ({ children, session = null }: ProvidersProps) => {
  return (
    <SessionProvider session={session}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableSystem
      >
        {children}
        <ModalProvider />
        <Toaster />
      </ThemeProvider>
    </SessionProvider>
  );
};

// Custom render function
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  session?: Session | null;
  withProviders?: boolean;
}

const customRender = (ui: ReactElement, options: CustomRenderOptions = {}) => {
  const { session = null, withProviders = true, ...renderOptions } = options;

  if (!withProviders) {
    return render(ui, renderOptions);
  }

  return render(ui, {
    wrapper: ({ children }) => (
      <Providers session={session}>{children}</Providers>
    ),
    ...renderOptions,
  });
};

// Custom render with authenticated session
const renderWithAuth = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  return customRender(ui, {
    ...options,
    session: mockSession,
  });
};

// Custom render without any providers (for testing components in isolation)
const renderWithoutProviders = (ui: ReactElement, options?: RenderOptions) => {
  return render(ui, options);
};

// Helper to create mock form event
export const createMockFormEvent = (value: string) => ({
  target: { value },
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
});

// Helper to create mock file for file upload tests
export const createMockFile = (
  name = 'test.png',
  type = 'image/png',
  size = 1024
) => {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Helper to wait for async operations
export const waitFor = (
  callback: () => void | Promise<void>,
  timeout = 1000
) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = async () => {
      try {
        await callback();
        resolve(true);
      } catch (error) {
        if (Date.now() - startTime >= timeout) {
          reject(error);
        } else {
          setTimeout(check, 10);
        }
      }
    };
    check();
  });
};

// Re-export everything from React Testing Library
export * from '@testing-library/react';

// Re-export userEvent
export { default as userEvent } from '@testing-library/user-event';

// Export custom render functions
export {
  customRender as render,
  renderWithAuth,
  renderWithoutProviders,
  mockSession,
};
