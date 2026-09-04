/**
 * Canonical element type conversions.
 *
 * Single source of truth for mapping between the four representations:
 *   - Prisma UPPERCASE: "GOAL", "STRATEGY", "PROPERTY_CLAIM", "EVIDENCE"
 *   - Display lowercase: "goal", "strategy", "property_claim", "evidence"
 *   - React Flow camelCase: "goal", "strategy", "propertyClaim", "evidence"
 *   - Collection plural: "goals", "strategies", "propertyclaims", "evidence"
 */

import { getCorePrefix } from "@/lib/element-names/prefix-registry";
import type { ElementType as PrismaElementType } from "@/src/generated/prisma";

// Re-export from element-validation for backward compatibility
export {
	ELEMENT_TYPES,
	type ElementType,
} from "@/lib/schemas/element-validation";

/**
 * Normalise any format to Prisma UPPERCASE.
 *
 * Accepts: "goal", "Goal", "TopLevelNormativeGoal", "GOAL",
 *          "property_claim", "PropertyClaim", "propertyclaim", "property", etc.
 */
export function toPrismaType(input: string): PrismaElementType {
	const normalised = input.toLowerCase().replace(/\s+/g, "_");

	const map: Record<string, PrismaElementType> = {
		goal: "GOAL",
		toplevelgoal: "GOAL",
		toplevelgoalnormative: "GOAL",
		toplevel_normative_goal: "GOAL",
		toplevel_goal: "GOAL",
		strategy: "STRATEGY",
		property: "PROPERTY_CLAIM",
		property_claim: "PROPERTY_CLAIM",
		propertyclaim: "PROPERTY_CLAIM",
		evidence: "EVIDENCE",
		context: "CONTEXT",
		justification: "JUSTIFICATION",
		assumption: "ASSUMPTION",
		module: "MODULE",
		away_goal: "AWAY_GOAL",
		awaygoal: "AWAY_GOAL",
		contract: "CONTRACT",
	};

	return map[normalised] ?? (input.toUpperCase() as PrismaElementType);
}

/**
 * Prisma UPPERCASE → lowercase for API responses.
 *
 * "GOAL" → "goal", "PROPERTY_CLAIM" → "property_claim", etc.
 */
export function toDisplayType(prismaType: string): string {
	return prismaType.toLowerCase();
}

/**
 * Prisma UPPERCASE → prefix for auto-generated names.
 *
 * "GOAL" → "G", "STRATEGY" → "S", "PROPERTY_CLAIM" → "P", "EVIDENCE" → "E",
 * and so on for all ten element types — reads from the single-source
 * prefix table (`lib/element-names/prefix-registry.ts`) rather than keeping
 * its own copy. Throws for a type that table doesn't know, rather than the
 * old silent "X" fallback: every value of the Prisma `ElementType` enum has
 * a registered prefix, so reaching this branch means a genuinely unknown
 * type reached element-naming code, which is a bug worth surfacing.
 */
export function toPrefix(prismaType: string): string {
	const prefix = getCorePrefix(prismaType);
	if (!prefix) {
		throw new Error(
			`toPrefix: no prefix registered for element type '${prismaType}'`
		);
	}
	return prefix;
}

/**
 * Lowercase display type → camelCase React Flow node type.
 *
 * "property_claim" → "propertyClaim", others pass through unchanged.
 */
export function toReactFlowType(type: string): string {
	const lower = type.toLowerCase();

	const map: Record<string, string> = {
		goal: "goal",
		strategy: "strategy",
		property_claim: "propertyClaim",
		evidence: "evidence",
		context: "context",
		// Also handle UPPERCASE input
		GOAL: "goal",
		STRATEGY: "strategy",
		PROPERTY_CLAIM: "propertyClaim",
		EVIDENCE: "evidence",
		CONTEXT: "context",
	};

	return map[type] ?? map[lower] ?? lower;
}

/**
 * Collection plural name → lowercase singular type.
 *
 * "goals" → "goal", "propertyclaims" → "property_claim", etc.
 */
export function fromCollectionName(plural: string): string {
	const map: Record<string, string> = {
		goals: "goal",
		contexts: "context",
		strategies: "strategy",
		propertyclaims: "property_claim",
		evidence: "evidence",
	};
	return map[plural] ?? plural;
}
