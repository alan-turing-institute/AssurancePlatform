import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	act,
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { AssistantPanel } from "../assistant-panel";
import { getCaseOutcomes } from "../suggestion-outcomes";

const chat = vi.hoisted(() => ({
	/** True in the tests that run the real `useChat` and the real chat store, with only the network faked. */
	live: false,
	state: {
		messages: [] as unknown[],
		status: "ready",
		error: undefined as Error | undefined,
		sendMessage: vi.fn(),
		stop: vi.fn(),
		setMessages: vi.fn(),
		clearError: vi.fn(),
	},
}));

vi.mock("@ai-sdk/react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@ai-sdk/react")>();
	return {
		...actual,
		useChat: (options: Parameters<typeof actual.useChat>[0]) =>
			// biome-ignore lint/correctness/useHookAtTopLevel: chat.live is fixed for the whole of a test, so every render calls the same hooks in the same order
			chat.live ? actual.useChat(options) : chat.state,
	};
});
const session = vi.hoisted(() => ({
	value: { data: { user: { id: "u1" } }, status: "authenticated" } as {
		data: { user: { id: string } } | null;
		status: string;
	},
}));
const getCaseChat = vi.hoisted(() =>
	vi.fn((_userId: string, _caseId: string): unknown => ({}))
);
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
	chat.live = false;
	getCaseChat.mockClear();
	getCaseChat.mockImplementation(() => ({}));
	chat.state.messages = [];
	chat.state.status = "ready";
	chat.state.error = undefined;
	chat.state.sendMessage.mockReset();
	chat.state.stop.mockReset();
	chat.state.setMessages.mockReset();
	chat.state.clearError.mockReset();
});

afterEach(() => {
	vi.unstubAllGlobals();
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
			{ body: { selectedElementId: "el-1", suggestionOutcomes: {} } }
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
			screen.getByRole("link", { name: "Set up AI models" })
		).toHaveAttribute("href", "/dashboard/settings/plugins#ai-models");
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
		expect(intro).toHaveTextContent("It never changes the case.");
		expect(intro).not.toHaveTextContent("TEA Techniques library");
		unmount();

		assistantTools.value = [...TOOLS, "suggest_techniques"];
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.getByTestId("assistant-intro")).toHaveTextContent(
			"TEA Techniques library"
		);
	});

	it("says the assistant suggests changes for the user to apply when it has the suggestion tools, and not otherwise", () => {
		assistantTools.value = [...TOOLS, "suggest_edit", "suggest_new_element"];
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		const intro = screen.getByTestId("assistant-intro");
		expect(intro).toHaveTextContent(
			"suggests one and you choose whether to apply it"
		);
		expect(intro).not.toHaveTextContent("It never changes the case.");
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
			{ body: { selectedElementId: "el-1", suggestionOutcomes: {} } }
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
			{ body: { selectedElementId: "el-1", suggestionOutcomes: {} } }
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

const QUESTION = {
	id: "q1",
	role: "user" as const,
	parts: [{ type: "text" as const, text: "What does G1 claim?" }],
};
const ANSWER = {
	id: "a1",
	role: "assistant" as const,
	parts: [{ type: "text" as const, text: "G1 claims safety." }],
};

/** Switches the next render to the real chat hook and store, and returns the real `getCaseChat` for looking inside. */
async function goLive() {
	const store =
		await vi.importActual<typeof import("../chat-store")>("../chat-store");
	chat.live = true;
	getCaseChat.mockImplementation(store.getCaseChat);
	return store.getCaseChat;
}

function stubFetch() {
	const fetchMock = vi.fn<typeof fetch>();
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

const STREAM_HEADERS = { "Content-Type": "text/event-stream" };

/** A reply that has arrived whole. */
function finishedReply(text: string): Response {
	const events = [
		{ type: "start" },
		{ type: "text-start", id: "t" },
		{ type: "text-delta", id: "t", delta: text },
		{ type: "text-end", id: "t" },
		{ type: "finish" },
	];
	return new Response(
		`${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`,
		{ headers: STREAM_HEADERS }
	);
}

/** A reply the test feeds by hand, so that it is still arriving when New chat is chosen. */
function openReply() {
	const encoder = new TextEncoder();
	let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
	let cancelled = false;
	const body = new ReadableStream<Uint8Array>({
		start(c) {
			controller = c;
		},
		cancel() {
			cancelled = true;
		},
	});
	return {
		response: new Response(body, { headers: STREAM_HEADERS }),
		wasCancelled: () => cancelled,
		push(...events: unknown[]) {
			for (const event of events) {
				controller?.enqueue(
					encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
				);
			}
		},
	};
}

describe("New chat", () => {
	it("is offered only once there is a message to clear", () => {
		const { rerender } = renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.getByRole("button", { name: "New chat" })).toBeDisabled();

		chat.state.messages = [QUESTION];
		rerender(<AssistantPanel {...CTX} />);

		expect(screen.getByRole("button", { name: "New chat" })).toBeEnabled();
	});

	it("empties the conversation and brings back the introduction and prompts", async () => {
		const liveChat = await goLive();
		liveChat("u1", "new-chat-empties").messages = [QUESTION, ANSWER];
		renderWithoutProviders(
			<AssistantPanel {...CTX} caseId="new-chat-empties" />
		);
		expect(screen.getByText("G1 claims safety.")).toBeInTheDocument();
		expect(screen.queryByTestId("assistant-intro")).toBeNull();

		await userEvent.click(screen.getByRole("button", { name: "New chat" }));

		expect(screen.queryByText("G1 claims safety.")).toBeNull();
		expect(screen.getByTestId("assistant-intro")).toBeInTheDocument();
		expect(screen.getByTestId("assistant-suggestions")).toBeInTheDocument();
		expect(liveChat("u1", "new-chat-empties").messages).toHaveLength(0);
	});

	it("clears a failure notice along with the messages", async () => {
		const liveChat = await goLive();
		stubFetch().mockResolvedValue(
			new Response(JSON.stringify({ code: "CONFLICT", error: "No key set." }), {
				status: 409,
			})
		);
		renderWithoutProviders(<AssistantPanel {...CTX} caseId="new-chat-error" />);
		await userEvent.type(
			screen.getByLabelText("Message the assistant"),
			"Hello{Enter}"
		);
		expect(
			await screen.findByTestId("assistant-not-configured")
		).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "New chat" }));

		expect(screen.queryByTestId("assistant-not-configured")).toBeNull();
		expect(liveChat("u1", "new-chat-error").error).toBeUndefined();
		expect(liveChat("u1", "new-chat-error").status).toBe("ready");
	});

	it("stops a reply that is still arriving, and none of it appears afterwards", async () => {
		const liveChat = await goLive();
		const reply = openReply();
		stubFetch().mockResolvedValue(reply.response);
		const { container } = renderWithoutProviders(
			<AssistantPanel {...CTX} caseId="new-chat-stop" />
		);
		await userEvent.type(
			screen.getByLabelText("Message the assistant"),
			"Question{Enter}"
		);
		act(() => {
			reply.push(
				{ type: "start" },
				{ type: "text-start", id: "t" },
				{ type: "text-delta", id: "t", delta: "First words" }
			);
		});
		expect(await screen.findByText("First words")).toBeInTheDocument();

		act(() => {
			reply.push({ type: "text-delta", id: "t", delta: " and later words" });
			screen.getByRole("button", { name: "New chat" }).click();
		});
		await screen.findByRole("button", { name: "Send" });
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 20));
		});

		expect(reply.wasCancelled()).toBe(true);
		expect(container).not.toHaveTextContent("First words");
		expect(container).not.toHaveTextContent("later words");
		expect(screen.getByTestId("assistant-intro")).toBeInTheDocument();
		expect(liveChat("u1", "new-chat-stop").messages).toHaveLength(0);
	});

	it("keeps what was typed in the message box and moves focus to it", async () => {
		chat.state.messages = [QUESTION];
		renderWithoutProviders(<AssistantPanel {...CTX} />);
		const box = screen.getByLabelText("Message the assistant");
		await userEvent.type(box, "half-written question");

		await userEvent.click(screen.getByRole("button", { name: "New chat" }));

		expect(box).toHaveValue("half-written question");
		expect(box).toHaveFocus();
	});

	it("sends the next message with no earlier messages in the request", async () => {
		await goLive();
		const fetchMock = stubFetch();
		fetchMock.mockImplementation(() =>
			Promise.resolve(finishedReply("An answer."))
		);
		renderWithoutProviders(<AssistantPanel {...CTX} caseId="new-chat-next" />);
		const box = screen.getByLabelText("Message the assistant");
		await userEvent.type(box, "First question{Enter}");
		await screen.findByText("An answer.");

		await userEvent.click(screen.getByRole("button", { name: "New chat" }));
		await userEvent.type(box, "Second question{Enter}");

		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		const sent = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
		expect(sent.messages).toHaveLength(1);
		expect(sent.messages[0]).toMatchObject({
			role: "user",
			parts: [{ type: "text", text: "Second question" }],
		});
	});

	it("leaves the chat of another case as it was", async () => {
		const liveChat = await goLive();
		liveChat("u1", "new-chat-here").messages = [QUESTION, ANSWER];
		liveChat("u1", "new-chat-elsewhere").messages = [
			{ ...QUESTION, parts: [{ type: "text", text: "A question elsewhere." }] },
		];
		const { rerender } = renderWithoutProviders(
			<AssistantPanel {...CTX} caseId="new-chat-here" />
		);

		await userEvent.click(screen.getByRole("button", { name: "New chat" }));
		rerender(<AssistantPanel {...CTX} caseId="new-chat-elsewhere" />);

		expect(liveChat("u1", "new-chat-here").messages).toHaveLength(0);
		expect(liveChat("u1", "new-chat-elsewhere").messages).toHaveLength(1);
		expect(screen.getByText("A question elsewhere.")).toBeInTheDocument();
	});
});

describe("suggestion cards in the panel", () => {
	const SUGGESTION = {
		suggested: true,
		kind: "edit",
		elementId: "p1",
		elementType: "property_claim",
		label: "P1",
		changes: { description: { before: "Old text", after: "New text" } },
	};

	function withSuggestion() {
		chat.state.messages = [
			QUESTION,
			{
				id: "a2",
				role: "assistant",
				parts: [
					{
						type: "tool-suggest_edit",
						toolCallId: "call-1",
						state: "output-available",
						input: {},
						output: SUGGESTION,
					},
				],
			},
		];
	}

	afterEach(() => {
		getCaseOutcomes("u1", "case-1").clear();
	});

	it("shows the card openly beside its collapsed tool row", () => {
		withSuggestion();
		renderWithoutProviders(<AssistantPanel {...CTX} canEdit />);

		expect(screen.getByTestId("assistant-tool-call")).toHaveTextContent(
			"Suggest an edit"
		);
		expect(screen.getByTestId("assistant-suggestion")).toHaveTextContent(
			"New text"
		);
	});

	it("keeps what the user did with a card, sends it with the next question, and forgets it on New chat", async () => {
		withSuggestion();
		renderWithoutProviders(<AssistantPanel {...CTX} canEdit />);

		await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
		expect(screen.getByRole("status")).toHaveTextContent("Dismissed");
		await userEvent.type(
			screen.getByLabelText("Message the assistant"),
			"And P2?{Enter}"
		);

		expect(chat.state.sendMessage).toHaveBeenCalledWith(
			{ text: "And P2?" },
			{
				body: {
					selectedElementId: "el-1",
					suggestionOutcomes: { "call-1": "dismissed" },
				},
			}
		);

		await userEvent.click(screen.getByRole("button", { name: "New chat" }));

		expect(getCaseOutcomes("u1", "case-1").snapshot()).toEqual({});
	});

	it("keeps the outcome when the panel is closed and opened again", async () => {
		withSuggestion();
		const view = renderWithoutProviders(<AssistantPanel {...CTX} canEdit />);
		await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
		view.unmount();

		renderWithoutProviders(<AssistantPanel {...CTX} canEdit />);

		expect(screen.getByRole("status")).toHaveTextContent("Dismissed");
		expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
	});
});
