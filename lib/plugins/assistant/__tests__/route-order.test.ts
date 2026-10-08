import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cases/[id]/assistant/route";
import { parseJsonBody } from "@/lib/api-request";
import { unauthorised } from "@/lib/errors";
import { canAccessCase } from "@/lib/permissions";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";

const requireAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-request", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/lib/api-request")>();
	return { ...original, parseJsonBody: vi.fn(original.parseJsonBody) };
});

vi.mock("@/lib/api-response", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/api-response")>()),
	requireAuth,
}));
vi.mock("@/lib/services/plugin-enablement-service", () => ({
	assertPluginEnabledForUser: vi.fn(),
}));
vi.mock("@/lib/plugins/assistant/tools", () => ({
	ASSISTANT_SYSTEM_PROMPT: "",
	createCaseTools: vi.fn(),
}));
vi.mock("@/lib/permissions", () => ({ canAccessCase: vi.fn() }));
vi.mock("@/lib/plugins/assistant/provider-config", () => ({
	ASSISTANT_PLUGIN_ID: "tea.assistant",
	resolveProviderConfig: vi.fn().mockResolvedValue({ error: "stop here" }),
}));

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const parseSpy = vi.mocked(parseJsonBody);

function call() {
	return POST(
		new Request("http://localhost/api/cases/x/assistant", {
			method: "POST",
			body: JSON.stringify({
				messages: [{ id: "m", role: "user", parts: [] }],
			}),
		}),
		{ params: Promise.resolve({ id: CASE_ID }) }
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	requireAuth.mockResolvedValue("user-1");
	vi.mocked(assertPluginEnabledForUser).mockResolvedValue({ data: true });
	vi.mocked(canAccessCase).mockResolvedValue(true);
});

describe("assistant route check order", () => {
	it("returns 401 and checks nothing else when unauthenticated", async () => {
		requireAuth.mockRejectedValue(unauthorised());

		const response = await call();

		expect(response.status).toBe(401);
		expect(assertPluginEnabledForUser).not.toHaveBeenCalled();
		expect(parseSpy).not.toHaveBeenCalled();
	});

	it("returns 404 before checking the case when the plugin is disabled", async () => {
		vi.mocked(assertPluginEnabledForUser).mockResolvedValue({
			error: "Plugin 'tea.assistant' is not enabled",
		});

		const response = await call();

		expect(response.status).toBe(404);
		expect(canAccessCase).not.toHaveBeenCalled();
		expect(parseSpy).not.toHaveBeenCalled();
	});

	it("returns 404 without reading the body when the user lacks VIEW", async () => {
		vi.mocked(canAccessCase).mockResolvedValue(false);

		const response = await call();

		expect(response.status).toBe(404);
		expect(canAccessCase).toHaveBeenCalledWith(
			{ userId: "user-1", caseId: CASE_ID },
			"VIEW"
		);
		expect(parseSpy).not.toHaveBeenCalled();
	});

	it("reads the body only after both checks pass", async () => {
		await call();

		expect(parseSpy).toHaveBeenCalledTimes(1);
	});
});
