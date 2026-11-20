import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { apiError } from "@/lib/api-response";
import { authOptions } from "@/lib/auth/config";
import { validationError } from "@/lib/errors";

const handler = NextAuth(authOptions);

interface RouteContext {
	params: Promise<{ nextauth: string[] }>;
}

/**
 * Starting a GitHub sign-in takes its permissions from the provider's own
 * setting. A `scope` in the query string would be merged over that setting by
 * the library, so a request that names one is refused before it reaches the
 * library. Every other request, including every other provider's, is passed
 * through unchanged.
 */
async function startsGitHubSignInWithScope(
	req: NextRequest,
	context: RouteContext
): Promise<boolean> {
	const { nextauth } = await context.params;
	return (
		nextauth?.[0] === "signin" &&
		nextauth[1] === "github" &&
		req.nextUrl.searchParams.has("scope")
	);
}

export { handler as GET };

export async function POST(req: NextRequest, context: RouteContext) {
	if (await startsGitHubSignInWithScope(req, context)) {
		return apiError(
			validationError("A GitHub sign-in request cannot set its own scope")
		);
	}
	return handler(req, context);
}
