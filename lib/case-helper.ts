/**
 * @deprecated This file is deprecated. Import from '@/lib/case' instead.
 *
 * This file now re-exports all functions from the modular '@/lib/case' directory.
 * All new code should import directly from '@/lib/case'.
 *
 * The monolithic case-helper.ts has been split into:
 * - lib/case/types.ts - Type definitions
 * - lib/case/api.ts - API operations
 * - lib/case/case-updates.ts - Case update operations
 * - lib/case/evidence.ts - Evidence operations
 * - lib/case/node-utils.ts - Node utilities
 * - lib/case/property-claims.ts - Property claims operations
 * - lib/case/tree-utils.ts - Tree traversal utilities
 * - lib/case/index.ts - Barrel file re-exports
 */

// Re-export everything from the new modular structure
// biome-ignore lint/performance/noBarrelFile: Deprecated file - maintains backward compatibility
export * from "./case";
