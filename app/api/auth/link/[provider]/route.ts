import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LINK_COOKIE_NAME } from "@/lib/auth/config";
import {
	createLinkIntent,
	LINK_INTENT_MAX_AGE_SECONDS,
} from "@/lib/auth/link-intent";
import { validateSession } from "@/lib/auth/validate-session";

interface RouteParams {
	params: Promise<{ provider: string }>;
}

/**
 * Returns the app's public origin for building redirects.
 *
 * On Azure App Service, `request.url` reflects the container's internal
 * hostname and port, not the public hostname. NEXTAUTH_URL is the app's
 * established source of truth for its public origin (see the `redirect`
 * callback in lib/auth/config.ts, email-service.ts, and the case-permissions
 * invite route) — this joins that convention rather than trusting the request.
 */
function publicBaseUrl(): string {
	const baseUrl = process.env.NEXTAUTH_URL;
	if (!baseUrl) {
		throw new Error(
			"NEXTAUTH_URL must be configured for authentication redirects"
		);
	}
	return baseUrl;
}

/**
 * GET /api/auth/link/[provider]
 *
 * Initiates the OAuth linking flow for an existing authenticated user.
 * Stores a signed, session-bound link intent in a secure cookie, then
 * redirects to the NextAuth OAuth endpoint. The signIn callback in
 * lib/auth/config.ts verifies that intent and merges the OAuth credentials
 * into the existing account.
 */
export async function GET(_request: Request, { params }: RouteParams) {
	const { provider } = await params;

	// Validate that user is signed in
	const validated = await validateSession();
	if (!validated) {
		return NextResponse.redirect(
			new URL("/login?error=SessionRequired", publicBaseUrl())
		);
	}

	// Validate provider
	const normalizedProvider = provider.toLowerCase();
	const validProviders = ["github", "google"];
	if (!validProviders.includes(normalizedProvider)) {
		return NextResponse.json(
			{ error: `Invalid provider: ${provider}` },
			{ status: 400 }
		);
	}

	// Store a signed, session-bound link intent in a secure cookie for the
	// OAuth callback (lib/auth/link-intent.ts) — never the raw user id.
	const cookieStore = await cookies();
	cookieStore.set(
		LINK_COOKIE_NAME,
		createLinkIntent({
			userId: validated.userId,
			provider: normalizedProvider,
		}),
		{
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: LINK_INTENT_MAX_AGE_SECONDS,
			path: "/",
		}
	);

	// Redirect to NextAuth OAuth endpoint
	// The callback will be handled by auth-options.ts which checks for the link cookie
	const callbackUrl = "/dashboard/settings";
	const signInUrl = new URL(
		`/api/auth/signin/${normalizedProvider}`,
		publicBaseUrl()
	);
	signInUrl.searchParams.set("callbackUrl", callbackUrl);

	return NextResponse.redirect(signInUrl);
}
