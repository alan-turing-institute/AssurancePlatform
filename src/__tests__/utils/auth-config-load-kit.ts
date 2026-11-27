import type { NextAuthOptions } from "next-auth";
import { vi } from "vitest";

/**
 * The sign-in configuration builds its provider options when its file is
 * loaded, from settings read at that moment. This kit sets every one of those
 * settings, resets the module registry and loads the file afresh, so a test
 * sees the effect of exactly the values it names (a setting it leaves out is
 * set to empty, so nothing comes from a local environment file).
 */
const AUTH_CONFIG_SETTINGS = [
	"GITHUB_APP_CLIENT_ID",
	"GITHUB_APP_CLIENT_ID_STAGING",
	"GITHUB_APP_CLIENT_SECRET",
	"GITHUB_APP_CLIENT_SECRET_STAGING",
	"GOOGLE_CLIENT_ID",
	"GOOGLE_CLIENT_SECRET",
	"NEXTAUTH_URL",
	"NEXTAUTH_SECRET",
] as const;

export type AuthConfigSetting = (typeof AUTH_CONFIG_SETTINGS)[number];

export type AuthConfigSettings = Partial<Record<AuthConfigSetting, string>>;

/** The part of a provider's options these tests read. */
export interface ProviderOptionsView {
	authorization?: { params?: Record<string, unknown> };
	clientId?: string;
	clientSecret?: string;
	credentials?: Record<string, unknown>;
	name?: string;
}

export interface ProviderView {
	id: string;
	options?: ProviderOptionsView;
}

function stubAuthConfigSettings(settings: AuthConfigSettings): void {
	for (const name of AUTH_CONFIG_SETTINGS) {
		vi.stubEnv(name, settings[name] ?? "");
	}
}

export async function loadAuthConfigWith(
	settings: AuthConfigSettings
): Promise<typeof import("@/lib/auth/config")> {
	vi.resetModules();
	stubAuthConfigSettings(settings);
	return await import("@/lib/auth/config");
}

export async function loadAuthOptionsWith(
	settings: AuthConfigSettings
): Promise<NextAuthOptions> {
	return (await loadAuthConfigWith(settings)).authOptions;
}

export function findProvider(
	authOptions: NextAuthOptions,
	id: string
): ProviderView {
	const provider = authOptions.providers.find((entry) => entry.id === id);
	if (!provider) {
		throw new Error(`no provider with id ${id}`);
	}
	return provider as unknown as ProviderView;
}
