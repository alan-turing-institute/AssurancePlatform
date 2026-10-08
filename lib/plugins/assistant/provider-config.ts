import { z } from "zod";
import { readUserApiKey } from "@/lib/plugins/assistant/key-store";
import { getUserPluginSettings } from "@/lib/services/plugin-enablement-service";

export const ASSISTANT_PLUGIN_ID = "tea.assistant";

export type AssistantProvider = "anthropic" | "openai-compatible";

export interface AssistantProviderConfig {
	apiKey: string;
	/** Only set for `openai-compatible`; always a member of the operator allow-list. */
	baseUrl?: string;
	model: string;
	provider: AssistantProvider;
}

export type ProviderConfigResult =
	| { config: AssistantProviderConfig }
	| { error: string };

const settingsSchema = z.object({
	provider: z.enum(["anthropic", "openai-compatible"]),
	baseUrl: z.string().optional(),
	model: z.string().trim().min(1),
});

const allowListSchema = z.array(z.url());

const TRAILING_SLASHES = /\/+$/;

function normaliseUrl(url: string): string {
	return url.trim().replace(TRAILING_SLASHES, "");
}

/**
 * The operator's allow-list of OpenAI-compatible endpoints, from the
 * comma-separated `ASSISTANT_ALLOWED_BASE_URLS`. Read on every call so tests
 * can change it per case. An unset or invalid value yields an empty list, so
 * nothing is allowed.
 */
function allowedBaseUrls(): string[] {
	const raw = process.env.ASSISTANT_ALLOWED_BASE_URLS;
	if (!raw) {
		return [];
	}
	const parsed = allowListSchema.safeParse(
		raw
			.split(",")
			.map((entry) => entry.trim())
			.filter(Boolean)
	);
	return parsed.success ? parsed.data.map(normaliseUrl) : [];
}

/**
 * Resolves the provider, endpoint, model and key for one user's request. The
 * stored base URL is checked against the allow-list on every call, so a value
 * saved before the list changed, or written around the settings screen, is
 * refused rather than used.
 */
export async function resolveProviderConfig(
	userId: string
): Promise<ProviderConfigResult> {
	const stored = await getUserPluginSettings(ASSISTANT_PLUGIN_ID, userId);
	if ("error" in stored) {
		return { error: stored.error };
	}
	const settings = settingsSchema.safeParse(stored.data);
	if (!settings.success) {
		return {
			error:
				"The assistant has no provider and model set. Choose them in Settings, Plugins.",
		};
	}

	let baseUrl: string | undefined;
	if (settings.data.provider === "openai-compatible") {
		const wanted = normaliseUrl(settings.data.baseUrl ?? "");
		if (!(wanted && allowedBaseUrls().includes(wanted))) {
			return {
				error: "The configured base URL is not on this server's allow-list.",
			};
		}
		baseUrl = wanted;
	}

	const apiKey = await readUserApiKey(userId);
	if (!apiKey) {
		return {
			error: "No API key is set. Add one in Settings, Plugins.",
		};
	}

	return {
		config: {
			provider: settings.data.provider,
			model: settings.data.model,
			baseUrl,
			apiKey,
		},
	};
}
