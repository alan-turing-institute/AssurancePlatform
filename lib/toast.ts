/**
 * Toast notification utilities for the TEA Platform.
 * Uses Sonner for consistent, modern toast notifications.
 */

import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive" | "success";

interface ToastOptions {
	description?: string;
	title?: string;
	variant?: ToastVariant;
}

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

export { toast };

export function toastError(message: string, description?: string) {
	sonnerToast.error(message, { description });
}

export function toastSuccess(message: string, description?: string) {
	sonnerToast.success(message, { description });
}

export function toastInfo(message: string, options?: { duration?: number }) {
	sonnerToast.info(message, options);
}
