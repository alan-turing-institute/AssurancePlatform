import type { PublishStatus as PrismaPublishStatus } from "@/src/generated/prisma";

// Re-export Prisma enum for convenience
export type { PublishStatus as PrismaPublishStatus } from "@/src/generated/prisma";

// Legacy type kept for backward compatibility
export interface PublishStatus {
	isPublished: boolean;
	linkedCaseStudyCount: number;
	publishedAt: Date | null;
	publishedId: string | null;
}

// Full status (DRAFT / PUBLISHED — the "Ready to Publish" intermediate step
// was retired, ADR 0003 §2)
export interface FullPublishStatus {
	hasChanges: boolean;
	isPublished: boolean;
	linkedCaseStudyCount: number;
	markedReadyAt: Date | null;
	publishedAt: Date | null;
	publishedId: string | null;
	publishStatus: PrismaPublishStatus;
}

export type PublishResult =
	| { data: { publishedId: string; publishedAt: Date } }
	| { error: string };

export type UnpublishResult =
	| { data: { success: true } }
	| { error: string; linkedCaseStudies?: { id: number; title: string }[] };

// MarkReadyResult / UnmarkReadyResult retired alongside READY_TO_PUBLISH
// (ADR 0003 §2/§4) — the "Ready to Publish" intermediate step no longer
// exists, so there is nothing left to mark or unmark.

export type StatusTransitionResult =
	| {
			data: {
				newStatus: PrismaPublishStatus;
				publishedId?: string;
				publishedAt?: Date;
			};
	  }
	| {
			error: string;
			linkedCaseStudies?: { id: number; title: string }[];
	  };
