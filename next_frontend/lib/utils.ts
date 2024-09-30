import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

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
  return twMerge(clsx(inputs))
}
