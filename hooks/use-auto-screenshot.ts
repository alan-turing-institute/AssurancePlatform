import { toPng } from "html-to-image";
import { useCallback, useEffect, useRef } from "react";
import {
	isAuthoredContent,
	stripPluginAppearance,
} from "@/lib/case/plugin-display-capture";
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

/**
 * The attribute on a card's line that names a cited case. People other than
 * the editor see the dashboard thumbnail, and not all of them can view the
 * cited case, so the thumbnail leaves the line out. An editor's own image
 * exports keep it: they show only what that editor can already see.
 */
const LEFT_OUT_OF_SHARED_THUMBNAIL_ATTRIBUTE =
	"data-left-out-of-shared-thumbnail";

/** The thumbnail's capture filter: the authored case, without what is left out of the shared thumbnail. */
function isSharedThumbnailContent(domNode: HTMLElement): boolean {
	return (
		isAuthoredContent(domNode) &&
		!(
			domNode instanceof Element &&
			domNode.hasAttribute(LEFT_OUT_OF_SHARED_THUMBNAIL_ATTRIBUTE)
		)
	);
}

/**
 * Takes the picture of the canvas as the authored case: without the tints,
 * edge colours, badges and dots that plugins draw on it, and without the names
 * of cited cases. The picture becomes the case's thumbnail, which people who
 * have the plugin off, and people who cannot view a cited case, also see.
 */
function captureAuthoredCase(target: HTMLElement): Promise<string> {
	const restoreAppearance = stripPluginAppearance(target);
	return toPng(target, {
		backgroundColor: "#ffffff",
		filter: isSharedThumbnailContent,
		pixelRatio: 1,
	}).finally(restoreAppearance);
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
			const base64Image = await captureAuthoredCase(target as HTMLElement);

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
					captureAuthoredCase(target as HTMLElement)
						.then((base64Image) => {
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
