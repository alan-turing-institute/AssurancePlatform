import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { AssistantPanel } from "../assistant-panel";

const chat = vi.hoisted(() => ({
	state: {
		messages: [] as unknown[],
		status: "ready",
		error: undefined as Error | undefined,
		sendMessage: vi.fn(),
		stop: vi.fn(),
	},
}));

vi.mock("@ai-sdk/react", () => ({ useChat: () => chat.state }));
vi.mock("next-auth/react", () => ({
	useSession: () => ({ data: { user: { id: "u1" } }, status: "authenticated" }),
}));
vi.mock("@/lib/plugins/assistant/chat-store", () => ({
	getCaseChat: () => ({}),
}));
vi.mock("@/lib/plugins/assistant/use-assistant-tools", () => ({
	useAssistantTools: () => [],
}));
vi.mock("@/lib/plugins/assistant/tool-call-row", () => ({
	ToolCallRow: ({ part }: { part: { toolCallId: string } }) => {
		if (part.toolCallId === "cannot-draw") {
			throw new Error("This row cannot be drawn.");
		}
		return <p>row {part.toolCallId}</p>;
	},
}));

const CTX = {
	canEdit: false,
	caseId: "case-1",
	selectedElementId: undefined,
	selectedElementLabel: undefined,
};

beforeEach(() => {
	chat.state.messages = [];
	chat.state.status = "ready";
	chat.state.sendMessage.mockReset();
});

describe("a message that cannot be drawn", () => {
	it("is replaced by a notice while the other messages and the prompt box keep working", async () => {
		chat.state.messages = [
			{
				id: "m1",
				role: "assistant",
				parts: [
					{ type: "text", text: "Broken reply" },
					{
						type: "tool-read_case",
						toolCallId: "cannot-draw",
						state: "input-available",
						input: {},
					},
				],
			},
			{ id: "m2", role: "user", parts: [{ type: "text", text: "Still here" }] },
		];

		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"This message could not be shown."
		);
		expect(screen.queryByText("Broken reply")).toBeNull();
		expect(screen.getByTestId("assistant-message-user")).toHaveTextContent(
			"Still here"
		);
		await userEvent.type(
			screen.getByLabelText("Message the assistant"),
			"Carry on{Enter}"
		);
		expect(chat.state.sendMessage).toHaveBeenCalledTimes(1);
	});
});
