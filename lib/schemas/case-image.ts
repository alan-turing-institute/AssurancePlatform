import { z } from "zod";

/**
 * `POST /api/cases/[id]/image` body — a base64 PNG of the case canvas.
 * Uploaded both from the editor UI and from the unload-time auto-screenshot
 * beacon (`hooks/use-auto-screenshot.ts`, sent via `navigator.sendBeacon`
 * with a `text/plain` content type — the size guard on this route
 * (`JSON_BODY_LIMITS.caseImage`) does not inspect `Content-Type`, so both
 * paths are covered the same way).
 */
export const caseImageUploadSchema = z.strictObject({
	image: z.string().min(1),
});

export type CaseImageUploadInput = z.input<typeof caseImageUploadSchema>;
export type CaseImageUploadOutput = z.output<typeof caseImageUploadSchema>;
