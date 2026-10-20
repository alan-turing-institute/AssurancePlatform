import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { AssistantPanel } from "../assistant-panel";
import { suggestedPrompts } from "../suggested-prompts";
import { ToolCallRow } from "../tool-call-row";

const chat = vi.hoisted(() => ({
	state: {
		messages: [] as unknown[],
		status: "ready",
		error: undefined as Error | undefined,
		sendMessage: vi.fn(),
		stop: vi.fn(),
	},
}));
const assistantTools = vi.hoisted(() => ({
	value: null as string[] | null,
}));

vi.mock("@ai-sdk/react", () => ({ useChat: () => chat.state }));
vi.mock("next-auth/react", () => ({
	useSession: () => ({
		data: { user: { id: "u1" } },
		status: "authenticated",
	}),
}));
vi.mock("@/lib/plugins/assistant/chat-store", () => ({
	getCaseChat: vi.fn(() => ({})),
}));
vi.mock("@/lib/plugins/assistant/use-assistant-tools", () => ({
	useAssistantTools: () => assistantTools.value,
}));

const PROMPT = "Are the claims passing their automated checks?";
const BASE_TOOLS = ["read_case", "read_element", "lint_case"];
const CTX = {
	canEdit: false,
	caseId: "case-1",
	selectedElementId: undefined,
	selectedElementLabel: undefined,
};

beforeEach(() => {
	chat.state.messages = [];
	chat.state.status = "ready";
	chat.state.error = undefined;
	chat.state.sendMessage.mockReset();
	assistantTools.value = BASE_TOOLS;
});

describe("suggested prompts — claim health", () => {
	it("offers the claim health question when the tool is registered, selected or not", () => {
		const tools = [...BASE_TOOLS, "read_claim_health"];

		const unselected = suggestedPrompts({ tools, selected: false });
		const selected = suggestedPrompts({ tools, selected: true, label: "P1" });

		expect(unselected.prompts.filter((p) => p === PROMPT)).toHaveLength(1);
		expect(selected.prompts.filter((p) => p === PROMPT)).toHaveLength(1);
	});

	it("does not offer it when the tool is not registered", () => {
		for (const selected of [true, false]) {
			const { prompts } = suggestedPrompts({
				tools: BASE_TOOLS,
				selected,
				label: "P1",
			});

			expect(prompts).not.toContain(PROMPT);
		}
	});

	it("offers it without the other tools when it is the only one registered", () => {
		const { prompts } = suggestedPrompts({
			tools: ["read_claim_health"],
			selected: false,
		});

		expect(prompts).toEqual([PROMPT]);
	});

	it("leaves the other prompts as they were", () => {
		const without = suggestedPrompts({ tools: BASE_TOOLS, selected: false });
		const withHealth = suggestedPrompts({
			tools: [...BASE_TOOLS, "read_claim_health"],
			selected: false,
		});

		expect(withHealth.prompts.filter((p) => p !== PROMPT)).toEqual(
			without.prompts
		);
	});
});

describe("tool call row — read_claim_health", () => {
	it("is titled Read claim health", () => {
		renderWithoutProviders(
			<ToolCallRow
				part={
					{
						type: "tool-read_claim_health",
						toolCallId: "c1",
						state: "output-available",
						input: {},
						output: { found: true, claims: [] },
					} as never
				}
			/>
		);

		expect(screen.getByTestId("assistant-tool-call")).toHaveTextContent(
			"Read claim health"
		);
	});
});

describe("assistant panel — claim health prompt", () => {
	it("shows the prompt when the server registered the tool, and sends its exact text", async () => {
		assistantTools.value = [...BASE_TOOLS, "read_claim_health"];
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		await userEvent.click(screen.getByRole("button", { name: PROMPT }));

		expect(chat.state.sendMessage).toHaveBeenCalledTimes(1);
		expect(chat.state.sendMessage.mock.calls[0]?.[0]).toEqual({ text: PROMPT });
	});

	it("does not show the prompt when the server did not register the tool", () => {
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.queryByRole("button", { name: PROMPT })).toBeNull();
		expect(screen.getByTestId("assistant-suggestions")).toBeInTheDocument();
	});

	it("does not show the prompt while the tool list is unknown", () => {
		assistantTools.value = null;
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.queryByRole("button", { name: PROMPT })).toBeNull();
	});
});
