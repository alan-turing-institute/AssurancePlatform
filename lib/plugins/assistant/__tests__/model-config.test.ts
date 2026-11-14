import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	modelAccessFor,
	resolveChatModel,
} from "@/lib/plugins/assistant/model-config";
import {
	getConnectionForUse,
	getRoles,
	type ModelRoles,
} from "@/lib/services/model-connection-service";

vi.mock("@/lib/services/model-connection-service", () => ({
	getConnectionForUse: vi.fn(),
	getRoles: vi.fn(),
}));

const NO_JOBS: ModelRoles = {
	chat: null,
	ranking: null,
	search: null,
	searchCheck: null,
};
const CHAT_JOB = { connectionId: "conn-1", model: "the-chat-model" };
const OLLAMA = {
	id: "conn-1",
	label: "Local",
	type: "OLLAMA" as const,
	baseUrl: "http://models.internal:11434",
	apiKey: "sk-secret-key",
};

function rolesAre(roles: Partial<ModelRoles>) {
	vi.mocked(getRoles).mockResolvedValue({ data: { ...NO_JOBS, ...roles } });
}

beforeEach(() => {
	vi.resetAllMocks();
});

describe("resolveChatModel", () => {
	it("tells the user to set up AI models when there is no chat job, without reading a connection", async () => {
		rolesAre({});

		const result = await resolveChatModel("u1");

		expect(result).toEqual({
			error: expect.stringContaining("Set up AI models"),
		});
		expect(getConnectionForUse).not.toHaveBeenCalled();
	});

	it("builds the chat job's model on the user's own connection", async () => {
		rolesAre({ chat: CHAT_JOB });
		vi.mocked(getConnectionForUse).mockResolvedValue({ data: OLLAMA });

		const result = await resolveChatModel("u1");

		expect(getConnectionForUse).toHaveBeenCalledWith("u1", "conn-1");
		expect(result).toHaveProperty("model");
		expect((result as { model: { modelId: string } }).model.modelId).toBe(
			"the-chat-model"
		);
	});

	it("answers with a setup error when the connection is missing or another user's", async () => {
		rolesAre({ chat: CHAT_JOB });
		vi.mocked(getConnectionForUse).mockResolvedValue({
			error: "Model connection not found",
		});

		const result = await resolveChatModel("u1");

		expect(result).toEqual({
			error: expect.stringContaining("Set up AI models"),
		});
	});

	it("answers with a setup error when the connection cannot chat, and names neither its key nor its address", async () => {
		rolesAre({ chat: CHAT_JOB });
		vi.mocked(getConnectionForUse).mockResolvedValue({
			data: {
				...OLLAMA,
				type: "ANTHROPIC",
				baseUrl: "https://api.anthropic.com",
				apiKey: null,
			},
		});

		const result = await resolveChatModel("u1");

		expect(result).toEqual({
			error: expect.stringContaining("Set up AI models"),
		});
		expect(JSON.stringify(result)).not.toContain("anthropic.com");
	});

	it("answers with an error, not a throw, when the jobs cannot be read", async () => {
		vi.mocked(getRoles).mockResolvedValue({
			error: "Failed to read the model jobs",
		});

		const result = await resolveChatModel("u1");

		expect(result).toHaveProperty("error");
		expect(getConnectionForUse).not.toHaveBeenCalled();
	});
});

describe("modelAccessFor", () => {
	it("reads the user's jobs and connections when asked, for that user only", async () => {
		rolesAre({ chat: CHAT_JOB });
		vi.mocked(getConnectionForUse).mockResolvedValue({ data: OLLAMA });

		const access = modelAccessFor("u1");

		expect(getRoles).not.toHaveBeenCalled();
		expect(await access.roles()).toMatchObject({ chat: CHAT_JOB });
		expect(await access.connection("conn-1")).toEqual(OLLAMA);
		expect(getRoles).toHaveBeenCalledWith("u1");
		expect(getConnectionForUse).toHaveBeenCalledWith("u1", "conn-1");
	});

	it("gives null for jobs or a connection it cannot read", async () => {
		vi.mocked(getRoles).mockResolvedValue({ error: "Failed" });
		vi.mocked(getConnectionForUse).mockResolvedValue({ error: "Not found" });

		const access = modelAccessFor("u1");

		expect(await access.roles()).toBeNull();
		expect(await access.connection("conn-1")).toBeNull();
	});
});
