import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
	deleteCaseStudy,
	getCaseStudyById,
	updateCaseStudy,
} from "@/lib/services/case-study-service";
import { transformCaseStudyForApi } from "@/lib/services/case-study-transforms";

type RouteParams = {
	params: Promise<{ id: string }>;
};

/**
 * GET /api/case-studies/[id]
 * Get a specific case study by ID
 */
export async function GET(
	_request: NextRequest,
	{ params }: RouteParams
): Promise<NextResponse> {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { id } = await params;
		const caseStudyId = Number.parseInt(id, 10);

		if (Number.isNaN(caseStudyId)) {
			return NextResponse.json(
				{ error: "Invalid case study ID" },
				{ status: 400 }
			);
		}

		const caseStudy = await getCaseStudyById(caseStudyId);

		if (!caseStudy) {
			return NextResponse.json(
				{ error: "Case study not found" },
				{ status: 404 }
			);
		}

		// Check ownership
		if (caseStudy.ownerId !== session.user.id) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		return NextResponse.json(transformCaseStudyForApi(caseStudy));
	} catch (error) {
		console.error("Error fetching case study:", error);
		return NextResponse.json(
			{ error: "Failed to fetch case study" },
			{ status: 500 }
		);
	}
}

/**
 * PUT /api/case-studies/[id]
 * Update a case study
 */
export async function PUT(
	request: NextRequest,
	{ params }: RouteParams
): Promise<NextResponse> {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { id } = await params;
		const caseStudyId = Number.parseInt(id, 10);

		if (Number.isNaN(caseStudyId)) {
			return NextResponse.json(
				{ error: "Invalid case study ID" },
				{ status: 400 }
			);
		}

		const contentType = request.headers.get("content-type") ?? "";

		let data: Record<string, unknown>;

		if (contentType.includes("multipart/form-data")) {
			const formData = await request.formData();
			const publishedValue = formData.get("published");
			let published: boolean | undefined;
			if (publishedValue === "true") {
				published = true;
			} else if (publishedValue === "false") {
				published = false;
			}

			data = {
				title: formData.get("title") as string | null,
				description: formData.get("description") as string | null,
				authors: formData.get("authors") as string | null,
				category: formData.get("category") as string | null,
				sector: formData.get("sector") as string | null,
				contact: formData.get("contact") as string | null,
				type: formData.get("type") as string | null,
				published,
			};

			// Handle image file if provided
			const imageFile = formData.get("image") as File | null;
			if (imageFile && imageFile.size > 0) {
				data.image = imageFile.name;
			}
		} else {
			data = await request.json();
		}

		const caseStudy = await updateCaseStudy(caseStudyId, session.user.id, {
			title: data.title as string | undefined,
			description: data.description as string | undefined,
			authors: data.authors as string | undefined,
			category: data.category as string | undefined,
			sector: data.sector as string | undefined,
			contact: data.contact as string | undefined,
			type: data.type as string | undefined,
			published: data.published as boolean | undefined,
			image: data.image as string | undefined,
		});

		if (!caseStudy) {
			return NextResponse.json(
				{ error: "Case study not found or not owned by user" },
				{ status: 404 }
			);
		}

		return NextResponse.json(transformCaseStudyForApi(caseStudy));
	} catch (error) {
		console.error("Error updating case study:", error);
		return NextResponse.json(
			{ error: "Failed to update case study" },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/case-studies/[id]
 * Delete a case study
 */
export async function DELETE(
	_request: NextRequest,
	{ params }: RouteParams
): Promise<NextResponse> {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { id } = await params;
		const caseStudyId = Number.parseInt(id, 10);

		if (Number.isNaN(caseStudyId)) {
			return NextResponse.json(
				{ error: "Invalid case study ID" },
				{ status: 400 }
			);
		}

		const deleted = await deleteCaseStudy(caseStudyId, session.user.id);

		if (!deleted) {
			return NextResponse.json(
				{ error: "Case study not found or not owned by user" },
				{ status: 404 }
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting case study:", error);
		return NextResponse.json(
			{ error: "Failed to delete case study" },
			{ status: 500 }
		);
	}
}
