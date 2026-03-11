# Test Suite

## Test Types

| Type | Directory | Runner | When to Use |
|------|-----------|--------|-------------|
| Unit | `lib/__tests__/`, `components/**/__tests__/` | Vitest (jsdom) | Pure functions, component rendering, isolated logic |
| Integration | `src/__tests__/integration/` | Vitest (node) | Service layer, API routes, server actions — uses real PostgreSQL |
| E2E | `e2e/` | Playwright | Critical user journeys — auth, case management, sharing, publishing |

## Test Data

### `prisma-factories.ts` (integration tests)

Real database factories for integration tests. Each factory creates a record in the test PostgreSQL database using Prisma.

```ts
import { createTestUser, createTestCase, createTestElement } from "../utils/prisma-factories";

const user = await createTestUser();
const testCase = await createTestCase(user.id, { name: "My Case" });
```

Also provides composite helpers:
- `createTestCaseWithGoal()` — case with a top-level GOAL (required for publishing)
- `createTestTeamWithAdmin()` — team with an ADMIN member
- `getTestPasswordResetToken()` — queries the reset token after requesting a password reset
- `createNestedCaseJSON()` / `createNestedCaseWithChainJSON()` — plain JSON objects for import testing

### `mock-data.ts` (unit tests)

In-memory fixtures for unit tests that don't touch the database. Used with component tests and pure function tests where you need realistic data shapes without DB overhead.

**These are NOT duplicates** — factories create real DB records for integration tests, mock-data provides static fixtures for unit tests.

## Patterns

### ServiceResult Assertion Helpers

Use `expectSuccess()` and `expectError()` from `src/__tests__/utils/assertion-helpers.ts` to reduce boilerplate in integration tests:

```ts
import { expectSuccess, expectError } from "../utils/assertion-helpers";

// Instead of:
const result = await getCase(userId, caseId);
expect(result.error).toBeUndefined();
expect(result.data).toBeDefined();
const data = result.data!;

// Use:
const data = expectSuccess(await getCase(userId, caseId));
```

### Anti-Enumeration Testing

Every service that takes a resource ID should verify the same error is returned for "not found" and "no access":

```ts
it("returns same error for not-found and no-access (anti-enumeration)", async () => {
  const notFoundResult = await service(userId, "00000000-0000-0000-0000-000000000000");
  const noAccessResult = await service(otherUserId, existingResourceId);
  expect(notFoundResult.error).toBe(noAccessResult.error);
});
```

This prevents attackers from discovering which resources exist by comparing error responses.

### SSE Mock Rationale

Some integration tests mock `@/lib/sse-connection-manager`. This is intentional:

> SSE broadcasts are fire-and-forget in-process operations with no external I/O.
> Mock to prevent test blocking on real SSE setup — not to avoid real DB testing.

Only external I/O boundaries (SSE, email) are mocked. All database operations use the real PostgreSQL test database.

## Setup Files

Unit test setup is decomposed into focused modules under `src/__tests__/setup/`:

| Module | Concern |
|--------|---------|
| `jest-dom.ts` | Testing Library matchers and cleanup |
| `msw.ts` | Mock Service Worker lifecycle |
| `framework-mocks.tsx` | Next.js, next-auth, next-themes, toast, modal hooks |
| `dom-polyfills.ts` | Browser API polyfills missing from jsdom |
| `component-mocks.tsx` | ReactFlow and Radix UI component mocks |
| `index.ts` | Barrel that imports all modules (vitest setupFiles entry) |

## Further Reading

- [Testing Skill](/.claude/skills/testing/SKILL.md) — full testing philosophy and patterns
