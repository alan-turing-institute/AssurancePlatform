import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes
 * Used by shadcn/ui components for dynamic class composition
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
