import type { PublishStatus as PrismaPublishStatus } from "@/src/generated/prisma";

// Re-export Prisma enum for convenience
export type { PublishStatus as PrismaPublishStatus } from "@/src/generated/prisma";

// Legacy type kept for backward compatibility
export type PublishStatus = {
	isPublished: boolean;
	publishedId: string | null;
	publishedAt: Date | null;
	linkedCaseStudyCount: number;
};

// Full status including 3-state workflow
export type FullPublishStatus = {
	publishStatus: PrismaPublishStatus;
	isPublished: boolean;
	publishedId: string | null;
	publishedAt: Date | null;
	markedReadyAt: Date | null;
	linkedCaseStudyCount: number;
	hasChanges: boolean;
};

export type PublishResult =
	| { data: { publishedId: string; publishedAt: Date } }
	| { error: string };

export type UnpublishResult =
	| { data: { success: true } }
	| { error: string; linkedCaseStudies?: { id: number; title: string }[] };

export type MarkReadyResult =
	| { data: { markedReadyAt: Date } }
	| { error: string };

export type UnmarkReadyResult =
	| { data: { success: true } }
	| { error: string };

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
