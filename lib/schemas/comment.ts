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
export type CreateCommentOutput = z.output<typeof createCommentSchema>;

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
export type CreateElementCommentOutput = z.output<
	typeof createElementCommentSchema
>;

// ============================================
// Update comment content
// ============================================

export const updateCommentSchema = z.object({
	content: requiredString("Content", 1, 5000),
});

export type UpdateCommentInput = z.input<typeof updateCommentSchema>;
export type UpdateCommentOutput = z.output<typeof updateCommentSchema>;

// ============================================
// Resolve / unresolve a comment thread
// ============================================

export const resolveCommentSchema = z.object({
	resolved: z.boolean({ error: "resolved must be a boolean" }),
});

export type ResolveCommentInput = z.input<typeof resolveCommentSchema>;
export type ResolveCommentOutput = z.output<typeof resolveCommentSchema>;

// ============================================
// Form schemas (used by UI components)
// ============================================

/**
 * Comment form schema — for create and edit forms.
 * Field name is `comment` to match existing component field names.
 */
export const commentFormSchema = z.object({
	comment: z
		.string()
		.min(2, "Comment must be at least 2 characters")
		.max(500, "Comment must be less than 500 characters"),
});

export type CommentFormInput = z.input<typeof commentFormSchema>;
export type CommentFormOutput = z.output<typeof commentFormSchema>;

/**
 * Note form schema — for case-level note create form.
 * Field name is `note` to match existing component field names.
 */
export const noteFormSchema = z.object({
	note: z
		.string()
		.min(2, "Note must be at least 2 characters")
		.max(500, "Note must be less than 500 characters"),
});

export type NoteFormInput = z.input<typeof noteFormSchema>;
export type NoteFormOutput = z.output<typeof noteFormSchema>;
