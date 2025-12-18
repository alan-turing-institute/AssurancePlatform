/**
 * Toast notification utilities for the TEA Platform.
 * Uses Sonner for consistent, modern toast notifications.
 *
 * This module provides a useToast hook that maintains API compatibility
 * with the previous Radix-based toast implementation while using Sonner
 * under the hood.
 */

import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive" | "success";

type ToastOptions = {
	variant?: ToastVariant;
	title?: string;
	description?: string;
};

/**
 * Display a toast notification.
 *
 * @param options - Toast configuration
 * @param options.variant - Visual style: "default", "destructive", or "success"
 * @param options.title - Main toast message
 * @param options.description - Additional details
 *
 * @example
 * toast({ title: "Success", description: "Action completed" })
 * toast({ variant: "destructive", title: "Error", description: "Something went wrong" })
 */
function toast(options: ToastOptions) {
	const { variant = "default", title, description } = options;

	const message = title || description || "";
	const details = title && description ? description : undefined;

	switch (variant) {
		case "destructive":
			sonnerToast.error(message, { description: details });
			break;
		case "success":
			sonnerToast.success(message, { description: details });
			break;
		default:
			sonnerToast(message, { description: details });
	}
}

/**
 * Hook providing toast functionality.
 * Maintains API compatibility with the previous useToast implementation.
 *
 * @returns Object containing toast function
 *
 * @example
 * const { toast } = useToast();
 * toast({ variant: "destructive", title: "Error", description: "Failed to save" });
 */
function useToast() {
	return { toast };
}

export { useToast, toast };
