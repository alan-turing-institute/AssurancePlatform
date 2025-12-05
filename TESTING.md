# TEA Platform Frontend Testing Guide

## Overview

The TEA Platform frontend uses a comprehensive testing setup built on Vitest, React Testing Library, and MSW (Mock Service Worker) for API mocking. Our testing philosophy emphasises writing tests that resemble how users interact with the application, ensuring confidence in the real-world behaviour of our components.

### Technology Stack

- **Test Runner**: Vitest - Fast, ESM-first test runner with Jest compatibility
- **Testing Library**: React Testing Library - For testing React components with user-centric queries
- **API Mocking**: MSW (Mock Service Worker) - For intercepting and mocking HTTP requests
- **Browser Environment**: jsdom - For simulating browser APIs in tests
- **Assertion Library**: Vitest's built-in expect API with jest-dom matchers

## Getting Started

### Running Tests

```bash
# Run all tests
pnpm run test

# Run tests in watch mode (recommended during development)
pnpm run test:watch

# Run tests with coverage report
pnpm run test:coverage

# Run specific test file
pnpm run test components/cases/case-card.test.tsx

# Run tests matching a pattern
pnpm run test -- --grep "should handle authentication"
```

### Test File Naming Convention

- Unit tests: `component-name.test.tsx` or `utility-name.test.ts`
- Integration tests: `feature-name.integration.test.tsx`
- Test utilities: Place in `src/__tests__/utils/`
- Mock data: Place in `src/__tests__/utils/mock-data.ts`

## Testing Philosophy and Best Practices

### Core Principles

1. **Test User Behaviour, Not Implementation Details**
   - Focus on what users see and do, not internal component state
   - Avoid testing implementation details that users don't care about

2. **Write Tests That Give Confidence**
   - Each test should increase confidence that the feature works as expected
   - Integration tests provide more confidence than unit tests

3. **Keep Tests Maintainable**
   - Use descriptive test names that explain the scenario
   - Extract common patterns into test utilities
   - Avoid excessive mocking - mock at the network boundary

4. **Test Accessibility**
   - Ensure components are keyboard navigable
   - Use semantic HTML and ARIA attributes appropriately
   - Test with screen reader queries when relevant

### Best Practices

```typescript
// ✅ Good: Testing user behaviour
it('should navigate to case details when view button is clicked', async () => {
  const user = userEvent.setup();
  renderWithAuth(<CaseCard assuranceCase={mockCase} />);
  
  await user.click(screen.getByTestId('view-case-button'));
  
  expect(mockPush).toHaveBeenCalledWith('/case/1');
});

// ❌ Bad: Testing implementation details
it('should set isLoading to true when button is clicked', async () => {
  // Don't test internal state - test what the user sees instead
});
```

## Component Testing Guide

### Basic Component Test Structure

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/src/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';
import MyComponent from './my-component';

describe('MyComponent', () => {
  it('should render correctly with required props', () => {
    render(<MyComponent title="Test Title" />);
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should handle user interactions', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<MyComponent onClick={handleClick} />);
    
    await user.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

### Testing Forms

```typescript
import { renderWithAuth, screen } from '@/src/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';

describe('LoginForm', () => {
  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    renderWithAuth(<LoginForm />);
    
    // Fill form fields
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    
    // Submit form
    await user.click(screen.getByRole('button', { name: /submit/i }));
    
    // Assert on expected behaviour
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        username: 'testuser',
        password: 'password123',
        redirect: false,
      });
    });
  });

  it('should show validation errors', async () => {
    const user = userEvent.setup();
    renderWithAuth(<LoginForm />);
    
    // Submit empty form
    await user.click(screen.getByRole('button', { name: /submit/i }));
    
    // Check for validation messages
    expect(screen.getByText(/username is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });
});
```

### Testing with Authentication

```typescript
import { renderWithAuth, render } from '@/src/__tests__/utils/test-utils';

describe('ProtectedComponent', () => {
  it('should render for authenticated users', () => {
    // renderWithAuth provides a mock authenticated session
    renderWithAuth(<ProtectedComponent />);
    
    expect(screen.getByText('Welcome back!')).toBeInTheDocument();
  });

  it('should redirect unauthenticated users', () => {
    // render without auth session
    render(<ProtectedComponent />);
    
    expect(mockRouter.push).toHaveBeenCalledWith('/login');
  });
});
```

### Testing Components with ReactFlow

```typescript
describe('FlowComponent', () => {
  it('should render flow diagram with nodes', () => {
    renderWithAuth(<FlowComponent />);
    
    // ReactFlow is mocked in setup, so test using mock structure
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('react-flow-controls')).toBeInTheDocument();
  });

  it('should handle node interactions', async () => {
    const user = userEvent.setup();
    const handleNodeClick = vi.fn();
    
    renderWithAuth(<FlowComponent onNodeClick={handleNodeClick} />);
    
    // Interact with mocked ReactFlow elements
    const node = screen.getByTestId('node-1');
    await user.click(node);
    
    expect(handleNodeClick).toHaveBeenCalledWith('1');
  });
});
```

## Integration Testing Guide

Integration tests verify that multiple components and systems work together correctly. They provide higher confidence than unit tests but may run slower.

### Example: Authentication Flow Integration Test

```typescript
describe('Authentication Flow', () => {
  it('should complete full registration and login flow', async () => {
    const user = userEvent.setup();
    
    // Start at registration page
    renderWithAuth(<RegisterPage />);
    
    // Fill registration form
    await user.type(screen.getByLabelText(/username/i), 'newuser');
    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/password/i), 'SecurePass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
    
    // Submit registration
    await user.click(screen.getByRole('button', { name: /register/i }));
    
    // Verify automatic login and redirect
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
    });
    
    // Verify user session is established
    expect(useSession()).toMatchObject({
      data: expect.objectContaining({
        user: expect.objectContaining({
          email: 'new@example.com',
        }),
      }),
    });
  });
});
```

### Example: Case Management Integration Test

```typescript
describe('Case Management', () => {
  it('should create, edit, and delete a case', async () => {
    const user = userEvent.setup();
    
    // Start at dashboard
    renderWithAuth(<Dashboard />);
    
    // Create new case
    await user.click(screen.getByRole('button', { name: /create case/i }));
    await user.type(screen.getByLabelText(/case name/i), 'Test Case');
    await user.type(screen.getByLabelText(/description/i), 'Test description');
    await user.click(screen.getByRole('button', { name: /create/i }));
    
    // Verify case appears in list
    await waitFor(() => {
      expect(screen.getByText('Test Case')).toBeInTheDocument();
    });
    
    // Edit case
    await user.click(screen.getByTestId('edit-case-1'));
    await user.clear(screen.getByLabelText(/case name/i));
    await user.type(screen.getByLabelText(/case name/i), 'Updated Case');
    await user.click(screen.getByRole('button', { name: /save/i }));
    
    // Verify update
    expect(screen.getByText('Updated Case')).toBeInTheDocument();
    
    // Delete case
    await user.click(screen.getByTestId('delete-case-1'));
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    
    // Verify deletion
    await waitFor(() => {
      expect(screen.queryByText('Updated Case')).not.toBeInTheDocument();
    });
  });
});
```

## API Mocking with MSW

MSW (Mock Service Worker) intercepts network requests at the network level, providing realistic API mocking for tests.

### Setting Up Mocks

```typescript
// src/__tests__/mocks/handlers.ts
import { HttpResponse, http } from 'msw';

export const handlers = [
  // Mock GET request
  http.get(`${API_BASE_URL}/api/cases/`, () => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'Test Case',
        description: 'A test case',
        created_date: '2024-01-01T00:00:00Z',
      },
    ]);
  }),

  // Mock POST request with request body validation
  http.post(`${API_BASE_URL}/api/cases/`, async ({ request }) => {
    const body = await request.json();
    
    // Validate request
    if (!body.name) {
      return HttpResponse.json(
        { name: ['This field is required.'] },
        { status: 400 }
      );
    }
    
    return HttpResponse.json(
      {
        id: 2,
        ...body,
        created_date: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // Mock error responses
  http.delete(`${API_BASE_URL}/api/cases/:id/`, ({ params }) => {
    if (params.id === '999') {
      return HttpResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
```

### Overriding Mocks for Specific Tests

```typescript
import { server } from '@/src/__tests__/mocks/server';
import { HttpResponse, http } from 'msw';

describe('Error Handling', () => {
  it('should handle network errors gracefully', async () => {
    // Override handler for this test only
    server.use(
      http.get(`${API_BASE_URL}/api/cases/`, () => {
        return HttpResponse.error();
      })
    );
    
    renderWithAuth(<CaseList />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load cases/i)).toBeInTheDocument();
    });
  });

  it('should handle 500 errors', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/cases/`, () => {
        return new HttpResponse(null, { status: 500 });
      })
    );
    
    renderWithAuth(<CaseList />);
    
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });
});
```

## Common Testing Patterns

### Testing Loading States

```typescript
it('should show loading state while fetching data', async () => {
  renderWithAuth(<CaseList />);
  
  // Check for loading indicator immediately
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  
  // Wait for data to load
  await waitFor(() => {
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });
  
  // Verify data is displayed
  expect(screen.getByText('Test Case')).toBeInTheDocument();
});
```

### Testing Error States

```typescript
it('should display error message on API failure', async () => {
  server.use(
    http.get(`${API_BASE_URL}/api/cases/`, () => {
      return HttpResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    })
  );
  
  renderWithAuth(<CaseList />);
  
  await waitFor(() => {
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to load cases/i)).toBeInTheDocument();
  });
  
  // Test retry functionality
  const retryButton = screen.getByRole('button', { name: /retry/i });
  await userEvent.click(retryButton);
  
  // Should attempt to reload
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
});
```

### Testing Accessibility

```typescript
describe('Accessibility', () => {
  it('should be navigable by keyboard', async () => {
    const user = userEvent.setup();
    renderWithAuth(<NavigationMenu />);
    
    // Tab through menu items
    await user.tab();
    expect(screen.getByRole('link', { name: /home/i })).toHaveFocus();
    
    await user.tab();
    expect(screen.getByRole('link', { name: /cases/i })).toHaveFocus();
    
    // Activate with Enter key
    await user.keyboard('{Enter}');
    expect(mockRouter.push).toHaveBeenCalledWith('/cases');
  });

  it('should announce form errors to screen readers', async () => {
    const user = userEvent.setup();
    renderWithAuth(<LoginForm />);
    
    // Submit empty form
    await user.click(screen.getByRole('button', { name: /submit/i }));
    
    // Error should be in accessible error region
    const errorRegion = screen.getByRole('alert');
    expect(errorRegion).toHaveTextContent(/username is required/i);
    expect(errorRegion).toHaveAttribute('aria-live', 'polite');
  });
});
```

### Testing Real-time Features (WebSocket)

```typescript
describe('Real-time Collaboration', () => {
  it('should update UI when receiving WebSocket messages', async () => {
    const mockWebSocket = createMockWebSocket();
    renderWithAuth(<CollaborativeEditor caseId={1} />);
    
    // Simulate incoming WebSocket message
    act(() => {
      mockWebSocket.simulateMessage({
        type: 'user-joined',
        user: { id: 2, name: 'Other User' },
      });
    });
    
    // Verify UI updates
    await waitFor(() => {
      expect(screen.getByText('Other User joined')).toBeInTheDocument();
    });
    
    // Simulate content update
    act(() => {
      mockWebSocket.simulateMessage({
        type: 'content-update',
        content: 'Updated content from other user',
      });
    });
    
    expect(screen.getByText('Updated content from other user')).toBeInTheDocument();
  });
});
```

## Testing Utilities Reference

### Custom Render Functions

```typescript
// Basic render with all providers
import { render } from '@/src/__tests__/utils/test-utils';
render(<Component />);

// Render with authentication
import { renderWithAuth } from '@/src/__tests__/utils/test-utils';
renderWithAuth(<ProtectedComponent />);

// Render without providers (for isolated testing)
import { renderWithoutProviders } from '@/src/__tests__/utils/test-utils';
renderWithoutProviders(<PureComponent />);
```

### Mock Data Generators

```typescript
import {
  createMockAssuranceCase,
  createMockUser,
  createMockTeam,
  createMockGoal,
  createMockEvidence,
} from '@/src/__tests__/utils/mock-data';

// Generate mock data with overrides
const mockCase = createMockAssuranceCase({
  id: 123,
  name: 'Custom Case Name',
  permissions: 'edit',
});

const mockGoal = createMockGoal({
  name: 'Safety Goal',
  assurance_case: 123,
});
```

### Common Test Helpers

```typescript
// Create mock form event
import { createMockFormEvent } from '@/src/__tests__/utils/test-utils';
const mockEvent = createMockFormEvent('new value');

// Create mock file for upload tests
import { createMockFile } from '@/src/__tests__/utils/test-utils';
const mockFile = createMockFile('document.pdf', 'application/pdf', 2048);

// Custom waitFor with timeout
import { waitFor } from '@/src/__tests__/utils/test-utils';
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
}, 5000); // 5 second timeout
```

### Testing Toasts/Notifications

```typescript
it('should show success toast after saving', async () => {
  const user = userEvent.setup();
  renderWithAuth(<EditForm />);
  
  // Make changes and save
  await user.type(screen.getByLabelText(/name/i), 'Updated Name');
  await user.click(screen.getByRole('button', { name: /save/i }));
  
  // Verify toast appears
  await waitFor(() => {
    expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
  });
  
  // Toast should auto-dismiss
  await waitFor(() => {
    expect(screen.queryByText(/saved successfully/i)).not.toBeInTheDocument();
  }, { timeout: 5000 });
});
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. "Can't find element" Errors

```typescript
// ❌ Problem: Element not found
screen.getByText('Submit'); // Throws if not found

// ✅ Solution 1: Use more flexible queries
screen.getByRole('button', { name: /submit/i });

// ✅ Solution 2: Wait for element to appear
await waitFor(() => {
  expect(screen.getByText('Submit')).toBeInTheDocument();
});

// ✅ Solution 3: Check if element should exist
expect(screen.queryByText('Submit')).not.toBeInTheDocument();
```

#### 2. Async Testing Issues

```typescript
// ❌ Problem: Not waiting for async operations
it('should load data', () => {
  render(<AsyncComponent />);
  expect(screen.getByText('Loaded Data')).toBeInTheDocument(); // Fails
});

// ✅ Solution: Use async/await with waitFor
it('should load data', async () => {
  render(<AsyncComponent />);
  await waitFor(() => {
    expect(screen.getByText('Loaded Data')).toBeInTheDocument();
  });
});
```

#### 3. State Update Warnings

```typescript
// ❌ Problem: State updates after test completes
it('should handle click', async () => {
  const user = userEvent.setup();
  render(<Component />);
  await user.click(screen.getByRole('button'));
  // Test ends but component continues updating
});

// ✅ Solution: Wait for all updates to complete
it('should handle click', async () => {
  const user = userEvent.setup();
  render(<Component />);
  await user.click(screen.getByRole('button'));
  
  // Wait for expected state change
  await waitFor(() => {
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });
});
```

#### 4. Mock Not Working

```typescript
// ❌ Problem: Mock not being called
vi.mock('./api', () => ({
  fetchData: () => Promise.resolve([]), // This might not work
}));

// ✅ Solution: Use vi.fn() for better control
vi.mock('./api', () => ({
  fetchData: vi.fn(() => Promise.resolve([])),
}));

// Now you can assert on it
import { fetchData } from './api';
expect(fetchData).toHaveBeenCalled();
```

#### 5. Testing Modal/Portal Content

```typescript
// ❌ Problem: Modal content not found
render(<Modal isOpen={true} />);
screen.getByText('Modal Content'); // Might fail

// ✅ Solution: Modal content might be in document.body
render(<Modal isOpen={true} />);
expect(document.body).toHaveTextContent('Modal Content');

// Or use within
import { within } from '@testing-library/react';
const modal = screen.getByRole('dialog');
expect(within(modal).getByText('Modal Content')).toBeInTheDocument();
```

### Performance Tips

1. **Use `userEvent.setup()` once per test**
   ```typescript
   const user = userEvent.setup();
   // Use this user instance for all interactions in the test
   ```

2. **Batch related assertions**
   ```typescript
   // Instead of multiple waitFor calls
   await waitFor(() => {
     expect(screen.getByText('Item 1')).toBeInTheDocument();
     expect(screen.getByText('Item 2')).toBeInTheDocument();
     expect(screen.getByText('Item 3')).toBeInTheDocument();
   });
   ```

3. **Mock heavy operations**
   ```typescript
   // Mock expensive computations or external libraries
   vi.mock('@/lib/heavy-computation', () => ({
     calculate: vi.fn(() => 'mocked result'),
   }));
   ```

## CI/CD Integration

### GitHub Actions Configuration

The test suite runs automatically on:
- Pull requests
- Pushes to main branch
- Manual workflow dispatch

### Coverage Requirements

Our codebase maintains strict coverage thresholds:
- Statements: 90%
- Branches: 85%
- Functions: 90%
- Lines: 90%

### Pre-commit Hooks

Tests run automatically before commits via pre-commit hooks. To bypass (not recommended):
```bash
git commit --no-verify
```

### Continuous Integration Best Practices

1. **Keep tests fast**: Aim for the entire suite to run in under 5 minutes
2. **Fix flaky tests immediately**: Don't ignore intermittent failures
3. **Monitor coverage trends**: Ensure coverage doesn't decrease over time
4. **Run tests in parallel**: Vitest runs tests in parallel by default

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library Documentation](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Documentation](https://mswjs.io/docs/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Accessibility Testing Guide](https://www.w3.org/WAI/test-evaluate/preliminary/)

## Contributing to Tests

When adding new features:
1. Write tests alongside the implementation
2. Ensure all edge cases are covered
3. Add integration tests for critical user flows
4. Update mock data and handlers as needed
5. Document any new testing patterns in this guide

Remember: Tests are documentation for how your code should behave. Write them clearly and comprehensively.
