import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createToolCallLimit,
	MAX_TOOL_CALLS_PER_REPLY,
	TOO_MANY_TOOL_CALLS,
} from "@/lib/plugins/assistant/tool-call-limit";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import { exportCase } from "@/lib/services/case-export-service";
import { readHealthStatusesForCase } from "@/lib/services/health-status-service";

vi.mock("@/lib/services/case-export-service", () => ({
	exportCase: vi.fn(),
}));
vi.mock("@/lib/services/health-status-service", () => ({
	readHealthStatusesForCase: vi.fn(),
}));

const TREE = {
	id: "g1",
	type: "GOAL",
	name: "G1",
	description: "top",
	children: [
		{
			id: "p1",
			type: "PROPERTY_CLAIM",
			name: "P1",
			description: "claim",
			children: [],
		},
	],
};

const options = { toolCallId: "t", messages: [] };
const TOO_MANY = { error: "Too many tool calls in one reply." };
const fetchMock = vi.fn();

beforeEach(() => {
	vi.mocked(exportCase).mockReset();
	vi.mocked(exportCase).mockResolvedValue({
		data: {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			case: { name: "Case", description: "d" },
			tree: TREE as never,
		},
	});
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("createToolCallLimit", () => {
	it("runs the work up to the maximum, then answers with the fixed error and runs nothing", async () => {
		const limited = createToolCallLimit(3);
		const work = vi.fn(() => Promise.resolve("done"));

		const answers = await Promise.all(
			Array.from({ length: 5 }, () => limited(work))
		);

		expect(answers).toEqual([
			"done",
			"done",
			"done",
			TOO_MANY_TOOL_CALLS,
			TOO_MANY_TOOL_CALLS,
		]);
		expect(work).toHaveBeenCalledTimes(3);
	});

	it("counts a call whose work fails", async () => {
		const limited = createToolCallLimit(1);
		await limited(() => Promise.reject(new Error("boom"))).catch(() => null);

		expect(await limited(() => Promise.resolve("done"))).toEqual(TOO_MANY);
	});
});

describe("createCaseTools: the cap on one reply's tool calls", () => {
	it("allows 24 calls, answers the rest with the fixed error, and exports the case once", async () => {
		const tools = createCaseTools("u", "c");

		const answers = await Promise.all(
			Array.from({ length: 50 }, () => tools.read_case.execute?.({}, options))
		);

		expect(MAX_TOOL_CALLS_PER_REPLY).toBe(24);
		expect(
			answers.filter((answer) => answer && "found" in answer)
		).toHaveLength(24);
		expect(
			answers.filter((answer) => answer === TOO_MANY_TOOL_CALLS)
		).toHaveLength(26);
		expect(answers.at(-1)).toEqual(TOO_MANY);
		expect(exportCase).toHaveBeenCalledTimes(1);
	});

	it("counts read_case, read_element and lint_case together and shares one export between them", async () => {
		const tools = createCaseTools("u", "c");

		const answers = await Promise.all([
			...Array.from({ length: 8 }, () =>
				tools.read_case.execute?.({}, options)
			),
			...Array.from({ length: 8 }, () =>
				tools.read_element.execute?.({ elementId: "p1" }, options)
			),
			...Array.from({ length: 8 }, () =>
				tools.lint_case.execute?.({}, options)
			),
		]);
		const over = await Promise.all([
			tools.read_case.execute?.({}, options),
			tools.read_element.execute?.({ elementId: "p1" }, options),
			tools.lint_case.execute?.({}, options),
		]);

		expect(answers.every((answer) => answer && "found" in answer)).toBe(true);
		expect(over).toEqual([TOO_MANY, TOO_MANY, TOO_MANY]);
		expect(exportCase).toHaveBeenCalledTimes(1);
	});

	it("gives the same answer to a repeated lint, since the shared export is not changed by reading it", async () => {
		const tools = createCaseTools("u", "c");

		const first = await tools.lint_case.execute?.({}, options);
		const second = await tools.lint_case.execute?.({}, options);

		expect(second).toEqual(first);
		expect(exportCase).toHaveBeenCalledTimes(1);
	});

	it("counts the techniques tool in the same cap, and does not call the service past it", async () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", "http://techniques.test/mcp");
		fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
		const tools = createCaseTools("u", "c");
		for (let index = 0; index < MAX_TOOL_CALLS_PER_REPLY; index += 1) {
			await tools.read_case.execute?.({}, options);
		}

		const answer = await tools.suggest_techniques?.execute?.(
			{ claimText: "The model is robust to the drift we expect in service." },
			options
		);

		expect(answer).toEqual(TOO_MANY);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("counts read_claim_health in the same cap, and does not read statuses past it", async () => {
		vi.mocked(readHealthStatusesForCase).mockResolvedValue({ data: [] });
		const tools = createCaseTools("u", "c", { claimHealth: true });
		for (let index = 0; index < MAX_TOOL_CALLS_PER_REPLY; index += 1) {
			await tools.read_case.execute?.({}, options);
		}

		const answer = await tools.read_claim_health?.execute?.({}, options);

		expect(answer).toEqual(TOO_MANY);
		expect(readHealthStatusesForCase).not.toHaveBeenCalled();
	});

	it("gives each reply its own cap and its own export", async () => {
		const first = createCaseTools("u", "c");
		for (let index = 0; index < MAX_TOOL_CALLS_PER_REPLY + 1; index += 1) {
			await first.read_case.execute?.({}, options);
		}
		const second = createCaseTools("u", "c");

		expect(await second.read_case.execute?.({}, options)).toMatchObject({
			found: true,
		});
		expect(exportCase).toHaveBeenCalledTimes(2);
	});

	it("does not keep a failed read, so the next call reads the case again", async () => {
		vi.mocked(exportCase).mockRejectedValueOnce(new Error("database down"));
		const tools = createCaseTools("u", "c");

		const first = await tools.read_case.execute?.({}, options);

		expect(first).toMatchObject({ found: false });
		expect(JSON.stringify(first)).not.toContain("database down");
		expect(await tools.read_case.execute?.({}, options)).toMatchObject({
			found: true,
		});
		expect(exportCase).toHaveBeenCalledTimes(2);
	});
});
