import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
	createCaseStudy,
	getCaseStudiesByOwner,
} from "@/lib/services/case-study-service";
import {
	transformCaseStudiesForApi,
	transformCaseStudyForApi,
} from "@/lib/services/case-study-transforms";

/**
 * GET /api/case-studies
 * List all case studies owned by the current user
 */
export async function GET(): Promise<NextResponse> {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const caseStudies = await getCaseStudiesByOwner(session.user.id);
		return NextResponse.json(transformCaseStudiesForApi(caseStudies));
	} catch (error) {
		console.error("Error fetching case studies:", error);
		return NextResponse.json(
			{ error: "Failed to fetch case studies" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/case-studies
 * Create a new case study
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const contentType = request.headers.get("content-type") ?? "";

		let data: Record<string, unknown>;

		if (contentType.includes("multipart/form-data")) {
			const formData = await request.formData();
			data = {
				title: formData.get("title") as string,
				description: formData.get("description") as string | null,
				authors: formData.get("authors") as string | null,
				category: formData.get("category") as string | null,
				sector: formData.get("sector") as string | null,
				contact: formData.get("contact") as string | null,
				type: formData.get("type") as string | null,
				published: formData.get("published") === "true",
			};

			// Handle image file if provided
			const imageFile = formData.get("image") as File | null;
			if (imageFile && imageFile.size > 0) {
				// For now, store a placeholder - image handling would need file storage setup
				data.image = imageFile.name;
			}
		} else {
			data = await request.json();
		}

		if (!data.title || typeof data.title !== "string") {
			return NextResponse.json({ error: "Title is required" }, { status: 400 });
		}

		const caseStudy = await createCaseStudy(session.user.id, {
			title: data.title,
			description: data.description as string | undefined,
			authors: data.authors as string | undefined,
			category: data.category as string | undefined,
			sector: data.sector as string | undefined,
			contact: data.contact as string | undefined,
			type: data.type as string | undefined,
			published: data.published as boolean | undefined,
			image: data.image as string | undefined,
		});

		return NextResponse.json(transformCaseStudyForApi(caseStudy), {
			status: 201,
		});
	} catch (error) {
		console.error("Error creating case study:", error);
		return NextResponse.json(
			{ error: "Failed to create case study" },
			{ status: 500 }
		);
	}
}
