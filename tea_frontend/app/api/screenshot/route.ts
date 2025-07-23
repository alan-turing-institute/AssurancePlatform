import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		// Get authorization from header
		const authHeader = request.headers.get("authorization");
		if (!authHeader) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Parse request body
		let body: { image?: string; caseId?: string };
		try {
			body = await request.json();
		} catch (_error) {
			return NextResponse.json(
				{ error: "Invalid request body" },
				{ status: 400 }
			);
		}

		const { image, caseId } = body;

		// Validate required fields
		if (!(image && caseId)) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		const filename = "screenshot.png";

		// Convert base64 string to Blob
		let blob: Blob;
		try {
			blob = base64ToBlob(image, "image/png");
		} catch (_error) {
			return NextResponse.json(
				{ error: "Invalid image data" },
				{ status: 400 }
			);
		}

		// Create form data for backend - convert blob to File
		const file = new File([blob], filename, { type: "image/png" });
		const formdata = new FormData();
		formdata.append("image", file);

		const backendUrl =
			process.env.API_URL ||
			process.env.NEXT_PUBLIC_API_URL ||
			process.env.API_URL_STAGING ||
			process.env.NEXT_PUBLIC_API_URL_STAGING;

		// Don't set Content-Type header - it will be set automatically with boundary
		const requestOptions: RequestInit = {
			method: "POST",
			body: formdata,
			redirect: "follow",
			headers: {
				Authorization: authHeader,
				// Content-Type is automatically set for FormData
			},
		};

		let response: Response;
		try {
			response = await fetch(
				`${backendUrl}/api/cases/${caseId}/upload_image/`,
				requestOptions
			);
		} catch (_fetchError) {
			// Network errors should return Internal server error
			return NextResponse.json(
				{ error: "Internal server error" },
				{ status: 500 }
			);
		}

		if (!response.ok) {
			return NextResponse.json(
				{ error: "Failed to upload" },
				{ status: response.status }
			);
		}

		const result = await response.json();
		return NextResponse.json(result);
	} catch (_error) {
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// Utility function to convert base64 to Blob
function base64ToBlob(base64: string, mimeType: string) {
	// Handle data URL format
	const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
	const byteString = atob(base64Data); // Decode base64
	const arrayBuffer = new ArrayBuffer(byteString.length);
	const uint8Array = new Uint8Array(arrayBuffer);

	for (let i = 0; i < byteString.length; i++) {
		uint8Array[i] = byteString.charCodeAt(i);
	}

	return new Blob([uint8Array], { type: mimeType });
}
