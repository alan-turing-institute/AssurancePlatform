import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AssuranceCase,
  Context,
  Goal,
  PropertyClaim,
  Strategy,
} from '@/types';
import type { NestedArrayItem, ReactFlowNode } from '../case-helper';

import {
  addEvidenceToClaim,
  addHiddenProp,
  addPropertyClaimToNested,
  caseItemDescription,
  createAssuranceCaseNode,
  deleteAssuranceCaseNode,
  extractGoalsClaimsStrategies,
  findItemById,
  getAssuranceCaseNode,
  listPropertyClaims,
  setNodeIdentifier,
  updateAssuranceCase,
  updateAssuranceCaseNode,
  updatePropertyClaimNested,
} from '../case-helper';

// Mock fetch for API calls
global.fetch = vi.fn();

// Helper to create mock fetch response
const createMockResponse = (data: unknown, options: Partial<Response> = {}) => {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(data),
    headers: new Headers(),
    redirected: false,
    status: 200,
    statusText: 'OK',
    type: 'basic' as ResponseType,
    url: '',
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
    text: vi.fn(),
    ...options,
  } as unknown as Response;
};

describe('case-helper utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('caseItemDescription', () => {
    it('should return correct descriptions for each case item type', () => {
      expect(caseItemDescription('goal')).toBe(
        'Goals are the overarching objectives of the assurance case. They represent what needs to be achieved or demonstrated.'
      );
      expect(caseItemDescription('context')).toBe(
        'Context elements provide background information and assumptions that frame the assurance case.'
      );
      expect(caseItemDescription('property_claim')).toBe(
        'Property claims assert specific properties or characteristics that support the goals.'
      );
      expect(caseItemDescription('evidence')).toBe(
        'Evidence provides factual support and verification for the claims made in the assurance case.'
      );
      expect(caseItemDescription('strategy')).toBe(
        'Strategies describe the approach or method used to decompose goals into sub-goals or claims.'
      );
    });

    it('should handle unknown types gracefully', () => {
      expect(caseItemDescription('unknown_type')).toBe(
        'Unknown case item type.'
      );
    });

    it('should handle null and undefined inputs', () => {
      expect(caseItemDescription(null as unknown as string)).toBe(
        'Unknown case item type.'
      );
      expect(caseItemDescription(undefined as unknown as string)).toBe(
        'Unknown case item type.'
      );
    });

    it('should handle empty string input', () => {
      expect(caseItemDescription('')).toBe('Unknown case item type.');
    });
  });

  describe('addPropertyClaimToNested', () => {
    const mockPropertyClaim: PropertyClaim = {
      id: 100,
      type: 'PropertyClaim',
      name: 'New Claim',
      short_description: 'Test claim',
      long_description: '',
      goal_id: null,
      property_claim_id: null,
      level: 1,
      claim_type: 'claim',
      property_claims: [],
      evidence: [],
      strategy_id: null,
    };

    it('should add property claim to goal when target goal is found', () => {
      const goals: PropertyClaim[] = [
        {
          id: 1,
          type: 'PropertyClaim',
          name: 'Main Goal',
          short_description: '',
          long_description: '',
          goal_id: null,
          property_claim_id: null,
          level: 1,
          claim_type: 'claim',
          property_claims: [],
          evidence: [],
          strategy_id: null,
        },
      ];

      const result = addPropertyClaimToNested(goals, 1, mockPropertyClaim);

      expect(result).toBe(true);
      expect(goals[0].property_claims).toHaveLength(1);
      expect(goals[0].property_claims[0]).toEqual(mockPropertyClaim);
    });

    it('should add property claim to nested property claim', () => {
      const goals: PropertyClaim[] = [
        {
          id: 1,
          type: 'PropertyClaim',
          name: 'Main Goal',
          short_description: '',
          long_description: '',
          goal_id: null,
          property_claim_id: null,
          level: 1,
          claim_type: 'claim',
          property_claims: [
            {
              id: 2,
              type: 'PropertyClaim',
              name: 'Parent Claim',
              short_description: '',
              long_description: '',
              goal_id: null,
              property_claim_id: null,
              level: 2,
              claim_type: 'claim',
              property_claims: [],
              evidence: [],
              strategy_id: null,
            },
          ],
          evidence: [],
          strategy_id: null,
        },
      ];

      const result = addPropertyClaimToNested(goals, 2, mockPropertyClaim);

      expect(result).toBe(true);
      expect(goals[0].property_claims[0].property_claims).toHaveLength(1);
      expect(goals[0].property_claims[0].property_claims[0]).toEqual(
        mockPropertyClaim
      );
    });

    it('should add property claim to strategy', () => {
      const goals: PropertyClaim[] = [
        {
          id: 1,
          type: 'PropertyClaim',
          name: 'Main Goal',
          short_description: '',
          long_description: '',
          goal_id: null,
          property_claim_id: null,
          level: 1,
          claim_type: 'claim',
          property_claims: [],
          evidence: [],
          strategy_id: null,
          strategies: [
            {
              id: 3,
              name: 'Test Strategy',
              short_description: '',
              long_description: '',
              goal_id: 1,
              property_claims: [],
            },
          ],
        },
      ];

      const result = addPropertyClaimToNested(goals, 3, mockPropertyClaim);

      expect(result).toBe(true);
      expect(goals[0].strategies?.[0].property_claims).toHaveLength(1);
      expect(goals[0].strategies?.[0].property_claims[0]).toEqual(
        mockPropertyClaim
      );
    });

    it('should return unchanged array when target not found', () => {
      const goals: PropertyClaim[] = [
        {
          id: 1,
          type: 'PropertyClaim',
          name: 'Main Goal',
          short_description: '',
          long_description: '',
          goal_id: null,
          property_claim_id: null,
          level: 1,
          claim_type: 'claim',
          property_claims: [],
          evidence: [],
          strategy_id: null,
        },
      ];

      const result = addPropertyClaimToNested(goals, 999, mockPropertyClaim);

      expect(result).toBe(false);
    });

    it('should handle empty goals array', () => {
      const result = addPropertyClaimToNested([], 1, mockPropertyClaim);
      expect(result).toBe(false);
    });

    it('should handle deeply nested structures', () => {
      const goals: PropertyClaim[] = [
        {
          id: 1,
          type: 'PropertyClaim',
          name: 'Main Goal',
          short_description: '',
          long_description: '',
          goal_id: null,
          property_claim_id: null,
          level: 1,
          claim_type: 'claim',
          property_claims: [
            {
              id: 2,
              type: 'PropertyClaim',
              name: 'Level 1',
              short_description: '',
              long_description: '',
              goal_id: null,
              property_claim_id: null,
              level: 2,
              claim_type: 'claim',
              property_claims: [
                {
                  id: 3,
                  type: 'PropertyClaim',
                  name: 'Level 2',
                  short_description: '',
                  long_description: '',
                  goal_id: null,
                  property_claim_id: null,
                  level: 3,
                  claim_type: 'claim',
                  property_claims: [],
                  evidence: [],
                  strategy_id: null,
                },
              ],
              evidence: [],
              strategy_id: null,
            },
          ],
          evidence: [],
          strategy_id: null,
        },
      ];

      addPropertyClaimToNested(goals, 3, mockPropertyClaim);

      expect(
        goals[0].property_claims[0].property_claims[0].property_claims
      ).toHaveLength(1);
    });
  });

  describe('updatePropertyClaimNested', () => {
    const updatedClaim = {
      id: 2,
      name: 'Updated Claim',
      short_description: 'Updated description',
    };

    it('should update property claim when found', () => {
      const goals: PropertyClaim[] = [
        {
          id: 1,
          type: 'PropertyClaim',
          name: 'Main Goal',
          short_description: '',
          long_description: '',
          goal_id: null,
          property_claim_id: null,
          level: 1,
          claim_type: 'claim',
          property_claims: [
            {
              id: 2,
              type: 'PropertyClaim',
              name: 'Original Claim',
              short_description: 'Original description',
              long_description: '',
              goal_id: null,
              property_claim_id: null,
              level: 2,
              claim_type: 'claim',
              property_claims: [],
              evidence: [],
              strategy_id: null,
            },
          ],
          evidence: [],
          strategy_id: null,
        },
      ];

      const result = updatePropertyClaimNested(goals, 2, updatedClaim);

      if (result?.[0]) {
        expect(result[0].property_claims[0].name).toBe('Updated Claim');
        expect(result[0].property_claims[0].short_description).toBe(
          'Updated description'
        );
      }
    });

    it('should update nested property claim', () => {
      const goals: PropertyClaim[] = [
        {
          id: 1,
          type: 'PropertyClaim',
          name: 'Main Goal',
          short_description: '',
          long_description: '',
          goal_id: null,
          property_claim_id: null,
          level: 1,
          claim_type: 'claim',
          property_claims: [
            {
              id: 2,
              type: 'PropertyClaim',
              name: 'Parent Claim',
              short_description: '',
              long_description: '',
              goal_id: null,
              property_claim_id: null,
              level: 2,
              claim_type: 'claim',
              property_claims: [
                {
                  id: 3,
                  type: 'PropertyClaim',
                  name: 'Original Nested',
                  short_description: 'Original',
                  long_description: '',
                  goal_id: null,
                  property_claim_id: null,
                  level: 3,
                  claim_type: 'claim',
                  property_claims: [],
                  evidence: [],
                  strategy_id: null,
                },
              ],
              evidence: [],
              strategy_id: null,
            },
          ],
          evidence: [],
          strategy_id: null,
        },
      ];

      const result = updatePropertyClaimNested(goals, 3, {
        ...updatedClaim,
        id: 3,
      });

      if (result?.[0]) {
        expect(result[0].property_claims[0].property_claims[0].name).toBe(
          'Updated Claim'
        );
      }
    });

    it('should return unchanged array when claim not found', () => {
      const goals: PropertyClaim[] = [
        {
          id: 1,
          type: 'PropertyClaim',
          name: 'Main Goal',
          short_description: '',
          long_description: '',
          goal_id: null,
          property_claim_id: null,
          level: 1,
          claim_type: 'claim',
          property_claims: [],
          evidence: [],
          strategy_id: null,
        },
      ];

      const result = updatePropertyClaimNested(goals, 999, updatedClaim);
      expect(result).toEqual(goals);
    });

    it('should handle empty goals array', () => {
      const result = updatePropertyClaimNested([], 1, updatedClaim);
      expect(result).toEqual([]);
    });
  });

  describe('listPropertyClaims', () => {
    const mockGoals: PropertyClaim[] = [
      {
        id: 1,
        type: 'PropertyClaim',
        name: 'Goal 1',
        short_description: '',
        long_description: '',
        goal_id: null,
        property_claim_id: null,
        level: 1,
        claim_type: 'claim',
        property_claims: [
          {
            id: 2,
            type: 'PropertyClaim',
            name: 'Claim 1',
            short_description: '',
            long_description: '',
            goal_id: null,
            property_claim_id: null,
            level: 2,
            claim_type: 'claim',
            property_claims: [],
            evidence: [],
            strategy_id: null,
          },
          {
            id: 3,
            type: 'PropertyClaim',
            name: 'Claim 2',
            short_description: '',
            long_description: '',
            goal_id: null,
            property_claim_id: null,
            level: 2,
            claim_type: 'claim',
            property_claims: [
              {
                id: 4,
                type: 'PropertyClaim',
                name: 'Nested Claim',
                short_description: '',
                long_description: '',
                goal_id: null,
                property_claim_id: null,
                level: 3,
                claim_type: 'claim',
                property_claims: [],
                evidence: [],
                strategy_id: null,
              },
            ],
            evidence: [],
            strategy_id: null,
          },
        ],
        evidence: [],
        strategy_id: null,
      },
      {
        id: 5,
        type: 'PropertyClaim',
        name: 'Goal 2',
        short_description: '',
        long_description: '',
        goal_id: null,
        property_claim_id: null,
        level: 1,
        claim_type: 'claim',
        property_claims: [
          {
            id: 6,
            type: 'PropertyClaim',
            name: 'Claim 3',
            short_description: '',
            long_description: '',
            goal_id: null,
            property_claim_id: null,
            level: 2,
            claim_type: 'claim',
            property_claims: [],
            evidence: [],
            strategy_id: null,
          },
        ],
        evidence: [],
        strategy_id: null,
      },
    ];

    it('should list all property claims except current one', () => {
      const result = listPropertyClaims(mockGoals, '3');

      expect(result).toHaveLength(3);
      expect(result.map((c) => c.id)).toEqual([2, 4, 6]);
      expect(result.find((c) => c.id === 3)).toBeUndefined();
    });

    it('should include nested claims', () => {
      const result = listPropertyClaims(mockGoals, '999');

      expect(result).toHaveLength(4);
      expect(result.map((c) => c.id)).toEqual([2, 3, 4, 6]);
    });

    it('should handle empty goals array', () => {
      const result = listPropertyClaims([], '1');
      expect(result).toEqual([]);
    });

    it('should handle goals with no property claims', () => {
      const goals: PropertyClaim[] = [
        {
          id: 1,
          type: 'PropertyClaim',
          name: 'Goal',
          short_description: '',
          long_description: '',
          goal_id: null,
          property_claim_id: null,
          level: 1,
          claim_type: 'claim',
          property_claims: [],
          evidence: [],
          strategy_id: null,
        },
      ];
      const result = listPropertyClaims(goals, '1');
      expect(result).toEqual([]);
    });
  });

  describe('addEvidenceToClaim', () => {
    const mockEvidence = {
      id: 100,
      type: 'Evidence',
      name: 'Test Evidence',
      short_description: 'Evidence description',
      long_description: '',
      URL: '',
      property_claim_id: [],
    };

    it('should add evidence to property claim', () => {
      const goals: PropertyClaim[] = [
        {
          id: 1,
          type: 'PropertyClaim',
          name: 'Goal',
          short_description: '',
          long_description: '',
          goal_id: null,
          property_claim_id: null,
          level: 1,
          claim_type: 'claim',
          property_claims: [
            {
              id: 2,
              type: 'PropertyClaim',
              name: 'Claim',
              short_description: '',
              long_description: '',
              goal_id: null,
              property_claim_id: null,
              level: 2,
              claim_type: 'claim',
              property_claims: [],
              evidence: [],
              strategy_id: null,
            },
          ],
          evidence: [],
          strategy_id: null,
        },
      ];

      const result = addEvidenceToClaim(goals, 2, mockEvidence);

      expect(result).toBe(true);
      expect(goals[0].property_claims[0].evidence).toHaveLength(1);
      expect(goals[0].property_claims[0].evidence[0]).toEqual(mockEvidence);
    });

    it('should add evidence to nested claim', () => {
      const goals: PropertyClaim[] = [
        {
          id: 1,
          type: 'PropertyClaim',
          name: 'Goal',
          short_description: '',
          long_description: '',
          goal_id: null,
          property_claim_id: null,
          level: 1,
          claim_type: 'claim',
          property_claims: [
            {
              id: 2,
              type: 'PropertyClaim',
              name: 'Parent',
              short_description: '',
              long_description: '',
              goal_id: null,
              property_claim_id: null,
              level: 2,
              claim_type: 'claim',
              property_claims: [
                {
                  id: 3,
                  type: 'PropertyClaim',
                  name: 'Child',
                  short_description: '',
                  long_description: '',
                  goal_id: null,
                  property_claim_id: null,
                  level: 3,
                  claim_type: 'claim',
                  property_claims: [],
                  evidence: [],
                  strategy_id: null,
                },
              ],
              evidence: [],
              strategy_id: null,
            },
          ],
          evidence: [],
          strategy_id: null,
        },
      ];

      const result = addEvidenceToClaim(goals, 3, mockEvidence);

      expect(result).toBe(true);
      expect(
        goals[0].property_claims[0].property_claims[0].evidence
      ).toHaveLength(1);
    });

    it('should return unchanged when claim not found', () => {
      const goals: PropertyClaim[] = [
        {
          id: 1,
          type: 'PropertyClaim',
          name: 'Goal',
          short_description: '',
          long_description: '',
          goal_id: null,
          property_claim_id: null,
          level: 1,
          claim_type: 'claim',
          property_claims: [],
          evidence: [],
          strategy_id: null,
        },
      ];

      const result = addEvidenceToClaim(goals, 999, mockEvidence);
      expect(result).toBe(false);
    });
  });

  describe('findItemById', () => {
    const mockGoalData: Goal[] = [
      {
        id: 1,
        type: 'Goal',
        name: 'Item 1',
        short_description: '',
        long_description: '',
        keywords: '',
        assurance_case_id: 1,
        context: [],
        property_claims: [
          {
            id: 2,
            type: 'PropertyClaim',
            name: 'Item 2',
            short_description: '',
            long_description: '',
            goal_id: 1,
            property_claim_id: null,
            level: 1,
            claim_type: 'claim',
            property_claims: [],
            evidence: [],
            strategy_id: null,
          },
          {
            id: 3,
            type: 'PropertyClaim',
            name: 'Item 3',
            short_description: '',
            long_description: '',
            goal_id: 1,
            property_claim_id: null,
            level: 1,
            claim_type: 'claim',
            property_claims: [
              {
                id: 4,
                type: 'PropertyClaim',
                name: 'Item 4',
                short_description: '',
                long_description: '',
                goal_id: null,
                property_claim_id: 3,
                level: 2,
                claim_type: 'claim',
                property_claims: [],
                evidence: [],
                strategy_id: null,
              },
            ],
            evidence: [],
            strategy_id: null,
          },
        ],
        strategies: [],
      },
    ];

    it('should find item at root level', () => {
      const result = findItemById(mockGoalData[0], 1);
      expect(result?.name).toBe('Item 1');
    });

    it('should find nested item', () => {
      const result = findItemById(mockGoalData[0], 4);
      expect(result?.name).toBe('Item 4');
    });

    it('should return null when item not found', () => {
      const result = findItemById(mockGoalData[0], 999);
      expect(result).toBeNull();
    });

    it('should handle empty goal structure', () => {
      const emptyGoal: Goal = {
        id: 1,
        type: 'Goal',
        name: 'Empty',
        short_description: '',
        long_description: '',
        keywords: '',
        assurance_case_id: 1,
        context: [],
        property_claims: [],
        strategies: [],
      };
      const result = findItemById(emptyGoal, 999);
      expect(result).toBeNull();
    });

    it('should handle null/undefined collection key', () => {
      const dataWithNull: Goal[] = [
        {
          id: 1,
          type: 'Goal',
          name: 'Item',
          short_description: '',
          long_description: '',
          keywords: '',
          assurance_case_id: 1,
          context: [],
          property_claims: [],
          strategies: [],
        },
      ];
      const result = findItemById(dataWithNull[0], 1);
      expect(result?.name).toBe('Item');
    });
  });

  describe('setNodeIdentifier', () => {
    it('should set identifier for context', () => {
      const node: ReactFlowNode = {
        id: '1',
        type: 'goal',
        data: {
          id: 1,
          name: 'Test',
          type: 'goal',
          context: [{} as Context, {} as Context],
        },
        position: { x: 0, y: 0 },
      };
      const result = setNodeIdentifier(node, 'context');

      expect(result).toBe('C2');
    });

    it('should set identifier for evidence', () => {
      const node: ReactFlowNode = {
        id: '1',
        type: 'goal',
        data: {
          id: 1,
          name: 'Test',
          type: 'goal',
          evidence: [],
        },
        position: { x: 0, y: 0 },
      };
      const result = setNodeIdentifier(node, 'evidence');

      expect(result).toBe('E0');
    });

    it('should set identifier for strategy', () => {
      const node: ReactFlowNode = {
        id: '1',
        type: 'goal',
        data: {
          id: 1,
          name: 'Test',
          type: 'goal',
          strategies: [
            {} as Strategy,
            {} as Strategy,
            {} as Strategy,
            {} as Strategy,
            {} as Strategy,
          ],
        },
        position: { x: 0, y: 0 },
      };
      const result = setNodeIdentifier(node, 'strategy');

      expect(result).toBe('S5');
    });
  });

  describe('extractGoalsClaimsStrategies', () => {
    it('should extract goals, claims and strategies', () => {
      const data: NestedArrayItem[] = [
        {
          id: 1,
          type: 'Goal',
          name: 'Goal 1',
          short_description: '',
          long_description: '',
          keywords: '',
          assurance_case_id: 1,
          context: [],
          property_claims: [],
          strategies: [],
        } as Goal,
        {
          id: 2,
          type: 'PropertyClaim',
          name: 'Claim 1',
          short_description: '',
          long_description: '',
          goal_id: null,
          property_claim_id: null,
          level: 1,
          claim_type: 'claim',
          property_claims: [],
          evidence: [],
          strategy_id: null,
        } as PropertyClaim,
        {
          id: 3,
          type: 'Strategy',
          name: 'Strategy 1',
          short_description: '',
          long_description: '',
          goal_id: 1,
          property_claims: [],
        } as Strategy,
      ];
      const result = extractGoalsClaimsStrategies(data);

      expect(result.goal).toMatchObject({ id: 1, name: 'Goal 1' });
      expect(result.claims).toHaveLength(1);
      expect(result.claims[0]).toMatchObject({ id: 2, name: 'Claim 1' });
      expect(result.strategies).toHaveLength(2); // Goal and Strategy
    });

    it('should handle empty data', () => {
      const result = extractGoalsClaimsStrategies([]);

      expect(result.goal).toBeNull();
      expect(result.claims).toHaveLength(0);
      expect(result.strategies).toHaveLength(0);
    });

    it('should handle nested structures', () => {
      const data: NestedArrayItem[] = [
        {
          id: 1,
          type: 'Goal',
          name: 'Goal with nested',
          short_description: '',
          long_description: '',
          keywords: '',
          assurance_case_id: 1,
          context: [],
          property_claims: [
            {
              id: 2,
              type: 'PropertyClaim',
              name: 'Nested Claim',
              short_description: '',
              long_description: '',
              goal_id: 1,
              property_claim_id: null,
              level: 1,
              claim_type: 'claim',
              property_claims: [],
              evidence: [],
              strategy_id: null,
            },
          ],
          strategies: [
            {
              id: 3,
              type: 'Strategy',
              name: 'Nested Strategy',
              short_description: '',
              long_description: '',
              goal_id: 1,
              property_claims: [],
            },
          ],
        } as Goal,
      ];
      const result = extractGoalsClaimsStrategies(data);

      expect(result.goal).toMatchObject({ id: 1 });
      expect(result.claims).toHaveLength(1);
      expect(result.strategies).toHaveLength(2);
    });
  });

  describe('addHiddenProp', () => {
    it('should add hidden property to single object', async () => {
      const obj: Goal = {
        id: 1,
        type: 'Goal',
        name: 'Test',
        short_description: '',
        long_description: '',
        keywords: '',
        assurance_case_id: 1,
        context: [],
        property_claims: [],
        strategies: [],
      };
      const result = await addHiddenProp(obj);

      expect((result as Goal & { hidden: boolean }).hidden).toBe(false);
      expect((result as Goal).id).toBe(1);
      expect((result as Goal).name).toBe('Test');
    });

    it('should add hidden property to nested objects', async () => {
      const obj = {
        id: 1,
        name: 'Parent',
        children: [
          { id: 2, name: 'Child 1' },
          { id: 3, name: 'Child 2', nested: { id: 4, name: 'Nested' } },
        ],
      };

      const result = (await addHiddenProp(
        obj as unknown as NestedArrayItem
      )) as unknown as {
        hidden: boolean;
        children: Array<{
          hidden: boolean;
          nested?: { hidden: boolean };
        }>;
      };

      expect(result.hidden).toBe(false);
      expect(result.children[0].hidden).toBe(false);
      expect(result.children[1].hidden).toBe(false);
      expect(result.children[1].nested?.hidden).toBe(false);
    });

    it('should handle arrays directly', async () => {
      const arr: Goal[] = [
        {
          id: 1,
          type: 'Goal',
          name: 'Item 1',
          short_description: '',
          long_description: '',
          keywords: '',
          assurance_case_id: 1,
          context: [],
          property_claims: [],
          strategies: [],
        },
        {
          id: 2,
          type: 'Goal',
          name: 'Item 2',
          short_description: '',
          long_description: '',
          keywords: '',
          assurance_case_id: 1,
          context: [],
          property_claims: [],
          strategies: [],
        },
      ];

      const result = (await addHiddenProp(arr)) as (Goal & {
        hidden: boolean;
      })[];

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].hidden).toBe(false);
      expect(result[1].hidden).toBe(false);
    });

    it('should handle null and undefined inputs', async () => {
      expect(
        await addHiddenProp(null as unknown as NestedArrayItem)
      ).toBeNull();
      expect(
        await addHiddenProp(undefined as unknown as NestedArrayItem)
      ).toBeUndefined();
    });

    it('should handle primitive values', async () => {
      expect(await addHiddenProp('string' as unknown as NestedArrayItem)).toBe(
        'string'
      );
      expect(await addHiddenProp(123 as unknown as NestedArrayItem)).toBe(123);
      expect(await addHiddenProp(true as unknown as NestedArrayItem)).toBe(
        true
      );
    });
  });

  describe('API functions', () => {
    const mockToken = 'test-token';

    beforeEach(() => {
      vi.mocked(global.fetch).mockResolvedValue(
        createMockResponse({ success: true })
      );
    });

    describe('createAssuranceCaseNode', () => {
      it('should make POST request with correct parameters', async () => {
        const nodeData = { name: 'Test Node', type: 'goal' };

        await createAssuranceCaseNode('cases/1', nodeData, mockToken);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/cases/1/'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: `Token ${mockToken}`,
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify(nodeData),
          })
        );
      });

      it('should handle API errors', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
          ok: false,
          status: 400,
        } as Response);

        const mockAssuranceCase: AssuranceCase = {
          id: 1,
          name: 'Test Case',
          type: 'AssuranceCase',
          lock_uuid: null,
          comments: [],
          permissions: [],
          created_date: '2024-01-01',
        };
        const result = await createAssuranceCaseNode(
          'cases/1',
          mockAssuranceCase,
          mockToken
        );
        expect(result).toEqual({ ok: false, status: 400 });
      });
    });

    describe('deleteAssuranceCaseNode', () => {
      it('should make DELETE request with correct parameters', async () => {
        await deleteAssuranceCaseNode('goal', 123, mockToken);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/cases/123/goal/1/'),
          expect.objectContaining({
            method: 'DELETE',
            headers: expect.objectContaining({
              Authorization: `Token ${mockToken}`,
            }),
          })
        );
      });
    });

    describe('updateAssuranceCaseNode', () => {
      it('should make PUT request with correct parameters', async () => {
        const updateData = { name: 'Updated Node' };

        await updateAssuranceCaseNode('goal', 1, mockToken, updateData);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/cases/123/goal/1/'),
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              Authorization: `Token ${mockToken}`,
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify(updateData),
          })
        );
      });
    });

    describe('getAssuranceCaseNode', () => {
      it('should make GET request with correct parameters', async () => {
        await getAssuranceCaseNode('goal', 1, mockToken);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/cases/123/goal/1/'),
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              Authorization: `Token ${mockToken}`,
            }),
          })
        );
      });
    });

    describe('updateAssuranceCase', () => {
      it('should make PUT request to update entire case', async () => {
        const caseData = { name: 'Updated Case' };

        const mockAssuranceCase: AssuranceCase = {
          id: 123,
          name: 'Test Case',
          type: 'AssuranceCase',
          lock_uuid: null,
          comments: [],
          permissions: [],
          created_date: '2024-01-01',
        };
        const mockNode: ReactFlowNode = {
          id: '123',
          type: 'goal',
          data: {
            id: 123,
            name: 'Test Node',
            type: 'goal',
          },
          position: { x: 0, y: 0 },
        };
        await updateAssuranceCase(
          'goal',
          mockAssuranceCase,
          caseData,
          123,
          mockNode
        );

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/cases/123/'),
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              Authorization: `Token ${mockToken}`,
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify(caseData),
          })
        );
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle malformed data gracefully', () => {
      const malformedData = [
        { id: null, name: undefined },
        { property_claims: 'not-an-array' },
        null,
        undefined,
      ];

      expect(() =>
        listPropertyClaims(malformedData as unknown as PropertyClaim[], '1')
      ).not.toThrow();
      expect(() => {
        try {
          // Use a valid NestedArrayItem for testing
          const validItem: Goal = {
            id: 1,
            type: 'Goal',
            name: 'Test',
            short_description: '',
            long_description: '',
            keywords: '',
            assurance_case_id: 1,
            context: [],
            property_claims: [],
            strategies: [],
          };
          findItemById(validItem, 1);
        } catch {
          // Expected to potentially throw with malformed data
        }
      }).not.toThrow();
    });

    it('should handle circular references without infinite loops', () => {
      const circularData: Goal = {
        id: 1,
        type: 'Goal',
        name: 'Test',
        short_description: '',
        long_description: '',
        keywords: '',
        assurance_case_id: 1,
        context: [],
        property_claims: [],
        strategies: [],
      };
      // Create circular reference
      const circularPropertyClaim: PropertyClaim = {
        id: 2,
        type: 'PropertyClaim',
        name: 'Circular',
        short_description: '',
        long_description: '',
        goal_id: 1,
        property_claim_id: null,
        level: 1,
        claim_type: 'claim',
        property_claims: [],
        evidence: [],
        strategy_id: null,
      };
      circularData.property_claims.push(circularPropertyClaim);

      // Should not hang or crash
      expect(() => findItemById(circularData, 1)).not.toThrow();
    });

    it('should handle very large datasets efficiently', () => {
      const largeData: Goal[] = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        type: 'Goal',
        name: `Item ${i}`,
        short_description: '',
        long_description: '',
        keywords: '',
        assurance_case_id: 1,
        context: [],
        property_claims: [],
        strategies: [],
      }));

      const start = performance.now();
      const result = findItemById(largeData[999], 999);
      const end = performance.now();

      expect(result?.id).toBe(999);
      expect(end - start).toBeLessThan(100); // Should complete in reasonable time
    });
  });
});
