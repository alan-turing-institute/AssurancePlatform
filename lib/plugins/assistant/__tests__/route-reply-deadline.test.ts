import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cases/[id]/assistant/route";
import { canAccessCase } from "@/lib/permissions";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";

const requireAuth = vi.hoisted(() => vi.fn());
const streamText = vi.hoisted(() => vi.fn());
const CHAT_MODEL = vi.hoisted(() => ({ id: "the-chat-model" }));
const MODEL_ACCESS = vi.hoisted(() => ({ id: "the-user's-models" }));

vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	convertToModelMessages: vi.fn().mockResolvedValue([]),
	streamText,
}));
vi.mock("@/lib/api-response", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/api-response")>()),
	requireAuth,
}));
vi.mock("@/lib/services/plugin-enablement-service", () => ({
	assertPluginEnabledForUser: vi.fn(),
}));
vi.mock("@/lib/plugins/assistant/tools", () => ({
	buildSystemPrompt: vi.fn(() => ""),
	createCaseTools: vi.fn(() => ({})),
}));
vi.mock("@/lib/plugins/assistant/selected-element", () => ({
	resolveSelectedElement: vi.fn().mockResolvedValue(null),
	selectionPrompt: vi.fn(() => ""),
}));
vi.mock("@/lib/permissions", () => ({ canAccessCase: vi.fn() }));
vi.mock("@/lib/plugins/assistant/model-config", () => ({
	modelAccessFor: vi.fn(() => MODEL_ACCESS),
	resolveChatModel: vi.fn(() => Promise.resolve({ model: CHAT_MODEL })),
}));

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const START = new Date("2030-01-01T00:00:00Z");

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
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(START);
	requireAuth.mockResolvedValue("user-1");
	vi.mocked(assertPluginEnabledForUser).mockResolvedValue({ data: true });
	vi.mocked(canAccessCase).mockResolvedValue(true);
	streamText.mockReturnValue({
		toUIMessageStreamResponse: () => new Response("ok"),
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

describe("assistant route reply deadline", () => {
	it("gives the tools a deadline of its start time plus the timeout it gives streamText", async () => {
		await call();

		const { timeout } = streamText.mock.calls[0]?.[0] ?? {};
		expect(timeout).toBe(60_000);
		expect(vi.mocked(createCaseTools).mock.calls[0]?.[3]).toBe(
			START.getTime() + timeout
		);
	});

	it("uses the configured timeout for both", async () => {
		vi.stubEnv("ASSISTANT_MODEL_TIMEOUT_MS", "90000");

		await call();

		expect(streamText.mock.calls[0]?.[0].timeout).toBe(90_000);
		expect(vi.mocked(createCaseTools).mock.calls[0]?.[3]).toBe(
			START.getTime() + 90_000
		);
	});

	it("streams from the user's chat model and gives the tools the user's models", async () => {
		await call();

		expect(streamText.mock.calls[0]?.[0].model).toBe(CHAT_MODEL);
		expect(vi.mocked(createCaseTools).mock.calls[0]?.[4]).toBe(MODEL_ACCESS);
	});
});
