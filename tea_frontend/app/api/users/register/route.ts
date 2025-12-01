import { NextResponse } from "next/server";
import { registerUser } from "@/lib/services/user-service";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

/**
 * POST /api/users/register
 * Registers a new user with Prisma auth.
 */
export async function POST(request: Request) {
	if (!USE_PRISMA_AUTH) {
		return NextResponse.json(
			{ error: "Prisma auth not enabled" },
			{ status: 400 }
		);
	}

	try {
		const body = await request.json();

		// Support both password formats (password1/password2 from form, or password directly)
		const password = body.password || body.password1;

		// Validate passwords match if both provided
		if (body.password1 && body.password2 && body.password1 !== body.password2) {
			return NextResponse.json(
				{ error: "Passwords do not match", field: "password2" },
				{ status: 400 }
			);
		}

		if (!(body.username && body.email && password)) {
			return NextResponse.json(
				{ error: "Username, email, and password are required" },
				{ status: 400 }
			);
		}

		const result = await registerUser({
			username: body.username,
			email: body.email,
			password,
		});

		if (result.error) {
			return NextResponse.json(
				{ error: result.error, field: result.field },
				{ status: 400 }
			);
		}

		return NextResponse.json(result.data, { status: 201 });
	} catch (error) {
		console.error("Registration error:", error);
		return NextResponse.json(
			{ error: "Failed to process registration" },
			{ status: 500 }
		);
	}
}
