import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveProviderConfig } from "@/lib/plugins/assistant/provider-config";
import { getUserPluginSettings } from "@/lib/services/plugin-enablement-service";

vi.mock("@/lib/services/plugin-enablement-service", () => ({
	getUserPluginSettings: vi.fn(),
}));

const ALLOWED = "http://localhost:11434/v1";

function stored(settings: unknown) {
	vi.mocked(getUserPluginSettings).mockResolvedValue({
		data: settings as never,
	});
}

beforeEach(() => {
	vi.stubEnv("ASSISTANT_ALLOWED_BASE_URLS", ALLOWED);
	vi.stubEnv("ASSISTANT_DEV_API_KEY", "ollama");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("resolveProviderConfig", () => {
	it("accepts a base URL on the allow-list, ignoring a trailing slash", async () => {
		stored({
			provider: "openai-compatible",
			baseUrl: `${ALLOWED}/`,
			model: "m",
		});

		const result = await resolveProviderConfig("u1");

		expect(result).toEqual({
			config: {
				provider: "openai-compatible",
				baseUrl: ALLOWED,
				model: "m",
				apiKey: "ollama",
			},
		});
	});

	it("refuses a base URL outside the allow-list", async () => {
		stored({
			provider: "openai-compatible",
			baseUrl: "http://169.254.169.254/v1",
			model: "m",
		});

		expect(await resolveProviderConfig("u1")).toHaveProperty("error");
	});

	it("refuses every base URL when the allow-list is unset", async () => {
		vi.stubEnv("ASSISTANT_ALLOWED_BASE_URLS", "");
		stored({ provider: "openai-compatible", baseUrl: ALLOWED, model: "m" });

		expect(await resolveProviderConfig("u1")).toHaveProperty("error");
	});

	it("reports missing settings", async () => {
		stored(null);

		expect(await resolveProviderConfig("u1")).toHaveProperty("error");
	});

	it("reports a missing key", async () => {
		vi.stubEnv("ASSISTANT_DEV_API_KEY", "");
		stored({ provider: "anthropic", model: "m" });

		expect(await resolveProviderConfig("u1")).toHaveProperty("error");
	});

	it("needs no base URL for the anthropic provider", async () => {
		stored({ provider: "anthropic", model: "m" });

		const result = await resolveProviderConfig("u1");

		expect(result).toMatchObject({ config: { provider: "anthropic" } });
	});
});
