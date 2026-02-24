import { z } from "zod";

import { requiredString, uuidSchema } from "@/lib/schemas/base";

// ============================================
// Case-level comment (note)
// ============================================

export const createCommentSchema = z.object({
	content: requiredString("Content", 1, 5000),
	parentId: uuidSchema.optional().nullable(),
});

export type CreateCommentInput = z.input<typeof createCommentSchema>;

// ============================================
// Element-level comment (supports `comment` field for backward compat)
// ============================================

export const createElementCommentSchema = z
	.object({
		content: z.string().optional(),
		comment: z.string().optional(),
		parentId: uuidSchema.optional().nullable(),
	})
	.transform((val) => ({
		content: (val.content || val.comment || "").trim(),
		parentId: val.parentId ?? null,
	}))
	.pipe(
		z.object({
			content: z.string().min(1, "Comment content is required"),
			parentId: z.string().uuid().nullable(),
		})
	);

export type CreateElementCommentInput = z.input<
	typeof createElementCommentSchema
>;

// ============================================
// Update comment content
// ============================================

export const updateCommentSchema = z.object({
	content: requiredString("Content", 1, 5000),
});

export type UpdateCommentInput = z.input<typeof updateCommentSchema>;

// ============================================
// Resolve / unresolve a comment thread
// ============================================

export const resolveCommentSchema = z.object({
	resolved: z.boolean({ required_error: "resolved must be a boolean" }),
});

export type ResolveCommentInput = z.input<typeof resolveCommentSchema>;
