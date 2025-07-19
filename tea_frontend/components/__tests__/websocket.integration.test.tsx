import { act, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useStore from '@/data/store';
import { WebSocketTestHelper } from '@/src/__tests__/utils/integration-test-utils';
import { createMockAssuranceCase } from '@/src/__tests__/utils/mock-data';
import { renderWithAuth } from '@/src/__tests__/utils/test-utils';
import WebSocketComponent from '../websocket';

// Mock dependencies
vi.mock('next-auth/react');
vi.mock('@/data/store');
vi.mock('@/hooks/use-previous', () => ({
  usePrevious: vi.fn((value) => value),
}));

// Mock WebSocket globally
const mockWebSocket = vi.fn();
global.WebSocket = mockWebSocket as unknown as typeof WebSocket;

describe('WebSocket Integration Tests', () => {
  let wsHelper: WebSocketTestHelper;
  let mockStore: {
    assuranceCase: any;
    setAssuranceCase: ReturnType<typeof vi.fn>;
    activeUsers: any[];
    setActiveUsers: ReturnType<typeof vi.fn>;
  };
  let mockSession: {
    data: {
      user: { id: string; name: string; email: string };
      key: string | null;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create WebSocket test helper
    wsHelper = new WebSocketTestHelper();

    // Mock the WebSocket constructor to return our mock
    mockWebSocket.mockImplementation(() => wsHelper.getMockSocket());

    // Mock store
    mockStore = {
      assuranceCase: createMockAssuranceCase({ id: 123 }),
      setAssuranceCase: vi.fn(),
      activeUsers: [],
      setActiveUsers: vi.fn(),
    };
    (useStore as any).mockReturnValue(mockStore);

    // Mock session
    mockSession = {
      data: {
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
        key: 'test-session-key',
      },
    };
    (useSession as any).mockReturnValue(mockSession);

    // Mock environment variable
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
  });

  afterEach(() => {
    wsHelper.simulateClose();
    vi.resetAllMocks();
  });

  describe('WebSocket Connection Management', () => {
    it('should establish WebSocket connection with correct URL', () => {
      renderWithAuth(<WebSocketComponent />);

      expect(mockWebSocket).toHaveBeenCalledWith(
        'ws://localhost:8000/ws/case/123/?token=test-session-key'
      );
    });

    it('should handle HTTPS to WSS protocol conversion', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';

      renderWithAuth(<WebSocketComponent />);

      expect(mockWebSocket).toHaveBeenCalledWith(
        'wss://api.example.com/ws/case/123/?token=test-session-key'
      );
    });

    it('should not connect without assurance case ID', () => {
      mockStore.assuranceCase = null;

      renderWithAuth(<WebSocketComponent />);

      expect(mockWebSocket).not.toHaveBeenCalled();
    });

    it('should not connect without session key', () => {
      mockSession.data = { ...mockSession.data, key: null };

      renderWithAuth(<WebSocketComponent />);

      expect(mockWebSocket).not.toHaveBeenCalled();
    });

    it('should not connect without API URL', () => {
      delete process.env.NEXT_PUBLIC_API_URL;

      renderWithAuth(<WebSocketComponent />);

      expect(mockWebSocket).not.toHaveBeenCalled();
    });
  });

  describe('Real-time Messaging', () => {
    it('should send ping messages on connection open', async () => {
      renderWithAuth(<WebSocketComponent />);

      // Simulate connection open
      await act(async () => {
        wsHelper.getMockSocket().dispatchEvent(new Event('open'));
      });

      // Verify initial ping was sent
      const sentMessages = wsHelper.getSentMessages();
      expect(sentMessages).toContainEqual({ content: 'ping' });
    });

    it('should send periodic ping messages', async () => {
      vi.useFakeTimers();

      renderWithAuth(<WebSocketComponent />);

      // Simulate connection open
      await act(async () => {
        wsHelper.getMockSocket().dispatchEvent(new Event('open'));
      });

      // Fast forward time to trigger ping interval
      await act(async () => {
        vi.advanceTimersByTime(1200); // pingInterval
      });

      const sentMessages = wsHelper.getSentMessages();
      expect(
        sentMessages.filter((msg: any) => msg.content === 'ping')
      ).toHaveLength(2);

      vi.useRealTimers();
    });

    it('should send assurance case updates', async () => {
      const { rerender } = renderWithAuth(<WebSocketComponent />);

      // Simulate connection open
      await act(async () => {
        wsHelper.getMockSocket().dispatchEvent(new Event('open'));
      });

      // Update assurance case
      const updatedCase = createMockAssuranceCase({
        id: 123,
        name: 'Updated Case Name',
      });
      mockStore.assuranceCase = updatedCase;

      rerender(<WebSocketComponent />);

      await waitFor(() => {
        const sentMessages = wsHelper.getSentMessages();
        expect(sentMessages).toContainEqual({
          type: 'case_message',
          content: { assuranceCase: updatedCase },
        });
      });
    });
  });

  describe('Incoming Message Handling', () => {
    it('should update active users from current_connections message', async () => {
      renderWithAuth(<WebSocketComponent />);

      const usersData = [
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' },
      ];

      // Simulate incoming message with current connections
      await act(async () => {
        wsHelper.simulateMessage({
          content: {
            current_connections: usersData,
          },
        });
      });

      expect(mockStore.setActiveUsers).toHaveBeenCalledWith(usersData);
    });

    it('should update assurance case goals from incoming message', async () => {
      renderWithAuth(<WebSocketComponent />);

      const updatedGoals = [
        { id: 1, name: 'Updated Goal 1' },
        { id: 2, name: 'New Goal 2' },
      ];

      // Simulate incoming message with assurance case update
      await act(async () => {
        wsHelper.simulateMessage({
          content: {
            assuranceCase: {
              goals: updatedGoals,
            },
          },
        });
      });

      expect(mockStore.setAssuranceCase).toHaveBeenCalledWith({
        ...mockStore.assuranceCase,
        goals: updatedGoals,
      });
    });

    it('should handle complex assurance case updates', async () => {
      renderWithAuth(<WebSocketComponent />);

      const complexUpdate = {
        goals: [
          {
            id: 1,
            name: 'Safety Goal',
            strategies: [{ id: 1, name: 'Testing Strategy' }],
          },
        ],
      };

      await act(async () => {
        wsHelper.simulateMessage({
          content: {
            assuranceCase: complexUpdate,
          },
        });
      });

      expect(mockStore.setAssuranceCase).toHaveBeenCalledWith({
        ...mockStore.assuranceCase,
        goals: complexUpdate.goals,
      });
    });

    it('should ignore messages without relevant content', async () => {
      renderWithAuth(<WebSocketComponent />);

      await act(async () => {
        wsHelper.simulateMessage({
          content: {
            irrelevant_data: 'some value',
          },
        });
      });

      expect(mockStore.setActiveUsers).not.toHaveBeenCalled();
      expect(mockStore.setAssuranceCase).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket connection errors', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      renderWithAuth(<WebSocketComponent />);

      // Simulate connection error
      await act(async () => {
        wsHelper.simulateError(new Error('Connection failed'));
      });

      // Should not crash the component
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle malformed JSON messages gracefully', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      renderWithAuth(<WebSocketComponent />);

      // Simulate malformed JSON message
      await act(async () => {
        const mockEvent = new MessageEvent('message', {
          data: 'invalid-json',
        });
        wsHelper.getMockSocket().dispatchEvent(mockEvent);
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle connection close events', async () => {
      vi.useFakeTimers();

      renderWithAuth(<WebSocketComponent />);

      // Simulate connection open to start ping interval
      await act(async () => {
        wsHelper.getMockSocket().dispatchEvent(new Event('open'));
      });

      // Simulate connection close
      await act(async () => {
        wsHelper.simulateClose();
      });

      // Verify ping interval is cleared (no more pings after close)
      const initialPingCount = wsHelper
        .getSentMessages()
        .filter((msg: any) => msg.content === 'ping').length;

      await act(async () => {
        vi.advanceTimersByTime(5000); // Advance well beyond ping interval
      });

      const finalPingCount = wsHelper
        .getSentMessages()
        .filter((msg: any) => msg.content === 'ping').length;
      expect(finalPingCount).toBe(initialPingCount);

      vi.useRealTimers();
    });
  });

  describe('Component Lifecycle', () => {
    it('should cleanup WebSocket connection on unmount', async () => {
      const { unmount } = renderWithAuth(<WebSocketComponent />);

      // Simulate connection open
      await act(async () => {
        wsHelper.getMockSocket().dispatchEvent(new Event('open'));
      });

      const mockSocket = wsHelper.getMockSocket();
      expect(mockSocket.readyState).toBe(WebSocket.OPEN);

      // Unmount component
      unmount();

      expect(mockSocket.close).toHaveBeenCalled();
    });

    it('should reconnect when assurance case ID changes', async () => {
      const { rerender } = renderWithAuth(<WebSocketComponent />);

      expect(mockWebSocket).toHaveBeenCalledTimes(1);

      // Change assurance case ID
      mockStore.assuranceCase = createMockAssuranceCase({ id: 456 });

      rerender(<WebSocketComponent />);

      expect(mockWebSocket).toHaveBeenCalledTimes(2);
      expect(mockWebSocket).toHaveBeenLastCalledWith(
        'ws://localhost:8000/ws/case/456/?token=test-session-key'
      );
    });

    it('should reconnect when session key changes', async () => {
      const { rerender } = renderWithAuth(<WebSocketComponent />);

      expect(mockWebSocket).toHaveBeenCalledTimes(1);

      // Change session key
      mockSession.data.key = 'new-session-key';

      rerender(<WebSocketComponent />);

      expect(mockWebSocket).toHaveBeenCalledTimes(2);
      expect(mockWebSocket).toHaveBeenLastCalledWith(
        'ws://localhost:8000/ws/case/123/?token=new-session-key'
      );
    });
  });

  describe('Multi-user Collaboration', () => {
    it('should handle multiple users connecting and disconnecting', async () => {
      renderWithAuth(<WebSocketComponent />);

      // User 1 connects
      await act(async () => {
        wsHelper.simulateMessage({
          content: {
            current_connections: [
              { id: 1, name: 'User 1', email: 'user1@example.com' },
            ],
          },
        });
      });

      expect(mockStore.setActiveUsers).toHaveBeenCalledWith([
        { id: 1, name: 'User 1', email: 'user1@example.com' },
      ]);

      // User 2 connects
      await act(async () => {
        wsHelper.simulateMessage({
          content: {
            current_connections: [
              { id: 1, name: 'User 1', email: 'user1@example.com' },
              { id: 2, name: 'User 2', email: 'user2@example.com' },
            ],
          },
        });
      });

      expect(mockStore.setActiveUsers).toHaveBeenLastCalledWith([
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' },
      ]);

      // User 1 disconnects
      await act(async () => {
        wsHelper.simulateMessage({
          content: {
            current_connections: [
              { id: 2, name: 'User 2', email: 'user2@example.com' },
            ],
          },
        });
      });

      expect(mockStore.setActiveUsers).toHaveBeenLastCalledWith([
        { id: 2, name: 'User 2', email: 'user2@example.com' },
      ]);
    });

    it('should handle simultaneous assurance case updates from multiple users', async () => {
      renderWithAuth(<WebSocketComponent />);

      // User 1 updates goals
      await act(async () => {
        wsHelper.simulateMessage({
          content: {
            assuranceCase: {
              goals: [{ id: 1, name: 'Goal from User 1' }],
            },
          },
        });
      });

      // User 2 updates goals immediately after
      await act(async () => {
        wsHelper.simulateMessage({
          content: {
            assuranceCase: {
              goals: [
                { id: 1, name: 'Goal from User 1' },
                { id: 2, name: 'Goal from User 2' },
              ],
            },
          },
        });
      });

      expect(mockStore.setAssuranceCase).toHaveBeenCalledTimes(2);
      expect(mockStore.setAssuranceCase).toHaveBeenLastCalledWith({
        ...mockStore.assuranceCase,
        goals: [
          { id: 1, name: 'Goal from User 1' },
          { id: 2, name: 'Goal from User 2' },
        ],
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('should not send duplicate messages for unchanged assurance case', async () => {
      const { rerender } = renderWithAuth(<WebSocketComponent />);

      // Simulate connection open
      await act(async () => {
        wsHelper.getMockSocket().dispatchEvent(new Event('open'));
      });

      const initialMessageCount = wsHelper.getSentMessages().length;

      // Re-render with same assurance case
      rerender(<WebSocketComponent />);

      // Should not send additional case_message
      const finalMessageCount = wsHelper.getSentMessages().length;
      expect(finalMessageCount).toBe(initialMessageCount);
    });

    it('should handle rapid message processing without blocking UI', async () => {
      renderWithAuth(<WebSocketComponent />);

      // Send multiple rapid messages
      const messagePromises = Array.from({ length: 10 }, (_, i) =>
        act(async () => {
          wsHelper.simulateMessage({
            content: {
              current_connections: [
                { id: i, name: `User ${i}`, email: `user${i}@example.com` },
              ],
            },
          });
        })
      );

      await Promise.all(messagePromises);

      // Should process all messages
      expect(mockStore.setActiveUsers).toHaveBeenCalledTimes(10);
    });
  });
});
