import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/validate-session";
import { LINK_COOKIE_NAME } from "@/lib/auth-options";

const LINK_COOKIE_MAX_AGE = 60 * 5; // 5 minutes - enough time for OAuth flow

type RouteParams = {
	params: Promise<{ provider: string }>;
};

/**
 * GET /api/auth/link/[provider]
 *
 * Initiates the OAuth linking flow for an existing authenticated user.
 * Stores the current user ID in a secure cookie, then redirects to the
 * NextAuth OAuth endpoint. The signIn callback in auth-options.ts will
 * check for this cookie and merge the OAuth credentials into the existing account.
 */
export async function GET(request: Request, { params }: RouteParams) {
	const { provider } = await params;

	// Validate that user is signed in
	const validated = await validateSession();
	if (!validated) {
		return NextResponse.redirect(
			new URL("/login?error=SessionRequired", request.url)
		);
	}

	// Validate provider
	const validProviders = ["github", "google"];
	if (!validProviders.includes(provider.toLowerCase())) {
		return NextResponse.json(
			{ error: `Invalid provider: ${provider}` },
			{ status: 400 }
		);
	}

	// Store the current user ID in a secure cookie for the OAuth callback
	const cookieStore = await cookies();
	cookieStore.set(LINK_COOKIE_NAME, validated.userId, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: LINK_COOKIE_MAX_AGE,
		path: "/",
	});

	// Redirect to NextAuth OAuth endpoint
	// The callback will be handled by auth-options.ts which checks for the link cookie
	const callbackUrl = "/dashboard/settings";
	const signInUrl = new URL(
		`/api/auth/signin/${provider.toLowerCase()}`,
		request.url
	);
	signInUrl.searchParams.set("callbackUrl", callbackUrl);

	return NextResponse.redirect(signInUrl);
}
