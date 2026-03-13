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

// Full status including 3-state workflow
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

export type MarkReadyResult =
	| { data: { markedReadyAt: Date } }
	| { error: string };

export type UnmarkReadyResult = { data: { success: true } } | { error: string };

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
