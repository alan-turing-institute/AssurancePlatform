import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	act,
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
const session = vi.hoisted(() => ({
	value: { data: { user: { id: "u1" } }, status: "authenticated" } as {
		data: { user: { id: string } } | null;
		status: string;
	},
}));
const getCaseChat = vi.hoisted(() => vi.fn(() => ({})));
const assistantTools = vi.hoisted(() => ({
	value: null as string[] | null,
}));

vi.mock("next-auth/react", () => ({
	useSession: () => session.value,
}));
vi.mock("@/lib/plugins/assistant/chat-store", () => ({ getCaseChat }));
vi.mock("@/lib/plugins/assistant/use-assistant-tools", () => ({
	useAssistantTools: () => assistantTools.value,
}));

const CTX = {
	canEdit: false,
	caseId: "case-1",
	selectedElementId: "el-1",
	selectedElementLabel: "G1",
};

const TOOLS = ["read_case", "read_element", "lint_case"];

beforeEach(() => {
	assistantTools.value = TOOLS;
	session.value = { data: { user: { id: "u1" } }, status: "authenticated" };
	getCaseChat.mockClear();
	chat.state.messages = [];
	chat.state.status = "ready";
	chat.state.error = undefined;
	chat.state.sendMessage.mockReset();
	chat.state.stop.mockReset();
});

describe("AssistantPanel", () => {
	it("sends the typed question with the selected element", async () => {
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.getByTestId("assistant-selection")).toHaveTextContent(
			"Selected: G1"
		);
		await userEvent.type(
			screen.getByLabelText("Message the assistant"),
			"What does G1 claim?{Enter}"
		);

		expect(chat.state.sendMessage).toHaveBeenCalledWith(
			{ text: "What does G1 claim?" },
			{ body: { selectedElementId: "el-1" } }
		);
	});

	it("stops the stream without sending or clearing the draft", async () => {
		chat.state.status = "streaming";
		renderWithoutProviders(<AssistantPanel {...CTX} />);
		const box = screen.getByLabelText("Message the assistant");
		await userEvent.type(box, "next question");

		const stop = screen.getByRole("button", { name: "Stop" });
		expect(stop).toHaveAttribute("type", "button");
		await userEvent.click(stop);

		expect(chat.state.stop).toHaveBeenCalledTimes(1);
		expect(chat.state.sendMessage).not.toHaveBeenCalled();
		expect(box).toHaveValue("next question");
	});

	it("renders a text reply and a tool call row", () => {
		chat.state.messages = [
			{
				id: "m1",
				role: "assistant",
				parts: [
					{ type: "text", text: "G1 claims safety." },
					{
						type: "tool-read_case",
						toolCallId: "c1",
						state: "input-available",
						input: {},
					},
				],
			},
		];
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.getByText("G1 claims safety.")).toBeInTheDocument();
		expect(screen.getByTestId("assistant-tool-call")).toBeInTheDocument();
	});

	it("renders markdown, and shows HTML in a reply as text", () => {
		chat.state.messages = [
			{
				id: "m1",
				role: "assistant",
				parts: [
					{ type: "text", text: "This is **bold** <script>alert(1)</script>" },
				],
			},
		];
		const { container } = renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(
			container.querySelector('[data-streamdown="strong"]')
		).toHaveTextContent("bold");
		expect(container.querySelector("script")).toBeNull();
		expect(container).toHaveTextContent("<script>alert(1)</script>");
	});

	it("shows a notice, and keeps the input usable, when the model call was cut short", () => {
		chat.state.messages = [
			{
				id: "m1",
				role: "assistant",
				parts: [{ type: "data-notice", data: "timeout" }],
			},
		];
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"The model did not answer in time. Try again or ask something shorter."
		);
		expect(screen.getByLabelText("Message the assistant")).toBeEnabled();
	});

	it("points to settings when the route reports the assistant is not configured", () => {
		chat.state.error = new Error(
			JSON.stringify({ code: "CONFLICT", error: "No key set." })
		);
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.getByTestId("assistant-not-configured")).toHaveTextContent(
			"No key set."
		);
		expect(
			screen.getByRole("link", { name: "Open plugin settings" })
		).toHaveAttribute("href", "/dashboard/settings/plugins");
	});

	it("builds no chat until the session is authenticated", () => {
		session.value = { data: null, status: "loading" };
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(getCaseChat).not.toHaveBeenCalled();
		expect(screen.queryByLabelText("Message the assistant")).toBeNull();
	});

	it("keys the chat by the signed-in user and the case", () => {
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(getCaseChat).toHaveBeenCalledWith("u1", "case-1");
	});

	it("introduces the assistant before the first message, and mentions techniques only when that tool exists", () => {
		const { unmount } = renderWithoutProviders(<AssistantPanel {...CTX} />);

		const intro = screen.getByTestId("assistant-intro");
		expect(intro).toHaveTextContent("Ask about this case");
		expect(intro).toHaveTextContent("never changes it");
		expect(intro).not.toHaveTextContent("TEA Techniques library");
		unmount();

		assistantTools.value = [...TOOLS, "suggest_techniques"];
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.getByTestId("assistant-intro")).toHaveTextContent(
			"TEA Techniques library"
		);
	});

	it("shows the introduction and no prompts while the tools are unknown", () => {
		assistantTools.value = null;
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.getByTestId("assistant-intro")).toBeInTheDocument();
		expect(screen.queryByTestId("assistant-suggestions")).toBeNull();
	});

	it("sends exactly the text of a clicked prompt, with the selection, and leaves the draft", async () => {
		renderWithoutProviders(<AssistantPanel {...CTX} />);
		const box = screen.getByLabelText("Message the assistant");
		await userEvent.type(box, "half-written question");

		await userEvent.click(
			screen.getByRole("button", { name: "What evidence supports G1?" })
		);

		expect(chat.state.sendMessage).toHaveBeenCalledTimes(1);
		expect(chat.state.sendMessage).toHaveBeenCalledWith(
			{ text: "What evidence supports G1?" },
			{ body: { selectedElementId: "el-1" } }
		);
		expect(box).toHaveValue("half-written question");
	});

	it("sends one message when a prompt is clicked twice before the chat reports it is busy", () => {
		renderWithoutProviders(<AssistantPanel {...CTX} />);
		const prompt = screen.getByRole("button", {
			name: "What evidence supports G1?",
		});

		act(() => {
			prompt.click();
			prompt.click();
		});

		expect(chat.state.sendMessage).toHaveBeenCalledTimes(1);
	});

	it("sends again once the chat is idle, even if it was never seen busy", async () => {
		const { rerender } = renderWithoutProviders(<AssistantPanel {...CTX} />);
		await userEvent.click(
			screen.getByRole("button", { name: "What evidence supports G1?" })
		);
		rerender(<AssistantPanel {...CTX} />);

		await userEvent.type(
			screen.getByLabelText("Message the assistant"),
			"Next question{Enter}"
		);

		expect(chat.state.sendMessage).toHaveBeenCalledTimes(2);
		expect(chat.state.sendMessage).toHaveBeenLastCalledWith(
			{ text: "Next question" },
			{ body: { selectedElementId: "el-1" } }
		);
	});

	it("lets the prompts wrap onto further lines instead of scrolling sideways", () => {
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		const row = screen.getByRole("button", {
			name: "What evidence supports G1?",
		}).parentElement;

		expect(row).toHaveClass("flex-wrap");
		expect(row).not.toHaveClass("flex-nowrap");
	});

	it("offers the case-wide prompts when nothing is selected", () => {
		renderWithoutProviders(
			<AssistantPanel
				{...CTX}
				selectedElementId={undefined}
				selectedElementLabel={undefined}
			/>
		);

		expect(
			screen.getByRole("button", { name: "What is the top-level goal?" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Check this case against the rules" })
		).toBeInTheDocument();
	});

	it("takes the prompts away once there is a message", () => {
		chat.state.messages = [
			{ id: "m1", role: "user", parts: [{ type: "text", text: "Hello" }] },
		];
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.queryByTestId("assistant-suggestions")).toBeNull();
		expect(screen.queryByTestId("assistant-intro")).toBeNull();
	});

	it("shows the waiting line while the request is submitted", () => {
		chat.state.status = "submitted";
		chat.state.messages = [
			{ id: "m1", role: "user", parts: [{ type: "text", text: "Hello" }] },
		];
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.getByRole("status")).toHaveTextContent("Thinking…");
	});

	it("drops the waiting line once text is streaming", () => {
		chat.state.status = "streaming";
		chat.state.messages = [
			{ id: "m1", role: "user", parts: [{ type: "text", text: "Hello" }] },
			{
				id: "m2",
				role: "assistant",
				parts: [{ type: "text", text: "G1 claims", state: "streaming" }],
			},
		];
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.queryByRole("status")).toBeNull();
	});

	it("shows one thinking block for a reply whose thinking has text", () => {
		chat.state.status = "streaming";
		chat.state.messages = [
			{
				id: "m1",
				role: "assistant",
				parts: [
					{ type: "reasoning", text: "First I read the case.", state: "done" },
					{ type: "reasoning", text: "Then I answer.", state: "streaming" },
				],
			},
		];
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		const blocks = screen.getAllByTestId("assistant-reasoning");
		expect(blocks).toHaveLength(1);
		expect(blocks[0]).toHaveTextContent("First I read the case.");
		expect(blocks[0]).toHaveTextContent("Then I answer.");
	});

	it("shows no thinking block when every thinking part is empty", () => {
		chat.state.messages = [
			{
				id: "m1",
				role: "assistant",
				parts: [
					{ type: "reasoning", text: "", state: "done" },
					{ type: "text", text: "G1 claims safety." },
				],
			},
		];
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.queryByTestId("assistant-reasoning")).toBeNull();
		expect(screen.getByText("G1 claims safety.")).toBeInTheDocument();
	});
});
