import type { PatternSource } from "@/lib/schemas/case-from-pattern";
import { createCaseFromPattern } from "@/lib/services/case-from-pattern-service";
import { mockAuth } from "./auth-helpers";
import type { createTestUser } from "./prisma-factories";

/**
 * The two ways of starting a case from a pattern, the service and the server
 * action, behind one shape so a test can hold both to the same answers. A
 * test file that uses them must mock `@/lib/auth/validate-session`, as the
 * action reads the signed-in user from it.
 */

type User = Awaited<ReturnType<typeof createTestUser>>;

/** A source as a client could send it, so not always a well-formed one. */
export type Source = Record<string, unknown>;

export type Outcome =
	| { ok: true; id: string; warnings: string[] }
	| { error: string; ok: false };

export interface Starter {
	label: string;
	start: (
		user: User,
		source: Source,
		name?: string,
		description?: string,
		variableValues?: Record<string, string>
	) => Promise<Outcome>;
}

export const NAME = "Case from a pattern";
export const DESCRIPTION = "Started from a pattern";

export const viaService: Starter = {
	label: "the service",
	start: async (user, source, name, description, variableValues) => {
		const result = await createCaseFromPattern(
			user.id,
			source as unknown as PatternSource,
			name === undefined ? NAME : name,
			description === undefined ? DESCRIPTION : description,
			variableValues
		);
		return "data" in result
			? { ok: true, id: result.data.id, warnings: result.data.warnings }
			: { ok: false, error: result.error };
	},
};

export const viaAction: Starter = {
	label: "the action",
	start: async (user, source, name, description, variableValues) => {
		await mockAuth(user.id, user.username, user.email ?? undefined);
		const { createCaseFromPattern: startFromAction } = await import(
			"@/actions/case-from-pattern"
		);
		const result = await startFromAction(
			source as unknown as PatternSource,
			name === undefined ? NAME : name,
			description === undefined ? DESCRIPTION : description,
			variableValues
		);
		return result.success
			? { ok: true, id: result.data.id, warnings: result.data.warnings }
			: { ok: false, error: result.error };
	},
};

export const STARTERS: [string, Starter][] = [
	[viaService.label, viaService],
	[viaAction.label, viaAction],
];

/** Starts and fails the test unless the start succeeded. */
export async function startOk(
	starter: Starter,
	user: User,
	source: Source,
	name?: string,
	description?: string
) {
	const outcome = await starter.start(user, source, name, description);
	if (!outcome.ok) {
		throw new Error(`start refused: ${outcome.error}`);
	}
	return outcome;
}
