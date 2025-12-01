import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

type CommentResponse = {
	id: string;
	content: string;
	author: string;
	created_at: string;
};

/**
 * GET /api/cases/[id]/comments
 * Returns all case-level comments (notes) for a case.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const session = await getServerSession(authOptions);

	if (!session?.key) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { id: caseId } = await params;

	if (USE_PRISMA_AUTH) {
		const { validateRefreshToken } = await import(
			"@/lib/auth/refresh-token-service"
		);
		const { prismaNew } = await import("@/lib/prisma-new");
		const { getCasePermission } = await import("@/lib/permissions");

		const validation = await validateRefreshToken(session.key);
		if (!validation.valid) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		// Check permission
		const permissionResult = await getCasePermission({
			userId: validation.userId,
			caseId,
		});

		if (!permissionResult.hasAccess) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		// Fetch case-level comments (where caseId is set but elementId is null)
		const comments = await prismaNew.comment.findMany({
			where: {
				caseId,
				elementId: null,
			},
			include: {
				author: {
					select: {
						username: true,
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		const response: CommentResponse[] = comments.map((comment) => ({
			id: comment.id,
			content: comment.content,
			author: comment.author.username,
			created_at: comment.createdAt.toISOString(),
		}));

		return NextResponse.json(response);
	}

	// Django fallback
	const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
	const response = await fetch(`${apiUrl}/api/cases/${caseId}/`, {
		headers: {
			Authorization: `Token ${session.key}`,
		},
	});

	if (!response.ok) {
		return NextResponse.json(
			{ error: "Failed to fetch comments" },
			{ status: response.status }
		);
	}

	const data = await response.json();
	return NextResponse.json(data.comments || []);
}

/**
 * POST /api/cases/[id]/comments
 * Creates a new case-level comment (note).
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const session = await getServerSession(authOptions);

	if (!session?.key) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { id: caseId } = await params;

	try {
		const body = await request.json();
		const { content } = body;

		if (!content || typeof content !== "string" || content.trim() === "") {
			return NextResponse.json(
				{ error: "Content is required" },
				{ status: 400 }
			);
		}

		if (USE_PRISMA_AUTH) {
			const { validateRefreshToken } = await import(
				"@/lib/auth/refresh-token-service"
			);
			const { prismaNew } = await import("@/lib/prisma-new");
			const { getCasePermission, hasPermissionLevel } = await import(
				"@/lib/permissions"
			);

			const validation = await validateRefreshToken(session.key);
			if (!validation.valid) {
				return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
			}

			// Check permission - need at least COMMENT permission
			const permissionResult = await getCasePermission({
				userId: validation.userId,
				caseId,
			});

			const canComment =
				permissionResult.hasAccess &&
				permissionResult.permission &&
				hasPermissionLevel(permissionResult.permission, "COMMENT");

			if (!canComment) {
				return NextResponse.json(
					{ error: "Permission denied" },
					{ status: 403 }
				);
			}

			// Create the comment
			const comment = await prismaNew.comment.create({
				data: {
					caseId,
					authorId: validation.userId,
					content: content.trim(),
				},
				include: {
					author: {
						select: {
							username: true,
						},
					},
				},
			});

			const response: CommentResponse = {
				id: comment.id,
				content: comment.content,
				author: comment.author.username,
				created_at: comment.createdAt.toISOString(),
			};

			return NextResponse.json(response, { status: 201 });
		}

		// Django fallback
		const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
		const response = await fetch(`${apiUrl}/api/comments/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Token ${session.key}`,
			},
			body: JSON.stringify({
				assurance_case: caseId,
				content,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			return NextResponse.json(
				{ error: error || "Failed to create comment" },
				{ status: response.status }
			);
		}

		const data = await response.json();
		return NextResponse.json(data, { status: 201 });
	} catch (error) {
		console.error("Error creating comment:", error);
		return NextResponse.json(
			{ error: "Failed to create comment" },
			{ status: 500 }
		);
	}
}
