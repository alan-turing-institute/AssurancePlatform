import { afterEach, describe, expect, it, vi } from "vitest";
import { createCaseTools } from "../tools";

vi.mock("@/lib/services/case-export-service", () => ({ exportCase: vi.fn() }));

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("createCaseTools registration of suggest_techniques", () => {
	it("registers it alongside the read tools when TECHNIQUES_MCP_URL is a URL", () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", "https://techniques.example/mcp");
		expect(Object.keys(createCaseTools("u", "c")).sort()).toEqual([
			"read_case",
			"read_element",
			"suggest_techniques",
		]);
	});

	it.each([
		"",
		"not a url",
		"techniques.example",
	])("leaves it out when TECHNIQUES_MCP_URL is %j", (value) => {
		vi.stubEnv("TECHNIQUES_MCP_URL", value);
		expect(Object.keys(createCaseTools("u", "c")).sort()).toEqual([
			"read_case",
			"read_element",
		]);
	});

	it("leaves it out when TECHNIQUES_MCP_URL is unset", () => {
		// biome-ignore lint/performance/noDelete: unset the variable for real
		delete process.env.TECHNIQUES_MCP_URL;
		expect(createCaseTools("u", "c")).not.toHaveProperty("suggest_techniques");
	});

	it("passes the selection through so the claim defaults to its text", async () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", "https://techniques.example/mcp");
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					result: {
						structuredContent: { rankingAvailable: true, results: [] },
					},
				}),
				{ status: 200 }
			)
		);
		vi.stubGlobal("fetch", fetchMock);
		const tools = createCaseTools("u", "c", {
			label: "P1",
			type: "PROPERTY_CLAIM",
			text: "From selection",
		});
		await tools.suggest_techniques?.execute?.(
			{},
			{ toolCallId: "c", messages: [] }
		);
		expect(
			JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body).params
				.arguments.claim
		).toBe("From selection");
		vi.unstubAllGlobals();
	});
});
