/**
 * Test file for WebSocket testing utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockWebSocket,
  MockWebSocketServer,
  WS_READY_STATE,
  MessageType,
  assertConnectionState,
  waitForConnection,
  createAssuranceCaseUpdate,
  createPresenceUpdate,
  simulateWebSocketLifecycle,
  ConcurrentUserSimulator,
  MessageIntegrityTester,
  ReconnectionTester,
  createEventSequenceTester,
  createCollaborationTestScenario,
} from './websocket-test-utils';

describe('WebSocket Testing Utilities', () => {
  describe('MockWebSocket', () => {
    let mockWS: MockWebSocket;

    beforeEach(() => {
      mockWS = new MockWebSocket('ws://localhost:8000/ws');
    });

    afterEach(() => {
      mockWS.close();
    });

    it('should create a mock WebSocket with correct initial state', () => {
      expect(mockWS.url).toBe('ws://localhost:8000/ws');
      expect(mockWS.readyState).toBe(WS_READY_STATE.CONNECTING);
    });

    it('should handle connection opening', () => {
      mockWS.simulateOpen();
      expect(mockWS.readyState).toBe(WS_READY_STATE.OPEN);
    });

    it('should handle message sending', () => {
      mockWS.simulateOpen();
      const message = { type: 'test', content: 'hello' };

      mockWS.send(JSON.stringify(message));

      const sentMessages = mockWS.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual(message);
    });

    it('should handle message receiving', () => {
      let receivedMessage: any;

      mockWS.addEventListener('message', (event: any) => {
        receivedMessage = JSON.parse(event.data);
      });

      const message = { type: 'test', content: 'hello' };
      mockWS.receiveMessage(message);

      expect(receivedMessage).toEqual(message);
    });

    it('should handle connection errors', () => {
      let errorReceived = false;

      mockWS.addEventListener('error', () => {
        errorReceived = true;
      });

      mockWS.simulateError(new Error('Test error'));

      expect(errorReceived).toBe(true);
    });
  });

  describe('MockWebSocketServer', () => {
    let server: MockWebSocketServer;

    beforeEach(() => {
      server = new MockWebSocketServer();
    });

    afterEach(() => {
      server.cleanup();
    });

    it('should create connections', () => {
      const ws = server.createConnection('user1');
      expect(ws).toBeInstanceOf(MockWebSocket);
      expect(server.getConnection('user1')).toBe(ws);
    });

    it('should broadcast messages to all connections', () => {
      const ws1 = server.createConnection('user1');
      const ws2 = server.createConnection('user2');

      ws1.simulateOpen();
      ws2.simulateOpen();

      let receivedMessages: any[] = [];

      ws1.addEventListener('message', (event: any) => {
        receivedMessages.push(JSON.parse(event.data));
      });

      ws2.addEventListener('message', (event: any) => {
        receivedMessages.push(JSON.parse(event.data));
      });

      const message = { type: 'broadcast', content: 'hello all' };
      server.broadcast(message);

      expect(receivedMessages).toHaveLength(2);
    });

    it('should send messages to specific clients', () => {
      const ws1 = server.createConnection('user1');
      const ws2 = server.createConnection('user2');

      ws1.simulateOpen();
      ws2.simulateOpen();

      let user1Received: any;
      let user2Received: any;

      ws1.addEventListener('message', (event: any) => {
        user1Received = JSON.parse(event.data);
      });

      ws2.addEventListener('message', (event: any) => {
        user2Received = JSON.parse(event.data);
      });

      const message = { type: 'private', content: 'hello user1' };
      server.sendToClient('user1', message);

      expect(user1Received).toEqual(message);
      expect(user2Received).toBeUndefined();
    });
  });

  describe('Connection State Assertions', () => {
    let mockWS: MockWebSocket;

    beforeEach(() => {
      mockWS = new MockWebSocket('ws://localhost:8000/ws');
    });

    it('should assert connection states correctly', async () => {
      // Test connecting state
      assertConnectionState.isConnecting(mockWS);

      // Test open state
      mockWS.simulateOpen();
      assertConnectionState.isOpen(mockWS);

      // Test closed state
      mockWS.close();
      // Wait a bit for the close to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));
      assertConnectionState.isClosed(mockWS);
    });

    it('should assert sent messages correctly', () => {
      mockWS.simulateOpen();

      assertConnectionState.hasNoSentMessages(mockWS);

      mockWS.send(JSON.stringify({ type: 'test1', content: 'hello' }));
      mockWS.send(JSON.stringify({ type: 'test2', content: 'world' }));

      assertConnectionState.sentMessageCount(mockWS, 2);
      assertConnectionState.hasSentMessageType(mockWS, 'test1');
      assertConnectionState.hasSentMessagesInOrder(mockWS, ['test1', 'test2']);
    });
  });

  describe('Utility Functions', () => {
    it('should wait for connection', async () => {
      const mockWS = new MockWebSocket('ws://localhost:8000/ws');

      // Simulate connection opening after a delay
      setTimeout(() => {
        mockWS.simulateOpen();
      }, 100);

      await waitForConnection(mockWS, 1000);
      expect(mockWS.readyState).toBe(WS_READY_STATE.OPEN);
    });

    it('should create assurance case update messages', () => {
      const assuranceCase = { id: 1, name: 'Test Case' };
      const message = createAssuranceCaseUpdate(assuranceCase, 'user1');

      expect(message.type).toBe(MessageType.CASE_MESSAGE);
      expect(message.content.assuranceCase).toEqual(assuranceCase);
      expect(message.userId).toBe('user1');
      expect(message.timestamp).toBeDefined();
    });

    it('should create presence update messages', () => {
      const users = [
        {
          id: 'user1',
          username: 'User 1',
          lastActivity: new Date(),
          status: 'active' as const,
        },
        {
          id: 'user2',
          username: 'User 2',
          lastActivity: new Date(),
          status: 'active' as const,
        },
      ];

      const message = createPresenceUpdate(users);

      expect(message.type).toBe(MessageType.PRESENCE_UPDATE);
      expect(message.content.current_connections).toEqual(users);
      expect(message.timestamp).toBeDefined();
    });

    it('should simulate WebSocket lifecycle', async () => {
      let testExecuted = false;

      await simulateWebSocketLifecycle(
        () => new MockWebSocket('ws://localhost:8000/ws'),
        async (ws) => {
          expect(ws.readyState).toBe(WS_READY_STATE.OPEN);
          testExecuted = true;
        }
      );

      expect(testExecuted).toBe(true);
    });
  });

  describe('ConcurrentUserSimulator', () => {
    let server: MockWebSocketServer;
    let simulator: ConcurrentUserSimulator;

    beforeEach(() => {
      server = new MockWebSocketServer();
      simulator = new ConcurrentUserSimulator(server);
    });

    afterEach(() => {
      simulator.cleanup();
      server.cleanup();
    });

    it('should add and manage concurrent users', () => {
      const { ws, presence } = simulator.addUser('user1', 'User 1');

      expect(ws).toBeInstanceOf(MockWebSocket);
      expect(presence.id).toBe('user1');
      expect(presence.username).toBe('User 1');
      expect(presence.status).toBe('active');
    });

    it('should connect all users', async () => {
      simulator.addUser('user1', 'User 1');
      simulator.addUser('user2', 'User 2');

      await simulator.connectAllUsers();

      const activeUsers = simulator.getActiveUsers();
      expect(activeUsers).toHaveLength(2);
    });

    it('should simulate concurrent edits', async () => {
      simulator.addUser('user1', 'User 1');
      simulator.addUser('user2', 'User 2');

      await simulator.connectAllUsers();

      const messages = await simulator.simulateConcurrentEdits(5, 10);

      expect(messages).toHaveLength(5);
      expect(messages[0].type).toBe(MessageType.CASE_MESSAGE);
    });

    it('should simulate cursor movements', () => {
      simulator.addUser('user1', 'User 1');
      simulator.addUser('user2', 'User 2');

      simulator.simulateCursorMovements();

      const activeUsers = simulator.getActiveUsers();
      activeUsers.forEach((user) => {
        expect(user.cursor).toBeDefined();
        expect(typeof user.cursor?.x).toBe('number');
        expect(typeof user.cursor?.y).toBe('number');
      });
    });
  });

  describe('MessageIntegrityTester', () => {
    let tester: MessageIntegrityTester;

    beforeEach(() => {
      tester = new MessageIntegrityTester();
    });

    it('should log and verify message ordering', () => {
      const message1 = {
        type: 'message1',
        content: 'test1',
        timestamp: Date.now(),
      };
      const message2 = {
        type: 'message2',
        content: 'test2',
        timestamp: Date.now(),
      };

      tester.logMessage(message1, 'user1');
      tester.logMessage(message2, 'user2');

      expect(tester.verifyMessageOrdering(['message1', 'message2'])).toBe(true);
      expect(tester.verifyMessageOrdering(['message2', 'message1'])).toBe(
        false
      );
    });

    it('should check for message duplicates', () => {
      const message = {
        type: 'test',
        content: 'duplicate',
        timestamp: Date.now(),
      };

      tester.logMessage(message, 'user1');
      tester.logMessage(message, 'user2');

      const duplicates = tester.checkForDuplicates();
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].count).toBe(2);
    });

    it('should verify message integrity', () => {
      const validMessage = {
        type: 'valid',
        content: 'test',
        timestamp: Date.now(),
      };
      const invalidMessage = { type: '', content: null, timestamp: 0 } as any;

      tester.logMessage(validMessage, 'user1');
      tester.logMessage(invalidMessage, 'user2');

      const errors = tester.verifyMessageIntegrity();
      expect(errors).toHaveLength(1);
      expect(errors[0].errors).toContain('Missing message type');
      expect(errors[0].errors).toContain('Missing message content');
    });

    it('should generate message statistics', () => {
      const baseTime = Date.now();
      const message1 = { type: 'type1', content: 'test1', timestamp: baseTime };
      const message2 = {
        type: 'type2',
        content: 'test2',
        timestamp: baseTime + 100,
      };
      const message3 = {
        type: 'type1',
        content: 'test3',
        timestamp: baseTime + 200,
      };

      tester.logMessage(message1, 'user1');
      tester.logMessage(message2, 'user2');
      tester.logMessage(message3, 'user1');

      const stats = tester.getMessageStats();
      expect(stats.total).toBe(3);
      expect(stats.byType.type1).toBe(2);
      expect(stats.byType.type2).toBe(1);
      expect(stats.avgTimeBetweenMessages).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ReconnectionTester', () => {
    let tester: ReconnectionTester;

    beforeEach(() => {
      tester = new ReconnectionTester(3, 100);
    });

    it('should simulate successful reconnection', async () => {
      const createConnection = () =>
        new MockWebSocket('ws://localhost:8000/ws');

      const ws = await tester.simulateReconnectionWithBackoff(createConnection);

      expect(ws).toBeInstanceOf(MockWebSocket);
      expect(ws?.readyState).toBe(WS_READY_STATE.OPEN);

      const stats = tester.getReconnectionStats();
      expect(stats.totalAttempts).toBe(1);
      expect(stats.successfulAttempts).toBe(1);
      expect(stats.failedAttempts).toBe(0);
    });

    it('should handle failed reconnection attempts', async () => {
      const createConnection = () =>
        new MockWebSocket('ws://localhost:8000/ws');

      try {
        await tester.simulateReconnectionWithBackoff(
          createConnection,
          () => true
        );
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const stats = tester.getReconnectionStats();
        expect(stats.failedAttempts).toBeGreaterThanOrEqual(3);
        expect(stats.successfulAttempts).toBe(0);
      }
    });
  });

  describe('Event Sequence Tester', () => {
    it('should record and verify event sequences', () => {
      const tester = createEventSequenceTester();

      tester.recordEvent('connect');
      tester.recordEvent('authenticate');
      tester.recordEvent('ready');

      expect(tester.verifySequence(['connect', 'authenticate', 'ready'])).toBe(
        true
      );
      expect(tester.verifySequence(['authenticate', 'connect', 'ready'])).toBe(
        false
      );

      const events = tester.getEvents();
      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('connect');
    });

    it('should check event timing', async () => {
      const tester = createEventSequenceTester();

      tester.recordEvent('start');

      await new Promise((resolve) => setTimeout(resolve, 50));

      tester.recordEvent('end');

      expect(tester.checkEventTiming('start', 'end', 100)).toBe(true);
      expect(tester.checkEventTiming('start', 'end', 10)).toBe(false);
    });
  });

  describe('Collaboration Test Scenario', () => {
    it('should create comprehensive collaboration test scenario', async () => {
      const scenario = await createCollaborationTestScenario({
        userCount: 2,
        messageCount: 5,
        simulateNetworkIssues: false,
        testReconnection: false,
      });

      expect(scenario.server).toBeInstanceOf(MockWebSocketServer);
      expect(scenario.userSimulator).toBeInstanceOf(ConcurrentUserSimulator);
      expect(scenario.messageIntegrityTester).toBeInstanceOf(
        MessageIntegrityTester
      );

      const activeUsers = scenario.userSimulator.getActiveUsers();
      expect(activeUsers).toHaveLength(2);

      const stats = scenario.messageIntegrityTester.getMessageStats();
      expect(stats.total).toBe(5);

      scenario.cleanup();
    });
  });
});
