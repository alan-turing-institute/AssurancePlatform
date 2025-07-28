import { act, renderHook } from '@testing-library/react';
import type { Connection, Edge, EdgeChange, Node, NodeChange } from 'reactflow';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssuranceCase, Comment, User } from '@/types';
import useStore from '../store';

// Clear the store mock from setup.tsx
beforeAll(() => {
  vi.unmock('@/data/store');
});

// Mock Dagre
vi.mock('@dagrejs/dagre', () => ({
  default: {
    graphlib: {
      Graph: vi.fn().mockImplementation(() => ({
        setDefaultEdgeLabel: vi.fn().mockReturnThis(),
        setGraph: vi.fn().mockReturnThis(),
        setNode: vi.fn(),
        setEdge: vi.fn(),
        node: vi.fn().mockReturnValue({ x: 100, y: 100 }),
      })),
    },
    layout: vi.fn(),
  },
}));

// Mock ReactFlow utilities
vi.mock('reactflow', () => ({
  addEdge: vi.fn((connection: Connection, edges: Edge[]) => [
    ...edges,
    {
      id: `${connection.source}-${connection.target}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
    },
  ]),
  applyNodeChanges: vi.fn((changes: NodeChange[], nodes: Node[]) => {
    const processChange = (
      change: NodeChange,
      currentNodes: Node[]
    ): Node[] => {
      if (change.type === 'remove') {
        return currentNodes.filter((n) => n.id !== change.id);
      }
      if (change.type === 'add' && 'item' in change) {
        return [...currentNodes, change.item];
      }
      if (
        change.type === 'position' &&
        'position' in change &&
        change.position
      ) {
        const newPosition = change.position;
        return currentNodes.map((n) =>
          n.id === change.id ? { ...n, position: newPosition } : n
        );
      }
      return currentNodes;
    };

    return changes.reduce(
      (acc, change) => processChange(change, acc),
      [...nodes]
    );
  }),
  applyEdgeChanges: vi.fn((changes: EdgeChange[], edges: Edge[]) => {
    let newEdges = [...edges];
    for (const change of changes) {
      if (change.type === 'remove') {
        newEdges = newEdges.filter((e) => e.id !== change.id);
      } else if (change.type === 'add' && 'item' in change) {
        newEdges.push(change.item);
      }
    }
    return newEdges;
  }),
}));

describe('useStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.setAssuranceCase(null);
      result.current.setNodes([]);
      result.current.setEdges([]);
      result.current.setActiveUsers([]);
      result.current.setNodeComments([]);
      result.current.setCaseNotes([]);
      result.current.setViewMembers([]);
      result.current.setEditMembers([]);
      result.current.setReviewMembers([]);
      result.current.setOrphanedElements([]);
    });
  });

  describe('Initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.assuranceCase).toBeNull();
      expect(result.current.orphanedElements).toEqual([]);
      expect(result.current.nodes).toEqual([]);
      expect(result.current.edges).toEqual([]);
      expect(result.current.activeUsers).toEqual([]);
      expect(result.current.nodeComments).toEqual([]);
      expect(result.current.caseNotes).toEqual([]);
      expect(result.current.viewMembers).toEqual([]);
      expect(result.current.editMembers).toEqual([]);
      expect(result.current.reviewMembers).toEqual([]);
    });
  });

  describe('setAssuranceCase', () => {
    it('should set assurance case', () => {
      const { result } = renderHook(() => useStore());
      const mockCase: AssuranceCase = {
        id: 1,
        name: 'Test Case',
        type: 'AssuranceCase',
        lock_uuid: null,
        comments: [],
        permissions: ['edit'],
        created_date: '2024-01-01',
      };

      act(() => {
        result.current.setAssuranceCase(mockCase);
      });

      expect(result.current.assuranceCase).toEqual(mockCase);
    });

    it('should trigger layoutNodes when setting assurance case', () => {
      const { result } = renderHook(() => useStore());
      const layoutNodesSpy = vi.spyOn(result.current, 'layoutNodes');
      const mockCase: AssuranceCase = {
        id: 1,
        name: 'Test Case',
        type: 'AssuranceCase',
        lock_uuid: null,
        comments: [],
        permissions: ['edit'],
        created_date: '2024-01-01',
      };

      act(() => {
        result.current.setAssuranceCase(mockCase);
      });

      expect(layoutNodesSpy).toHaveBeenCalled();
    });

    it('should handle null assurance case', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.setAssuranceCase(null);
      });

      expect(result.current.assuranceCase).toBeNull();
    });
  });

  describe('Node operations', () => {
    const mockNode: Node = {
      id: '1',
      type: 'goal',
      position: { x: 0, y: 0 },
      data: { label: 'Test Node' },
    };

    it('should set nodes', () => {
      const { result } = renderHook(() => useStore());
      const nodes = [mockNode];

      act(() => {
        result.current.setNodes(nodes);
      });

      expect(result.current.nodes).toEqual(nodes);
    });

    it('should handle onNodesChange for adding nodes', () => {
      const { result } = renderHook(() => useStore());
      const newNode: Node = {
        id: '2',
        type: 'strategy',
        position: { x: 100, y: 100 },
        data: { label: 'New Node' },
      };

      act(() => {
        result.current.onNodesChange([{ type: 'add', item: newNode }]);
      });

      expect(result.current.nodes).toContainEqual(newNode);
    });

    it('should handle onNodesChange for removing nodes', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.setNodes([mockNode]);
      });

      act(() => {
        result.current.onNodesChange([{ type: 'remove', id: '1' }]);
      });

      expect(result.current.nodes).toEqual([]);
    });

    it('should handle onNodesChange for position updates', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.setNodes([mockNode]);
      });

      const newPosition = { x: 200, y: 200 };
      act(() => {
        result.current.onNodesChange([
          { type: 'position', id: '1', position: newPosition },
        ]);
      });

      expect(result.current.nodes[0].position).toEqual(newPosition);
    });
  });

  describe('Edge operations', () => {
    const mockEdge: Edge = {
      id: 'e1-2',
      source: '1',
      target: '2',
    };

    it('should set edges', () => {
      const { result } = renderHook(() => useStore());
      const edges = [mockEdge];

      act(() => {
        result.current.setEdges(edges);
      });

      expect(result.current.edges).toEqual(edges);
    });

    it('should handle onEdgesChange for adding edges', () => {
      const { result } = renderHook(() => useStore());
      const newEdge: Edge = {
        id: 'e2-3',
        source: '2',
        target: '3',
      };

      act(() => {
        result.current.onEdgesChange([{ type: 'add', item: newEdge }]);
      });

      expect(result.current.edges).toContainEqual(newEdge);
    });

    it('should handle onEdgesChange for removing edges', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.setEdges([mockEdge]);
      });

      act(() => {
        result.current.onEdgesChange([{ type: 'remove', id: 'e1-2' }]);
      });

      expect(result.current.edges).toEqual([]);
    });

    it('should handle onConnect', () => {
      const { result } = renderHook(() => useStore());
      const connection: Connection = {
        source: '1',
        target: '2',
        sourceHandle: 'a',
        targetHandle: 'b',
      };

      act(() => {
        result.current.onConnect(connection);
      });

      expect(result.current.edges).toHaveLength(1);
      expect(result.current.edges[0]).toMatchObject({
        source: '1',
        target: '2',
        sourceHandle: 'a',
        targetHandle: 'b',
      });
    });
  });

  describe('Active users management', () => {
    const mockUser: User = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      createdAt: '2024-01-01',
    };

    it('should set active users', () => {
      const { result } = renderHook(() => useStore());
      const users = [mockUser];

      act(() => {
        result.current.setActiveUsers(users);
      });

      expect(result.current.activeUsers).toEqual(users);
    });

    it('should handle empty active users array', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.setActiveUsers([]);
      });

      expect(result.current.activeUsers).toEqual([]);
    });
  });

  describe('Comments operations', () => {
    const mockComment1: Comment = {
      id: 1,
      author: 'User 1',
      content: 'Comment 1',
      created_at: '2024-01-01T10:00:00Z',
    };

    const mockComment2: Comment = {
      id: 2,
      author: 'User 2',
      content: 'Comment 2',
      created_at: '2024-01-02T10:00:00Z',
    };

    it('should set node comments sorted by date (newest first)', () => {
      const { result } = renderHook(() => useStore());
      const comments = [mockComment1, mockComment2];

      act(() => {
        result.current.setNodeComments(comments);
      });

      expect(result.current.nodeComments).toEqual([mockComment2, mockComment1]);
    });

    it('should handle empty comments array', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.setNodeComments([]);
      });

      expect(result.current.nodeComments).toEqual([]);
    });
  });

  describe('Notes operations', () => {
    const mockNote1: Comment = {
      id: 1,
      author: 'User 1',
      content: 'Note 1',
      created_at: '2024-01-01T10:00:00Z',
    };

    const mockNote2: Comment = {
      id: 2,
      author: 'User 2',
      content: 'Note 2',
      created_at: '2024-01-02T10:00:00Z',
    };

    it('should set case notes sorted by date (newest first)', () => {
      const { result } = renderHook(() => useStore());
      const notes = [mockNote1, mockNote2];

      act(() => {
        result.current.setCaseNotes(notes);
      });

      expect(result.current.caseNotes).toEqual([mockNote2, mockNote1]);
    });

    it('should handle empty notes array', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.setCaseNotes([]);
      });

      expect(result.current.caseNotes).toEqual([]);
    });
  });

  describe('Member management', () => {
    const mockMember: User = {
      id: 1,
      username: 'member1',
      email: 'member1@example.com',
      createdAt: '2024-01-01',
    };

    it('should set view members', () => {
      const { result } = renderHook(() => useStore());
      const members = [mockMember];

      act(() => {
        result.current.setViewMembers(members);
      });

      expect(result.current.viewMembers).toEqual(members);
    });

    it('should set edit members', () => {
      const { result } = renderHook(() => useStore());
      const members = [mockMember];

      act(() => {
        result.current.setEditMembers(members);
      });

      expect(result.current.editMembers).toEqual(members);
    });

    it('should set review members', () => {
      const { result } = renderHook(() => useStore());
      const members = [mockMember];

      act(() => {
        result.current.setReviewMembers(members);
      });

      expect(result.current.reviewMembers).toEqual(members);
    });
  });

  describe('Orphaned elements', () => {
    const mockOrphanedElement = {
      id: 1,
      type: 'goal',
      name: 'Orphaned Goal',
    };

    it('should set orphaned elements from array', () => {
      const { result } = renderHook(() => useStore());
      const elements = [mockOrphanedElement];

      act(() => {
        result.current.setOrphanedElements(elements);
      });

      expect(result.current.orphanedElements).toEqual(elements);
    });

    it('should set orphaned elements from categorised object', () => {
      const { result } = renderHook(() => useStore());
      const categorisedElements = {
        contexts: [{ id: 1, type: 'context', name: 'Context 1' }],
        property_claims: [{ id: 2, type: 'property', name: 'Property 1' }],
        strategies: [{ id: 3, type: 'strategy', name: 'Strategy 1' }],
        evidence: [{ id: 4, type: 'evidence', name: 'Evidence 1' }],
      };

      act(() => {
        result.current.setOrphanedElements(categorisedElements);
      });

      expect(result.current.orphanedElements).toHaveLength(4);
      expect(result.current.orphanedElements).toContainEqual(
        categorisedElements.contexts[0]
      );
      expect(result.current.orphanedElements).toContainEqual(
        categorisedElements.property_claims[0]
      );
      expect(result.current.orphanedElements).toContainEqual(
        categorisedElements.strategies[0]
      );
      expect(result.current.orphanedElements).toContainEqual(
        categorisedElements.evidence[0]
      );
    });

    it('should handle empty categorised object', () => {
      const { result } = renderHook(() => useStore());
      const emptyCategorised = {
        contexts: undefined,
        property_claims: [],
        strategies: undefined,
        evidence: [],
      };

      act(() => {
        result.current.setOrphanedElements(emptyCategorised);
      });

      expect(result.current.orphanedElements).toEqual([]);
    });
  });

  describe('Layout operations', () => {
    it('should layout nodes vertically', () => {
      const { result } = renderHook(() => useStore());
      const nodes: Node[] = [
        { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: {} },
        { id: '2', type: 'strategy', position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [{ id: 'e1-2', source: '1', target: '2' }];

      act(() => {
        result.current.layoutNodes(nodes, edges);
      });

      // The nodes should have been positioned by the layout algorithm
      expect(result.current.nodes).toHaveLength(2);
      expect(result.current.nodes[0].position).toEqual({ x: 100, y: 100 });
      expect(result.current.nodes[1].position).toEqual({ x: 100, y: 100 });
    });

    it('should handle hidden edges in layout', () => {
      const { result } = renderHook(() => useStore());
      const nodes: Node[] = [
        { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: {} },
        { id: '2', type: 'strategy', position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: 'e1-2', source: '1', target: '2', hidden: true } as Edge & {
          hidden?: boolean;
        },
      ];

      act(() => {
        result.current.layoutNodes(nodes, edges);
      });

      // Hidden edges should not affect layout
      expect(result.current.edges).toHaveLength(1);
      expect(result.current.edges[0]).toMatchObject({
        id: 'e1-2',
        hidden: true,
      });
    });
  });

  describe('fitView', () => {
    it('should have fitView function', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.fitView).toBeDefined();
      expect(typeof result.current.fitView).toBe('function');

      // Should not throw when called
      expect(() => result.current.fitView()).not.toThrow();
    });
  });

  describe('State persistence across renders', () => {
    it('should maintain state across multiple renders', () => {
      const { result, rerender } = renderHook(() => useStore());
      const mockCase: AssuranceCase = {
        id: 1,
        name: 'Persistent Case',
        type: 'AssuranceCase',
        lock_uuid: null,
        comments: [],
        permissions: ['edit'],
        created_date: '2024-01-01',
      };

      act(() => {
        result.current.setAssuranceCase(mockCase);
      });

      rerender();

      expect(result.current.assuranceCase).toEqual(mockCase);
    });
  });

  describe('Complex state updates', () => {
    it('should handle multiple simultaneous updates', () => {
      const { result } = renderHook(() => useStore());
      const mockCase: AssuranceCase = {
        id: 1,
        name: 'Complex Case',
        type: 'AssuranceCase',
        lock_uuid: null,
        comments: [],
        permissions: ['edit'],
        created_date: '2024-01-01',
      };
      const mockUser: User = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        createdAt: '2024-01-01',
      };
      const mockComment: Comment = {
        id: 1,
        author: 'Author',
        content: 'Content',
        created_at: '2024-01-01T10:00:00Z',
      };

      act(() => {
        result.current.setAssuranceCase(mockCase);
        result.current.setActiveUsers([mockUser]);
        result.current.setNodeComments([mockComment]);
        result.current.setCaseNotes([mockComment]);
      });

      expect(result.current.assuranceCase).toEqual(mockCase);
      expect(result.current.activeUsers).toEqual([mockUser]);
      expect(result.current.nodeComments).toEqual([mockComment]);
      expect(result.current.caseNotes).toEqual([mockComment]);
    });
  });
});
