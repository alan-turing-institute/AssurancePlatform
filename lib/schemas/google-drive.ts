import { z } from "zod";

/**
 * Schema for backing up a case to Google Drive.
 */
export const backupToDriveSchema = z.object({
	caseId: z.string().uuid("Invalid case ID"),
	includeComments: z.boolean().optional().default(true),
});

export type BackupToDriveInput = z.input<typeof backupToDriveSchema>;

/**
 * Schema for importing a case from Google Drive.
 */
export const importFromDriveSchema = z.object({
	fileId: z.string().min(1, "File ID is required"),
});

export type ImportFromDriveInput = z.input<typeof importFromDriveSchema>;
