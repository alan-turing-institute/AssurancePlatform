import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

type CommentResponse = {
	id: string;
	author: string;
	content: string;
	created_at: string;
};

/**
 * GET /api/elements/[id]/comments
 * Gets all comments for an element
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: elementId } = await params;

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { prismaNew } = await import("@/lib/prisma-new");
		const { canAccessCase } = await import("@/lib/permissions");

		try {
			// Get the element to find its case
			const element = await prismaNew.assuranceElement.findUnique({
				where: { id: elementId },
				select: { caseId: true },
			});

			if (!element) {
				return NextResponse.json(
					{ error: "Element not found" },
					{ status: 404 }
				);
			}

			// Check user has at least VIEW access to the case
			const hasAccess = await canAccessCase(
				{ userId: session.user.id, caseId: element.caseId },
				"VIEW"
			);

			if (!hasAccess) {
				return NextResponse.json(
					{ error: "Permission denied" },
					{ status: 403 }
				);
			}

			// Fetch comments for this element
			const comments = await prismaNew.comment.findMany({
				where: { elementId },
				include: {
					author: {
						select: { username: true },
					},
				},
				orderBy: { createdAt: "desc" },
			});

			// Transform to frontend format
			const response: CommentResponse[] = comments.map((comment) => ({
				id: comment.id,
				author: comment.author.username,
				content: comment.content,
				created_at: comment.createdAt.toISOString(),
			}));

			return NextResponse.json(response);
		} catch (error) {
			console.error("Error fetching comments:", error);
			return NextResponse.json(
				{ error: "Failed to fetch comments" },
				{ status: 500 }
			);
		}
	}

	// Django fallback - proxy to Django API
	const session = await getServerSession(authOptions);
	if (!session?.key) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Note: Django uses type-specific endpoints, which the frontend already calls directly
	// This endpoint is primarily for Prisma auth mode
	return NextResponse.json(
		{ error: "Use type-specific Django endpoints" },
		{ status: 501 }
	);
}

/**
 * POST /api/elements/[id]/comments
 * Creates a new comment on an element
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: elementId } = await params;

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { prismaNew } = await import("@/lib/prisma-new");
		const { canAccessCase } = await import("@/lib/permissions");

		try {
			const body = await request.json();
			const content = body.content || body.comment;

			if (!content || typeof content !== "string" || !content.trim()) {
				return NextResponse.json(
					{ error: "Comment content is required" },
					{ status: 400 }
				);
			}

			// Get the element to find its case
			const element = await prismaNew.assuranceElement.findUnique({
				where: { id: elementId },
				select: { caseId: true },
			});

			if (!element) {
				return NextResponse.json(
					{ error: "Element not found" },
					{ status: 404 }
				);
			}

			// Check user has at least COMMENT access to the case
			const hasAccess = await canAccessCase(
				{ userId: session.user.id, caseId: element.caseId },
				"COMMENT"
			);

			if (!hasAccess) {
				return NextResponse.json(
					{ error: "Permission denied" },
					{ status: 403 }
				);
			}

			// Create the comment
			const comment = await prismaNew.comment.create({
				data: {
					elementId,
					content: content.trim(),
					authorId: session.user.id,
				},
				include: {
					author: {
						select: { username: true },
					},
				},
			});

			const response: CommentResponse = {
				id: comment.id,
				author: comment.author.username,
				content: comment.content,
				created_at: comment.createdAt.toISOString(),
			};

			return NextResponse.json(response, { status: 201 });
		} catch (error) {
			console.error("Error creating comment:", error);
			return NextResponse.json(
				{ error: "Failed to create comment" },
				{ status: 500 }
			);
		}
	}

	// Django fallback
	return NextResponse.json(
		{ error: "Use type-specific Django endpoints" },
		{ status: 501 }
	);
}
