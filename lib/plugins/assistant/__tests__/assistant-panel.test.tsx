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
const session = vi.hoisted(() => ({
	value: { data: { user: { id: "u1" } }, status: "authenticated" } as {
		data: { user: { id: string } } | null;
		status: string;
	},
}));
const getCaseChat = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("next-auth/react", () => ({
	useSession: () => session.value,
}));
vi.mock("@/lib/plugins/assistant/chat-store", () => ({ getCaseChat }));

const CTX = {
	canEdit: false,
	caseId: "case-1",
	selectedElementId: "el-1",
	selectedElementLabel: "G1",
};

beforeEach(() => {
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

		expect(container.querySelector("strong")).toHaveTextContent("bold");
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
});
