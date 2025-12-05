import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to conditionally merge Tailwind CSS classes.
 *
 * This function combines the utility of `clsx` for conditional class merging with `tailwind-merge` to resolve conflicts
 * in Tailwind CSS classes. It accepts a variable number of arguments, which can be strings, objects, or arrays, and
 * returns a single string of merged classes with conflicting Tailwind classes resolved.
 *
 * @param {...ClassValue[]} inputs - A variable number of class values that can be strings, arrays, or objects.
 * Objects can have boolean values that conditionally include/exclude classes.
 * @returns {string} A string of merged and resolved Tailwind CSS classes.
 *
 * @example
 * cn('p-4', 'text-center', { 'bg-red-500': true, 'bg-blue-500': false })
 * // Returns: 'p-4 text-center bg-red-500'
 *
 * @example
 * cn('p-4', 'text-center', 'p-2')
 * // Returns: 'p-2 text-center' (tailwind-merge resolves 'p-4' vs 'p-2')
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Normalizes image URLs.
 *
 * @deprecated Images are now served through Next.js internal routes.
 * This function is kept for backward compatibility but simply returns the URL unchanged.
 *
 * @param {string | null | undefined} url - The URL to normalize
 * @returns {string | null | undefined} The URL unchanged
 */
export function normalizeImageUrl(
	url: string | null | undefined
): string | null | undefined {
	return url;
}

/**
 * Serialises an object, converting BigInt values to strings.
 *
 * Prisma returns BigInt for certain database fields (e.g., auto-increment IDs).
 * JSON.stringify() throws on BigInt values, so this utility converts them to strings.
 *
 * @param obj - The object to serialise
 * @returns The serialised object with BigInt values converted to strings
 *
 * @example
 * const data = { id: 123n, name: 'Test' };
 * serialiseBigInt(data);
 * // Returns: { id: '123', name: 'Test' }
 */
export function serialiseBigInt<T>(obj: T): T {
	return JSON.parse(
		JSON.stringify(obj, (_key, value) =>
			typeof value === "bigint" ? value.toString() : value
		)
	) as T;
}
