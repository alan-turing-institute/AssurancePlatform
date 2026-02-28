import { z } from "zod";

/**
 * Schema for batch update request body.
 * Extracted from cases/[id]/batch/route.ts for reuse.
 */
export const batchUpdateRequestSchema = z.object({
	changes: z.array(
		z.discriminatedUnion("type", [
			z.object({
				type: z.literal("create"),
				elementId: z.string().uuid(),
				parentId: z.string().uuid().nullable(),
				data: z.object({
					id: z.string().uuid(),
					type: z.string(),
					name: z.string().nullable(),
					description: z.string(),
					inSandbox: z.boolean(),
					role: z.string().nullable().optional(),
					assumption: z.string().nullable().optional(),
					justification: z.string().nullable().optional(),
					context: z.array(z.string()).optional(),
					url: z.string().nullable().optional(),
					level: z.number().nullable().optional(),
					moduleReferenceId: z.string().optional(),
					moduleEmbedType: z.string().optional(),
					modulePublicSummary: z.string().nullable().optional(),
					fromPattern: z.boolean().optional(),
					modifiedFromPattern: z.boolean().optional(),
					isDefeater: z.boolean().optional(),
					defeatsElementId: z.string().optional(),
				}),
			}),
			z.object({
				type: z.literal("update"),
				elementId: z.string().uuid(),
				data: z.object({
					name: z.string().nullable().optional(),
					description: z.string().optional(),
					inSandbox: z.boolean().optional(),
					parentId: z.string().uuid().nullable().optional(),
					role: z.string().nullable().optional(),
					assumption: z.string().nullable().optional(),
					justification: z.string().nullable().optional(),
					context: z.array(z.string()).optional(),
					url: z.string().nullable().optional(),
					level: z.number().nullable().optional(),
					moduleReferenceId: z.string().optional(),
					moduleEmbedType: z.string().optional(),
					modulePublicSummary: z.string().nullable().optional(),
					fromPattern: z.boolean().optional(),
					modifiedFromPattern: z.boolean().optional(),
					isDefeater: z.boolean().optional(),
					defeatsElementId: z.string().optional(),
				}),
			}),
			z.object({
				type: z.literal("delete"),
				elementId: z.string().uuid(),
			}),
			z.object({
				type: z.literal("link_evidence"),
				evidenceId: z.string().uuid(),
				claimId: z.string().uuid(),
			}),
			z.object({
				type: z.literal("unlink_evidence"),
				evidenceId: z.string().uuid(),
				claimId: z.string().uuid(),
			}),
		])
	),
	expectedVersion: z.string().datetime().optional(),
});

export type BatchUpdateRequestSchemaInput = z.input<
	typeof batchUpdateRequestSchema
>;
export type BatchUpdateRequestSchemaOutput = z.output<
	typeof batchUpdateRequestSchema
>;
