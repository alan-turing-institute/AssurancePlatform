/**
 * Reduces what a person typed in the "email or username" box to the value the
 * server looks up: leading and trailing whitespace removed, and `null` when
 * nothing is left or the value is not a string. Capitals are kept, because
 * usernames are matched exactly. Passwords never go through this function.
 */
export function normaliseSignInIdentifier(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}
