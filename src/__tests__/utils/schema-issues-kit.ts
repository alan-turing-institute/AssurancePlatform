import type { z } from "zod";

/**
 * Every problem the schema reports for the input, as "path: message"
 * (the path is empty for a problem with the whole object). Empty when the
 * input passes.
 */
export function issuesOf(schema: z.ZodType, input: unknown): string[] {
	const result = schema.safeParse(input);
	return result.success
		? []
		: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

/** The parsed value, or undefined when the input does not pass. */
export function outputOf(schema: z.ZodType, input: unknown): unknown {
	const result = schema.safeParse(input);
	return result.success ? result.data : undefined;
}

/** An email address of exactly `length` characters (at least 200). */
export function emailOfLength(length: number): string {
	const lastLabel = length - 65 - 128;
	return `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(lastLabel)}`;
}
