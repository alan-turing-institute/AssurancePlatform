import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  convertAssuranceCase,
  createEdgesFromNodes,
  createNodesRecursively,
} from '../convert-case';

describe('convert-case utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('convertAssuranceCase', () => {
    const mockAssuranceCase = {
      id: 1,
      name: 'Test Case',
      goals: [
        {
          id: 1,
          name: 'Main Goal',
          short_description: 'Primary objective',
          property_claims: [
            {
              id: 2,
              name: 'Property Claim',
              short_description: 'Supporting claim',
              evidence: [
                {
                  id: 3,
                  name: 'Evidence Item',
                  short_description: 'Supporting evidence',
                },
              ],
            },
          ],
          strategies: [
            {
              id: 4,
              name: 'Strategy',
              short_description: 'Approach',
            },
          ],
          contexts: [
            {
              id: 5,
              name: 'Context',
              short_description: 'Background',
            },
          ],
        },
      ],
    };

    it('should convert assurance case to ReactFlow format', async () => {
      const result = await convertAssuranceCase(mockAssuranceCase);

      expect(result).toHaveProperty('caseNodes');
      expect(result).toHaveProperty('caseEdges');
      expect(Array.isArray(result.caseNodes)).toBe(true);
      expect(Array.isArray(result.caseEdges)).toBe(true);
    });

    it('should create nodes for all elements', async () => {
      const result = await convertAssuranceCase(mockAssuranceCase);

      // Should have nodes for goal, property claim, evidence, strategy, context
      expect(result.caseNodes.length).toBeGreaterThan(0);

      // Check that different node types are created
      const nodeTypes = result.caseNodes.map((node) => node.type);
      expect(nodeTypes).toContain('goal');
    });

    it('should create edges between connected nodes', async () => {
      const result = await convertAssuranceCase(mockAssuranceCase);

      expect(result.caseEdges.length).toBeGreaterThan(0);

      // Edges should have proper structure
      result.caseEdges.forEach((edge) => {
        expect(edge).toHaveProperty('id');
        expect(edge).toHaveProperty('source');
        expect(edge).toHaveProperty('target');
      });
    });

    it('should handle empty assurance case', async () => {
      const emptyCase = { id: 1, name: 'Empty Case', goals: [] };

      const result = await convertAssuranceCase(emptyCase);

      expect(result.caseNodes).toEqual([]);
      expect(result.caseEdges).toEqual([]);
    });

    it('should handle assurance case with no goals', async () => {
      const caseWithoutGoals = { id: 1, name: 'No Goals Case' };

      const result = await convertAssuranceCase(caseWithoutGoals);

      expect(result.caseNodes).toEqual([]);
      expect(result.caseEdges).toEqual([]);
    });

    it('should handle null assurance case', async () => {
      const result = await convertAssuranceCase(null);

      expect(result.caseNodes).toEqual([]);
      expect(result.caseEdges).toEqual([]);
    });

    it('should handle undefined assurance case', async () => {
      const result = await convertAssuranceCase(undefined);

      expect(result.caseNodes).toEqual([]);
      expect(result.caseEdges).toEqual([]);
    });
  });

  describe('createNodesRecursively', () => {
    const mockGoal = {
      id: 1,
      name: 'Test Goal',
      short_description: 'Test description',
      property_claims: [
        {
          id: 2,
          name: 'Child Claim',
          short_description: 'Child description',
          evidence: [
            {
              id: 3,
              name: 'Evidence',
              short_description: 'Evidence description',
            },
          ],
        },
      ],
      strategies: [
        {
          id: 4,
          name: 'Strategy',
          short_description: 'Strategy description',
        },
      ],
      contexts: [
        {
          id: 5,
          name: 'Context',
          short_description: 'Context description',
        },
      ],
    };

    it('should create nodes recursively for nested structures', () => {
      const nodes: any[] = [];
      const visitedIds = new Set<string>();

      createNodesRecursively([mockGoal], 'goal', nodes, visitedIds, 0);

      expect(nodes.length).toBeGreaterThan(1);

      // Should include the main goal
      const goalNode = nodes.find((n) => n.id === 'goal-1');
      expect(goalNode).toBeDefined();
      expect(goalNode.type).toBe('goal');
      expect(goalNode.data.label).toBe('Test Goal');
    });

    it('should prevent duplicate nodes', () => {
      const nodes: any[] = [];
      const visitedIds = new Set<string>();

      // Add the same goal twice
      createNodesRecursively([mockGoal], 'goal', nodes, visitedIds, 0);
      createNodesRecursively([mockGoal], 'goal', nodes, visitedIds, 0);

      const goalNodes = nodes.filter((n) => n.id === 'goal-1');
      expect(goalNodes).toHaveLength(1);
    });

    it('should respect depth limits', () => {
      const deeplyNested = {
        id: 1,
        name: 'Level 0',
        property_claims: [
          {
            id: 2,
            name: 'Level 1',
            property_claims: [
              {
                id: 3,
                name: 'Level 2',
                property_claims: [
                  {
                    id: 4,
                    name: 'Level 3',
                    property_claims: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const nodes: any[] = [];
      const visitedIds = new Set<string>();
      const maxDepth = 2;

      createNodesRecursively(
        [deeplyNested],
        'goal',
        nodes,
        visitedIds,
        maxDepth
      );

      // Should not include nodes beyond max depth
      const level3Node = nodes.find((n) => n.data.label === 'Level 3');
      expect(level3Node).toBeUndefined();
    });

    it('should create nodes with correct positioning data', () => {
      const nodes: any[] = [];
      const visitedIds = new Set<string>();

      createNodesRecursively([mockGoal], 'goal', nodes, visitedIds, 0);

      const goalNode = nodes.find((n) => n.id === 'goal-1');
      expect(goalNode.position).toBeDefined();
      expect(typeof goalNode.position.x).toBe('number');
      expect(typeof goalNode.position.y).toBe('number');
    });

    it('should handle empty arrays', () => {
      const nodes: any[] = [];
      const visitedIds = new Set<string>();

      createNodesRecursively([], 'goal', nodes, visitedIds, 0);

      expect(nodes).toHaveLength(0);
    });

    it('should handle null/undefined arrays', () => {
      const nodes: any[] = [];
      const visitedIds = new Set<string>();

      createNodesRecursively(null as any, 'goal', nodes, visitedIds, 0);
      expect(nodes).toHaveLength(0);

      createNodesRecursively(undefined as any, 'goal', nodes, visitedIds, 0);
      expect(nodes).toHaveLength(0);
    });

    it('should create correct node types for different elements', () => {
      const nodes: any[] = [];
      const visitedIds = new Set<string>();

      createNodesRecursively([mockGoal], 'goal', nodes, visitedIds, 0);

      const goalNode = nodes.find((n) => n.type === 'goal');
      const claimNode = nodes.find((n) => n.type === 'claim');
      const evidenceNode = nodes.find((n) => n.type === 'evidence');
      const strategyNode = nodes.find((n) => n.type === 'strategy');
      const contextNode = nodes.find((n) => n.type === 'context');

      expect(goalNode).toBeDefined();
      expect(claimNode).toBeDefined();
      expect(evidenceNode).toBeDefined();
      expect(strategyNode).toBeDefined();
      expect(contextNode).toBeDefined();
    });

    it('should handle items with missing properties', () => {
      const incompleteGoal = {
        id: 1,
        name: 'Incomplete Goal',
        // Missing short_description and nested arrays
      };

      const nodes: any[] = [];
      const visitedIds = new Set<string>();

      expect(() => {
        createNodesRecursively([incompleteGoal], 'goal', nodes, visitedIds, 0);
      }).not.toThrow();

      expect(nodes).toHaveLength(1);
      expect(nodes[0].data.label).toBe('Incomplete Goal');
    });
  });

  describe('createEdgesFromNodes', () => {
    const mockNodes = [
      {
        id: 'goal-1',
        type: 'goal',
        data: { parentId: null, elementId: 1, elementType: 'goal' },
      },
      {
        id: 'claim-2',
        type: 'claim',
        data: { parentId: 1, elementId: 2, elementType: 'property_claim' },
      },
      {
        id: 'evidence-3',
        type: 'evidence',
        data: { parentId: 2, elementId: 3, elementType: 'evidence' },
      },
      {
        id: 'strategy-4',
        type: 'strategy',
        data: { parentId: 1, elementId: 4, elementType: 'strategy' },
      },
      {
        id: 'context-5',
        type: 'context',
        data: { parentId: 1, elementId: 5, elementType: 'context' },
      },
    ];

    it('should create edges between parent and child nodes', () => {
      const edges = createEdgesFromNodes(mockNodes);

      expect(edges.length).toBeGreaterThan(0);

      // Should create edge from goal to claim
      const goalToClaimEdge = edges.find(
        (e) => e.source === 'goal-1' && e.target === 'claim-2'
      );
      expect(goalToClaimEdge).toBeDefined();

      // Should create edge from claim to evidence
      const claimToEvidenceEdge = edges.find(
        (e) => e.source === 'claim-2' && e.target === 'evidence-3'
      );
      expect(claimToEvidenceEdge).toBeDefined();
    });

    it('should create unique edge IDs', () => {
      const edges = createEdgesFromNodes(mockNodes);

      const edgeIds = edges.map((edge) => edge.id);
      const uniqueIds = new Set(edgeIds);

      expect(uniqueIds.size).toBe(edgeIds.length);
    });

    it('should not create edges for root nodes', () => {
      const edges = createEdgesFromNodes(mockNodes);

      // Goal node has no parent, so it shouldn't be a target
      const edgesToGoal = edges.filter((e) => e.target === 'goal-1');
      expect(edgesToGoal).toHaveLength(0);
    });

    it('should handle nodes with no parents', () => {
      const orphanNodes = [
        {
          id: 'goal-1',
          type: 'goal',
          data: { parentId: null, elementId: 1, elementType: 'goal' },
        },
        {
          id: 'goal-2',
          type: 'goal',
          data: { parentId: null, elementId: 2, elementType: 'goal' },
        },
      ];

      const edges = createEdgesFromNodes(orphanNodes);
      expect(edges).toHaveLength(0);
    });

    it('should handle empty node array', () => {
      const edges = createEdgesFromNodes([]);
      expect(edges).toEqual([]);
    });

    it('should handle nodes with missing parent references', () => {
      const nodesWithMissingParents = [
        {
          id: 'goal-1',
          type: 'goal',
          data: { parentId: null, elementId: 1, elementType: 'goal' },
        },
        {
          id: 'claim-2',
          type: 'claim',
          data: { parentId: 999, elementId: 2, elementType: 'property_claim' }, // Parent doesn't exist
        },
      ];

      const edges = createEdgesFromNodes(nodesWithMissingParents);

      // Should not create edge to non-existent parent
      expect(edges).toHaveLength(0);
    });

    it('should create correct edge properties', () => {
      const edges = createEdgesFromNodes(mockNodes);

      edges.forEach((edge) => {
        expect(edge).toHaveProperty('id');
        expect(edge).toHaveProperty('source');
        expect(edge).toHaveProperty('target');
        expect(edge).toHaveProperty('type');
        expect(edge.type).toBe('default');
      });
    });
  });

  describe('Integration tests', () => {
    it('should handle complete conversion workflow', async () => {
      const complexCase = {
        id: 1,
        name: 'Complex Case',
        goals: [
          {
            id: 1,
            name: 'Main Goal',
            property_claims: [
              {
                id: 2,
                name: 'Claim 1',
                property_claims: [
                  {
                    id: 3,
                    name: 'Sub-claim',
                    evidence: [{ id: 4, name: 'Evidence 1' }],
                  },
                ],
              },
            ],
            strategies: [{ id: 5, name: 'Strategy 1' }],
          },
          {
            id: 6,
            name: 'Secondary Goal',
            contexts: [{ id: 7, name: 'Context 1' }],
          },
        ],
      };

      const result = await convertAssuranceCase(complexCase);

      expect(result.caseNodes.length).toBeGreaterThan(5);
      expect(result.caseEdges.length).toBeGreaterThan(3);

      // Verify node-edge consistency
      const nodeIds = new Set(result.caseNodes.map((n) => n.id));
      result.caseEdges.forEach((edge) => {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      });
    });

    it('should handle very large assurance cases efficiently', async () => {
      const largeCase = {
        id: 1,
        name: 'Large Case',
        goals: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          name: `Goal ${i + 1}`,
          property_claims: Array.from({ length: 5 }, (_, j) => ({
            id: i * 5 + j + 100,
            name: `Claim ${i}-${j}`,
            evidence: Array.from({ length: 2 }, (_, k) => ({
              id: i * 10 + j * 2 + k + 1000,
              name: `Evidence ${i}-${j}-${k}`,
            })),
          })),
        })),
      };

      const start = performance.now();
      const result = await convertAssuranceCase(largeCase);
      const end = performance.now();

      expect(result.caseNodes.length).toBeGreaterThan(50);
      expect(end - start).toBeLessThan(1000); // Should complete in reasonable time
    });

    it('should maintain data integrity during conversion', async () => {
      const caseData = {
        id: 1,
        name: 'Integrity Test',
        goals: [
          {
            id: 10,
            name: 'Test Goal',
            short_description: 'Goal description',
            property_claims: [
              {
                id: 20,
                name: 'Test Claim',
                short_description: 'Claim description',
              },
            ],
          },
        ],
      };

      const result = await convertAssuranceCase(caseData);

      const goalNode = result.caseNodes.find((n) => n.data.elementId === 10);
      const claimNode = result.caseNodes.find((n) => n.data.elementId === 20);

      expect(goalNode?.data.label).toBe('Test Goal');
      expect(goalNode?.data.description).toBe('Goal description');
      expect(claimNode?.data.label).toBe('Test Claim');
      expect(claimNode?.data.description).toBe('Claim description');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle circular references in data', async () => {
      const circularCase: any = {
        id: 1,
        name: 'Circular Case',
        goals: [
          {
            id: 1,
            name: 'Circular Goal',
            property_claims: [],
          },
        ],
      };

      // Create circular reference
      circularCase.goals[0].property_claims.push(circularCase.goals[0]);

      // Should not hang or crash
      const result = await convertAssuranceCase(circularCase);
      expect(result).toBeDefined();
      expect(result.caseNodes.length).toBeGreaterThan(0);
    });

    it('should handle malformed data gracefully', async () => {
      const malformedCase = {
        id: 'not-a-number',
        name: null,
        goals: [
          {
            id: undefined,
            name: '',
            property_claims: 'not-an-array',
          },
        ],
      };

      expect(async () => {
        await convertAssuranceCase(malformedCase as any);
      }).not.toThrow();
    });

    it('should handle extremely deep nesting', async () => {
      const deepCase = {
        id: 1,
        name: 'Deep Case',
        goals: [
          {
            id: 1,
            name: 'Root Goal',
            property_claims: [] as any[],
          },
        ],
      };

      // Create 20 levels of nesting
      let current = deepCase.goals[0];
      for (let i = 0; i < 20; i++) {
        const claim = {
          id: i + 2,
          name: `Claim Level ${i}`,
          property_claims: [],
        };
        current.property_claims.push(claim);
        current = claim;
      }

      const result = await convertAssuranceCase(deepCase);

      // Should handle deep nesting without stack overflow
      expect(result.caseNodes.length).toBeGreaterThan(1);
      expect(result.caseEdges.length).toBeGreaterThan(0);
    });
  });
});
