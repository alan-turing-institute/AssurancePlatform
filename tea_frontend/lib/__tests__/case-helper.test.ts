import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  updateEvidenceNested,
  updatePropertyClaimNested,
} from '../case-helper';

// Mock fetch for API calls
global.fetch = vi.fn();

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
      expect(caseItemDescription(null as any)).toBe('Unknown case item type.');
      expect(caseItemDescription(undefined as any)).toBe(
        'Unknown case item type.'
      );
    });

    it('should handle empty string input', () => {
      expect(caseItemDescription('')).toBe('Unknown case item type.');
    });
  });

  describe('addPropertyClaimToNested', () => {
    const mockPropertyClaim = {
      id: 100,
      name: 'New Claim',
      short_description: 'Test claim',
      property_claims: [],
    };

    it('should add property claim to goal when target goal is found', () => {
      const goals = [
        {
          id: 1,
          name: 'Main Goal',
          property_claims: [],
        },
      ];

      const result = addPropertyClaimToNested(goals, 1, mockPropertyClaim);

      expect(result).toBe(true);
      expect(goals[0].property_claims).toHaveLength(1);
      expect(goals[0].property_claims[0]).toEqual(mockPropertyClaim);
    });

    it('should add property claim to nested property claim', () => {
      const goals = [
        {
          id: 1,
          name: 'Main Goal',
          property_claims: [
            {
              id: 2,
              name: 'Parent Claim',
              property_claims: [],
            },
          ],
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
      const goals = [
        {
          id: 1,
          name: 'Main Goal',
          strategies: [
            {
              id: 3,
              name: 'Test Strategy',
              property_claims: [],
            },
          ],
        },
      ];

      const result = addPropertyClaimToNested(goals, 3, mockPropertyClaim);

      expect(result).toBe(true);
      expect(goals[0].strategies[0].property_claims).toHaveLength(1);
      expect(goals[0].strategies[0].property_claims[0]).toEqual(
        mockPropertyClaim
      );
    });

    it('should return unchanged array when target not found', () => {
      const goals = [
        {
          id: 1,
          name: 'Main Goal',
          property_claims: [],
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
      const goals = [
        {
          id: 1,
          name: 'Main Goal',
          property_claims: [
            {
              id: 2,
              name: 'Level 1',
              property_claims: [
                {
                  id: 3,
                  name: 'Level 2',
                  property_claims: [],
                },
              ],
            },
          ],
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
      const goals = [
        {
          id: 1,
          name: 'Main Goal',
          property_claims: [
            {
              id: 2,
              name: 'Original Claim',
              short_description: 'Original description',
            },
          ],
        },
      ];

      const result = updatePropertyClaimNested(goals, 2, updatedClaim);

      expect(result[0].property_claims[0].name).toBe('Updated Claim');
      expect(result[0].property_claims[0].short_description).toBe(
        'Updated description'
      );
    });

    it('should update nested property claim', () => {
      const goals = [
        {
          id: 1,
          name: 'Main Goal',
          property_claims: [
            {
              id: 2,
              name: 'Parent Claim',
              property_claims: [
                {
                  id: 3,
                  name: 'Original Nested',
                  short_description: 'Original',
                },
              ],
            },
          ],
        },
      ];

      const result = updatePropertyClaimNested(goals, 3, {
        ...updatedClaim,
        id: 3,
      });

      expect(result[0].property_claims[0].property_claims[0].name).toBe(
        'Updated Claim'
      );
    });

    it('should return unchanged array when claim not found', () => {
      const goals = [
        {
          id: 1,
          name: 'Main Goal',
          property_claims: [],
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
    const mockGoals = [
      {
        id: 1,
        name: 'Goal 1',
        property_claims: [
          { id: 2, name: 'Claim 1' },
          {
            id: 3,
            name: 'Claim 2',
            property_claims: [{ id: 4, name: 'Nested Claim' }],
          },
        ],
      },
      {
        id: 5,
        name: 'Goal 2',
        property_claims: [{ id: 6, name: 'Claim 3' }],
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
      const goals = [{ id: 1, name: 'Goal', property_claims: [] }];
      const result = listPropertyClaims(goals, '1');
      expect(result).toEqual([]);
    });
  });

  describe('addEvidenceToClaim', () => {
    const mockEvidence = {
      id: 100,
      name: 'Test Evidence',
      short_description: 'Evidence description',
    };

    it('should add evidence to property claim', () => {
      const goals = [
        {
          id: 1,
          name: 'Goal',
          property_claims: [
            {
              id: 2,
              name: 'Claim',
              evidence: [],
            },
          ],
        },
      ];

      const result = addEvidenceToClaim(goals, 2, mockEvidence);

      expect(result).toBe(true);
      expect(goals[0].property_claims[0].evidence).toHaveLength(1);
      expect(goals[0].property_claims[0].evidence[0]).toEqual(mockEvidence);
    });

    it('should add evidence to nested claim', () => {
      const goals = [
        {
          id: 1,
          name: 'Goal',
          property_claims: [
            {
              id: 2,
              name: 'Parent',
              property_claims: [
                {
                  id: 3,
                  name: 'Child',
                  evidence: [],
                },
              ],
            },
          ],
        },
      ];

      const result = addEvidenceToClaim(goals, 3, mockEvidence);

      expect(result).toBe(true);
      expect(
        goals[0].property_claims[0].property_claims[0].evidence
      ).toHaveLength(1);
    });

    it('should return unchanged when claim not found', () => {
      const goals = [
        {
          id: 1,
          name: 'Goal',
          property_claims: [],
        },
      ];

      const result = addEvidenceToClaim(goals, 999, mockEvidence);
      expect(result).toEqual(goals);
    });
  });

  describe('findItemById', () => {
    const mockData = [
      {
        id: 1,
        name: 'Item 1',
        children: [
          { id: 2, name: 'Item 2' },
          { id: 3, name: 'Item 3', children: [{ id: 4, name: 'Item 4' }] },
        ],
      },
    ];

    it('should find item at root level', async () => {
      const result = await findItemById(mockData, 1);
      expect(result?.name).toBe('Item 1');
    });

    it('should find nested item', async () => {
      const result = await findItemById(mockData, 4);
      expect(result?.name).toBe('Item 4');
    });

    it('should return null when item not found', async () => {
      const result = await findItemById(mockData, 999);
      expect(result).toBeNull();
    });

    it('should handle empty array', async () => {
      const result = await findItemById([], 1);
      expect(result).toBeNull();
    });

    it('should handle null/undefined collection key', async () => {
      const dataWithNull = [{ id: 1, name: 'Item', children: null }];
      const result = await findItemById(dataWithNull, 1);
      expect(result?.name).toBe('Item');
    });
  });

  describe('setNodeIdentifier', () => {
    it('should set identifier for context', () => {
      const node = { data: { context: [{}, {}] } };
      const result = setNodeIdentifier(node, 'context');

      expect(result).toBe('C2');
    });

    it('should set identifier for evidence', () => {
      const node = { data: { evidence: [] } };
      const result = setNodeIdentifier(node, 'evidence');

      expect(result).toBe('E0');
    });

    it('should set identifier for strategy', () => {
      const node = { data: { strategies: [{}, {}, {}, {}, {}] } };
      const result = setNodeIdentifier(node, 'strategy');

      expect(result).toBe('S5');
    });
  });

  describe('extractGoalsClaimsStrategies', () => {
    // Removed unused variable

    it('should extract goals, claims and strategies', () => {
      const data = [
        { type: 'TopLevelNormativeGoal', id: 1, name: 'Goal 1' },
        { type: 'PropertyClaim', id: 2, name: 'Claim 1' },
        { type: 'Strategy', id: 3, name: 'Strategy 1' },
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
      const data = [
        {
          type: 'TopLevelNormativeGoal',
          id: 1,
          property_claims: [{ type: 'PropertyClaim', id: 2 }],
          strategies: [{ type: 'Strategy', id: 3 }],
        },
      ];
      const result = extractGoalsClaimsStrategies(data);

      expect(result.goal).toMatchObject({ id: 1 });
      expect(result.claims).toHaveLength(1);
      expect(result.strategies).toHaveLength(2);
    });
  });

  describe('addHiddenProp', () => {
    it('should add hidden property to single object', async () => {
      const obj = { id: 1, name: 'Test' };
      const result = await addHiddenProp(obj);

      expect(result.hidden).toBe(false);
      expect(result.id).toBe(1);
      expect(result.name).toBe('Test');
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

      const result = await addHiddenProp(obj);

      expect(result.hidden).toBe(false);
      expect(result.children[0].hidden).toBe(false);
      expect(result.children[1].hidden).toBe(false);
      expect(result.children[1].nested.hidden).toBe(false);
    });

    it('should handle arrays directly', async () => {
      const arr = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];

      const result = await addHiddenProp(arr);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].hidden).toBe(false);
      expect(result[1].hidden).toBe(false);
    });

    it('should handle null and undefined inputs', async () => {
      expect(await addHiddenProp(null)).toBeNull();
      expect(await addHiddenProp(undefined)).toBeUndefined();
    });

    it('should handle primitive values', async () => {
      expect(await addHiddenProp('string')).toBe('string');
      expect(addHiddenProp(123)).toBe(123);
      expect(addHiddenProp(true)).toBe(true);
    });
  });

  describe('API functions', () => {
    const mockToken = 'test-token';

    beforeEach(() => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      } as any);
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
        vi.mocked(fetch).mockResolvedValue({
          ok: false,
          status: 400,
        } as any);

        const result = await createAssuranceCaseNode('cases/1', {}, mockToken);
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

        await updateAssuranceCase('goal', {}, caseData, 123, {});

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

      expect(() => listPropertyClaims(malformedData as any, '1')).not.toThrow();
      expect(
        async () => await findItemById(malformedData as any, 1)
      ).not.toThrow();
    });

    it('should handle circular references without infinite loops', () => {
      const circularData: any = { id: 1, name: 'Test' };
      circularData.children = [circularData];

      // Should not hang or crash
      expect(async () => await findItemById([circularData], 1)).not.toThrow();
    });

    it('should handle very large datasets efficiently', async () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        property_claims: [],
      }));

      const start = performance.now();
      const result = await findItemById(largeData, 999);
      const end = performance.now();

      expect(result?.id).toBe(999);
      expect(end - start).toBeLessThan(100); // Should complete in reasonable time
    });
  });
});
