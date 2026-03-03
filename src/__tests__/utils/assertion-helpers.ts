import { expect } from "vitest";

/**
 * Asserts that a ServiceResult is successful (has `data`, no `error`),
 * and returns the unwrapped data for further assertions.
 *
 * Two overloads are provided:
 * - Void-result services (e.g. delete, reset) return `{ data: null }` on success.
 *   Call `expectSuccess(result)` without using the return value.
 * - Data-returning services return `{ data: T }` on success.
 *   The unwrapped, non-nullable value is returned for further assertions.
 *
 * NOTE: biome-ignore on expect() calls is required because these helpers
 * are called FROM WITHIN it()/test() blocks — Biome can't see that statically.
 *
 * @example
 * // Void-result (delete):
 * expectSuccess(await deleteCase(userId, caseId));
 *
 * @example
 * // Data-returning:
 * const data = expectSuccess(await getCase(userId, caseId));
 * expect(data.name).toBe("My Case");
 */
/** For services that return { data: null } on success (e.g., delete, reset). */
export function expectSuccess(result: { data?: null; error?: string }): void;
/** For services that return { data: T } on success. */
export function expectSuccess<T>(result: {
	data?: T;
	error?: string;
}): NonNullable<T>;
export function expectSuccess<T>(result: {
	data?: T;
	error?: string;
}): T | undefined {
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(result.error).toBeUndefined();
	if (result.data === null) {
		// void-result — success means no error
		return;
	}
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(result.data).toBeDefined();
	return result.data as NonNullable<T>;
}

/**
 * Asserts that two service results both failed and returned the same error.
 * Used for anti-enumeration tests — ensures not-found and no-access are
 * indistinguishable to the caller.
 *
 * @example
 * const notFoundResult = await service(userId, "00000000-...");
 * const noAccessResult = await service(otherUserId, existingId);
 * expectSameError(notFoundResult, noAccessResult);
 */
export function expectSameError(
	result1: { data?: unknown; error?: string },
	result2: { data?: unknown; error?: string }
): void {
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(result1.error).toBeDefined();
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(result2.error).toBeDefined();
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(result1.error).toBe(result2.error);
}

/**
 * Asserts that a ServiceResult is an error (has `error`, no `data`).
 * Optionally matches the error message against a string or regex.
 *
 * @example
 * expectError(await getCase(userId, "non-existent-id"));
 * expectError(await getCase(userId, "non-existent-id"), /not found/i);
 */
export function expectError(
	result: { data?: unknown; error?: string },
	expectedMessage?: string | RegExp
): void {
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(result.error).toBeDefined();
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(result.data).toBeUndefined();

	if (typeof expectedMessage === "string") {
		// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
		expect(result.error).toBe(expectedMessage);
	} else if (expectedMessage instanceof RegExp) {
		// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
		expect(result.error).toMatch(expectedMessage);
	}
}
