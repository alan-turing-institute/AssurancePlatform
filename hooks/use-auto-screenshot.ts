import html2canvas from "html2canvas";
import { useCallback, useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

const log = logger.child({ component: "use-auto-screenshot" });

/**
 * `canvas.toDataURL()` never returns a literal empty string — even a 0x0
 * canvas encodes to the placeholder `"data:,"` — so this is the guard
 * against ever writing a degenerate result as an `<img src>`, not evidence
 * that one has been observed in practice.
 */
function isUsableDataUrl(dataUrl: string): boolean {
	return (
		dataUrl.startsWith("data:image/") &&
		dataUrl.length > "data:image/png;base64,".length
	);
}

interface UseAutoScreenshotOptions {
	/** Whether the user has edit permission */
	canEdit: boolean;
	/** The case ID to save the screenshot for */
	caseId: string | number;
	/** Delay after last change before capturing (default: 5000ms) */
	debounceMs?: number;
	/** Selector for the element to capture (default: #ReactFlow) */
	selector?: string;
}

/**
 * Hook for automatically capturing screenshots of assurance cases.
 *
 * Captures a screenshot when:
 * 1. User has edit permission
 * 2. A change has been made (signalled by calling markChanged)
 * 3. Debounce period has elapsed since last change
 *
 * The API handles throttling (won't upload if recent screenshot exists).
 */
export function useAutoScreenshot({
	caseId,
	canEdit,
	selector = "#ReactFlow",
	debounceMs = 5000,
}: UseAutoScreenshotOptions) {
	const hasChangedRef = useRef(false);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isCapturingRef = useRef(false);

	const captureScreenshot = useCallback(async () => {
		if (isCapturingRef.current) {
			return;
		}

		const target = document.querySelector(selector);
		if (!target) {
			return;
		}

		isCapturingRef.current = true;

		try {
			const canvas = await html2canvas(target as HTMLElement);
			const base64Image = canvas.toDataURL("image/png");

			if (!isUsableDataUrl(base64Image)) {
				log.warn("Skipped upload of a degenerate screenshot capture", {
					caseId,
					dataUrlLength: base64Image.length,
				});
				return;
			}

			await fetch(`/api/cases/${caseId}/image`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ image: base64Image }),
			});
		} catch (error) {
			log.error("Screenshot capture failed", { caseId, error });
		} finally {
			isCapturingRef.current = false;
			hasChangedRef.current = false;
		}
	}, [caseId, selector]);

	const markChanged = useCallback(() => {
		if (!canEdit) {
			return;
		}

		hasChangedRef.current = true;

		// Clear existing timeout
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		// Set new timeout to capture after debounce period
		timeoutRef.current = setTimeout(() => {
			if (hasChangedRef.current) {
				captureScreenshot();
			}
		}, debounceMs);
	}, [canEdit, captureScreenshot, debounceMs]);

	// Capture on unmount if there are pending changes
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
			// Capture immediately if there are unsaved changes
			if (hasChangedRef.current && canEdit) {
				captureScreenshot();
			}
		};
	}, [canEdit, captureScreenshot]);

	// Capture on page unload/navigation
	useEffect(() => {
		const handleBeforeUnload = () => {
			if (hasChangedRef.current && canEdit) {
				// Use sendBeacon for reliable delivery during page unload
				const target = document.querySelector(selector);
				if (target) {
					html2canvas(target as HTMLElement)
						.then((canvas) => {
							const base64Image = canvas.toDataURL("image/png");
							if (!isUsableDataUrl(base64Image)) {
								log.warn(
									"Skipped beacon upload of a degenerate screenshot capture",
									{ caseId, dataUrlLength: base64Image.length }
								);
								return;
							}
							navigator.sendBeacon(
								`/api/cases/${caseId}/image`,
								JSON.stringify({ image: base64Image })
							);
						})
						.catch((error) => {
							log.error("Screenshot capture failed on unload", {
								caseId,
								error,
							});
						});
				}
			}
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [caseId, canEdit, selector]);

	return { markChanged, captureScreenshot };
}
