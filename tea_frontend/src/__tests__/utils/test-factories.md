# Test Factories Documentation

This document describes the advanced factory functions available for creating complex test data structures in the TEA Platform frontend tests.

## Overview

The test factories provide a comprehensive set of tools for generating realistic, interconnected test data. They are designed to:

- Create consistent, predictable test data
- Support complex relationships between entities
- Enable quick creation of test scenarios
- Provide type-safe factory methods

## Available Factories

### UserFactory

Creates user objects with authentication details.

```typescript
// Create a single user
const user = UserFactory.create({ username: 'testuser' });

// Create multiple users
const users = UserFactory.createBatch(5);

// Create a user with a specific role
const admin = UserFactory.createWithRole('Admin');
```

### TeamFactory

Creates teams with member relationships.

```typescript
// Create a basic team
const team = TeamFactory.create({ name: 'Engineering' });

// Create a team with members
const { team, members, users } = TeamFactory.createWithMembers(5);
```

### AssuranceCaseFactory

Creates assurance cases with various configurations.

```typescript
// Create a basic assurance case
const assuranceCase = AssuranceCaseFactory.create();

// Create with full structure (goals, strategies, claims, evidence, contexts)
const { assuranceCase, goals, strategies, propertyClaims, evidence, contexts } = 
  AssuranceCaseFactory.createWithFullStructure();

// Create a published case
const publishedCase = AssuranceCaseFactory.createPublished();

// Create with permissions
const { assuranceCase, permissions, users, teams } = 
  AssuranceCaseFactory.createWithPermissions([
    { userId: 1, type: 'edit' },
    { teamId: 1, type: 'view' }
  ]);
```

### Element Factories

Create individual case elements:

```typescript
// Goals
const goal = GoalFactory.create({ name: 'Safety Goal' });
const goalHierarchy = GoalFactory.createHierarchy(3, 2); // depth 3, breadth 2

// Strategies
const strategy = StrategyFactory.create({ goal_id: goal.id });

// Property Claims
const claim = PropertyClaimFactory.create({ goal_id: goal.id });
const nestedClaims = PropertyClaimFactory.createNested(3); // 3 levels deep

// Evidence
const evidence = EvidenceFactory.create({ name: 'Test Report' });
const evidenceForClaim = EvidenceFactory.createForClaim(claim.id, 3);

// Contexts
const context = ContextFactory.create({ goal_id: goal.id });

// Comments
const comment = CommentFactory.create({ content: 'Great work!' });
const commentThread = CommentFactory.createThread(5);
```

### CaseStudyFactory

Creates case studies with associated assurance cases.

```typescript
// Basic case study
const caseStudy = CaseStudyFactory.create({ title: 'AI Safety' });

// Published case study with cases
const { caseStudy, assuranceCases } = 
  CaseStudyFactory.createPublishedWithCases(3);
```

### TemplateFactory

Creates case templates for quick case creation.

```typescript
// Basic template
const template = TemplateFactory.create({ name: 'Quick Start' });

// Pre-configured safety template
const safetyTemplate = TemplateFactory.createSafetyTemplate();
```

### BatchFactory

Creates complete test scenarios.

```typescript
// Complete scenario with users, teams, cases, and permissions
const scenario = BatchFactory.createCompleteScenario();

// Feature-specific test data
const collaborationData = BatchFactory.createTestDataForFeature('collaboration');
const hierarchyData = BatchFactory.createTestDataForFeature('hierarchy');
const permissionsData = BatchFactory.createTestDataForFeature('permissions');
```

## Convenience Functions

Quick access functions for common operations:

```typescript
import {
  createUser,
  createTeam,
  createAssuranceCase,
  createGoal,
  createStrategy,
  createPropertyClaim,
  createEvidence,
  createContext,
  createComment,
  createCaseStudy,
} from './test-factories';

const user = createUser({ username: 'quick' });
const team = createTeam({ name: 'Quick Team' });
// ... etc
```

## ID Management

The factories use an internal ID counter to ensure unique IDs:

```typescript
import { resetIdCounter } from './test-factories';

// Reset ID counter between tests for consistency
beforeEach(() => {
  resetIdCounter();
});
```

## Usage in Tests

Example integration test using factories:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AssuranceCaseFactory, UserFactory, resetIdCounter } from './test-factories';

describe('AssuranceCase Integration', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it('should handle complex case structure', () => {
    // Create a complete case with all elements
    const { assuranceCase, goals, strategies, propertyClaims, evidence } = 
      AssuranceCaseFactory.createWithFullStructure();

    // Test relationships
    expect(assuranceCase.goals).toHaveLength(3);
    expect(goals[0].strategies).toContain(strategies[0]);
    expect(evidence[0].property_claim_id).toContain(propertyClaims[0].id);
  });

  it('should manage permissions correctly', () => {
    // Create users
    const owner = UserFactory.create();
    const editor = UserFactory.create();
    
    // Create case with permissions
    const { assuranceCase, permissions } = 
      AssuranceCaseFactory.createWithPermissions([
        { userId: owner.id, type: 'manage' },
        { userId: editor.id, type: 'edit' }
      ]);

    // Verify permissions
    const ownerPerm = permissions.find(p => p.user === owner.id);
    expect(ownerPerm?.permission_type).toBe('manage');
  });
});
```

## Best Practices

1. **Reset ID Counter**: Always reset the ID counter in `beforeEach` to ensure test isolation
2. **Use Overrides**: Pass partial objects to customize factory output
3. **Leverage Relationships**: Use the relationship methods to create connected data
4. **Type Safety**: All factories are fully typed - leverage TypeScript for autocomplete
5. **Batch Creation**: Use batch methods for performance when creating multiple items

## Extending the Factories

To add new factory methods:

1. Add the method to the appropriate factory class
2. Ensure proper typing
3. Follow the existing patterns for consistency
4. Add tests for the new method
5. Update this documentation
