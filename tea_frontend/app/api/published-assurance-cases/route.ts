import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const authHeader = request.headers.get("Authorization");

	if (!authHeader) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const response = await fetch(
			`${process.env.API_URL || process.env.NEXT_PUBLIC_API_URL}/api/published-assurance-cases/`,
			{
				headers: {
					Authorization: authHeader,
					"Content-Type": "application/json",
					Connection: "close",
				},
				cache: "no-store",
			}
		);

		if (!response.ok) {
			return NextResponse.json(
				{ error: "Failed to fetch" },
				{ status: response.status }
			);
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (_error) {
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
