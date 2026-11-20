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
 * Starting a GitHub sign-in takes its permissions and addresses from the
 * provider's own settings. Any query parameter would be merged over those
 * settings by the library, so a request that carries one is refused before it
 * reaches the library. Every other request, including every other provider's,
 * is passed through unchanged.
 */
async function startsGitHubSignInWithQuery(
	req: NextRequest,
	context: RouteContext
): Promise<boolean> {
	const { nextauth } = await context.params;
	return (
		nextauth?.[0] === "signin" &&
		nextauth[1] === "github" &&
		req.nextUrl.searchParams.size > 0
	);
}

export { handler as GET };

/**
 * The NextAuth sign-in and callback handler. It is not part of the published
 * API.
 *
 * @ignore
 */
export async function POST(req: NextRequest, context: RouteContext) {
	if (await startsGitHubSignInWithQuery(req, context)) {
		return apiError(
			validationError(
				"A GitHub sign-in request cannot carry its own parameters"
			)
		);
	}
	return handler(req, context);
}
