/**
 * Date formatting utilities for the TEA Platform.
 * Uses date-fns for consistent, locale-aware date formatting.
 */

import { format, parseISO } from "date-fns";

/**
 * Formats a date in DD/MM/YYYY format (British date format).
 *
 * @param date - Date object, ISO string, timestamp, or undefined/null
 * @param fallback - Optional fallback string if date is undefined/null (defaults to "N/A")
 * @returns Formatted date string (e.g., "18/12/2024") or fallback
 *
 * @example
 * formatShortDate(new Date()) // "18/12/2024"
 * formatShortDate("2024-12-18T10:30:00Z") // "18/12/2024"
 * formatShortDate(undefined) // "N/A"
 */
export function formatShortDate(
	date: Date | string | number | undefined | null,
	fallback = "N/A"
): string {
	if (date === undefined || date === null) {
		return fallback;
	}
	const dateObj = typeof date === "string" ? parseISO(date) : new Date(date);
	return format(dateObj, "dd/MM/yyyy");
}

/**
 * Formats a date in full human-readable format.
 *
 * @param date - Date object, ISO string, timestamp, or undefined/null
 * @param fallback - Optional fallback string if date is undefined/null (defaults to "N/A")
 * @returns Formatted date string (e.g., "Wednesday, 18 December 2024 at 2:30 pm") or fallback
 *
 * @example
 * formatFullDate(new Date()) // "Wednesday, 18 December 2024 at 2:30 pm"
 * formatFullDate(undefined) // "N/A"
 */
export function formatFullDate(
	date: Date | string | number | undefined | null,
	fallback = "N/A"
): string {
	if (date === undefined || date === null) {
		return fallback;
	}
	const dateObj = typeof date === "string" ? parseISO(date) : new Date(date);
	return format(dateObj, "EEEE, d MMMM yyyy 'at' h:mm a");
}
