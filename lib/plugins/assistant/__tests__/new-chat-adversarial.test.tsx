import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCaseChat } from "@/lib/plugins/assistant/chat-store";
import {
	act,
	fireEvent,
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { AssistantPanel } from "../assistant-panel";

/**
 * The real chat store and the real `useChat` run here; only the network is
 * replaced. Each request to the chat route is held open so a test decides
 * when and how it is answered, and whether the browser's cancel reaches it.
 */

const session = vi.hoisted(() => ({
	value: { data: { user: { id: "u" } }, status: "authenticated" } as {
		data: { user: { id: string } } | null;
		status: string;
	},
}));
const TOOLS = vi.hoisted(() => ["read_case", "read_element", "lint_case"]);

vi.mock("next-auth/react", () => ({ useSession: () => session.value }));
vi.mock("@/lib/plugins/assistant/use-assistant-tools", () => ({
	useAssistantTools: () => TOOLS,
}));

interface SentBody {
	messages: { role: string; parts: { type: string; text?: string }[] }[];
	selectedElementId?: string;
}

interface Call {
	body: SentBody;
	caseId: string;
	/** Sends one event on the reply, answering first if the request has not been answered. */
	emit: (event: object) => void;
	/** Finishes the reply's stream. */
	end: () => void;
	/** Answers with a failure status and a JSON body, as the route does. */
	fail: (status: number, body: object) => void;
	/** Answers with response headers and an open event stream, which stays silent until `emit`. */
	respond: () => void;
	signal: AbortSignal;
}

const calls: Call[] = [];
let cancelReachesNetwork = true;
const encoder = new TextEncoder();

function chatRoute(url: string, init: RequestInit): Promise<Response> {
	const signal = init.signal as AbortSignal;
	const caseId = decodeURIComponent(url.split("/")[3] ?? "");
	const reachesNetwork = cancelReachesNetwork;
	return new Promise<Response>((resolve, reject) => {
		let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
		const stream = new ReadableStream<Uint8Array>({
			start(c) {
				controller = c;
			},
		});
		let answered = false;
		const write = (text: string) => {
			try {
				controller?.enqueue(encoder.encode(text));
			} catch {
				// The reader has gone, so the text never arrives.
			}
		};
		const respond = () => {
			answered = true;
			resolve(
				new Response(stream, {
					headers: { "Content-Type": "text/event-stream" },
				})
			);
		};
		signal.addEventListener("abort", () => {
			if (!reachesNetwork) {
				return;
			}
			const cancelled = new DOMException(
				"The operation was aborted.",
				"AbortError"
			);
			if (!answered) {
				reject(cancelled);
				return;
			}
			try {
				controller?.error(cancelled);
			} catch {
				// The stream had already ended.
			}
		});
		calls.push({
			body: JSON.parse(String(init.body)) as SentBody,
			caseId,
			respond,
			signal,
			emit(event) {
				if (!answered) {
					respond();
				}
				write(`data: ${JSON.stringify(event)}\n\n`);
			},
			end() {
				if (!answered) {
					respond();
				}
				write("data: [DONE]\n\n");
				try {
					controller?.close();
				} catch {
					// The stream had already ended.
				}
			},
			fail(status, body) {
				answered = true;
				resolve(
					new Response(JSON.stringify(body), {
						headers: { "Content-Type": "application/json" },
						status,
					})
				);
			},
		});
	});
}

const words = (id: string, delta: string) => ({
	delta,
	id: `${id}-text`,
	type: "text-delta",
});

function startReply(call: Call, id: string, firstWords: string) {
	call.emit({ messageId: id, type: "start" });
	call.emit({ id: `${id}-text`, type: "text-start" });
	call.emit(words(id, firstWords));
}

function finishReply(call: Call, id: string) {
	call.emit({ id: `${id}-text`, type: "text-end" });
	call.emit({ type: "finish" });
	call.end();
}

function answer(call: Call, id: string, text: string) {
	startReply(call, id, text);
	finishReply(call, id);
}

/** Runs an action, then lets the stream and React catch up. */
async function deliver(action: () => void = () => undefined) {
	await act(async () => {
		action();
		await new Promise((resolve) => setTimeout(resolve, 10));
	});
}

async function settle() {
	for (let i = 0; i < 3; i++) {
		await deliver();
	}
}

async function callAt(index: number): Promise<Call> {
	await waitFor(() => expect(calls.length).toBeGreaterThan(index));
	return calls[index] as Call;
}

async function callFor(caseId: string): Promise<Call> {
	await waitFor(() =>
		expect(calls.some((c) => c.caseId === caseId)).toBe(true)
	);
	return calls.find((c) => c.caseId === caseId) as Call;
}

const FIRST_WORDS = /First words/;
const LATER_WORDS = /Later words/;
const LATE_WORDS = /Late words/;
const LATE_REPLY = /Late reply/;
const SECOND_ANSWER = /Second answer/;
const SECOND_ANSWER_OR_MORE = /Second answer|More\./;

let counter = 0;
function freshIds() {
	counter += 1;
	return { caseId: `case-${counter}`, userId: `user-${counter}` };
}

const panel = (caseId: string) => (
	<AssistantPanel
		canEdit={false}
		caseId={caseId}
		selectedElementId="el-1"
		selectedElementLabel="G1"
	/>
);

function mount(ids = freshIds()) {
	session.value = {
		data: { user: { id: ids.userId } },
		status: "authenticated",
	};
	const view = renderWithoutProviders(panel(ids.caseId));
	// Looked up each time, so a test follows the store whichever way it clears a chat.
	return { ...ids, ...view, chat: () => getCaseChat(ids.userId, ids.caseId) };
}

const newChat = () => screen.getByRole("button", { name: "New chat" });
const messageBox = () => screen.getByLabelText("Message the assistant");

async function ask(text: string) {
	await userEvent.type(messageBox(), `${text}{Enter}`);
}

function seeded(id: string, role: "user" | "assistant", text: string) {
	return { id, parts: [{ text, type: "text" }], role } as UIMessage;
}

const sentTexts = (call: Call) =>
	call.body.messages.map((m) => m.parts.map((p) => p.text ?? "").join(""));

beforeEach(() => {
	calls.length = 0;
	cancelReachesNetwork = true;
	vi.stubGlobal("fetch", chatRoute);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("New chat on the real chat", () => {
	it("is disabled while the chat is empty and enabled as soon as a message is sent", async () => {
		mount();
		expect(newChat()).toBeDisabled();

		await ask("What does G1 claim?");

		await waitFor(() => expect(newChat()).toBeEnabled());
	});

	it("empties a finished conversation and brings back the intro and suggested prompts", async () => {
		const { chat } = mount();
		await ask("What does G1 claim?");
		await deliver(() => answer(calls[0] as Call, "a1", "G1 claims safety."));
		await screen.findByText("G1 claims safety.");
		expect(screen.queryByTestId("assistant-suggestions")).toBeNull();

		await userEvent.click(newChat());

		expect(screen.queryByTestId("assistant-message-user")).toBeNull();
		expect(screen.queryByTestId("assistant-message-assistant")).toBeNull();
		expect(screen.queryByText("G1 claims safety.")).toBeNull();
		expect(screen.getByTestId("assistant-intro")).toBeInTheDocument();
		expect(screen.getByTestId("assistant-suggestions")).toBeInTheDocument();
		expect(newChat()).toBeDisabled();
		expect(chat().messages).toEqual([]);
	});

	it("stops a reply that is arriving, and none of its later text appears", async () => {
		const { chat } = mount();
		await ask("What does G1 claim?");
		const call = await callAt(0);
		await deliver(() => startReply(call, "a1", "First words. "));
		await screen.findByText(FIRST_WORDS);

		await userEvent.click(newChat());
		expect(call.signal.aborted).toBe(true);
		await deliver(() => {
			call.emit(words("a1", "Later words."));
			finishReply(call, "a1");
		});
		await settle();

		expect(screen.queryByText(FIRST_WORDS)).toBeNull();
		expect(screen.queryByText(LATER_WORDS)).toBeNull();
		expect(chat().messages).toEqual([]);
		expect(chat().status).toBe("ready");
		expect(screen.getByTestId("assistant-intro")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
		expect(screen.queryByText("Thinking…")).toBeNull();
	});

	it("drops text that was already on its way when the button is pressed", async () => {
		const { chat } = mount();
		await ask("What does G1 claim?");
		const call = await callAt(0);
		await deliver(() => startReply(call, "a1", "First words. "));
		await screen.findByText(FIRST_WORDS);

		// The chunk is queued but has not been read: nothing runs between the next
		// two lines, so the press comes first.
		call.emit(words("a1", "Late words."));
		fireEvent.click(newChat());
		await settle();

		expect(screen.queryByText(LATE_WORDS)).toBeNull();
		expect(screen.queryByText(FIRST_WORDS)).toBeNull();
		expect(chat().messages).toEqual([]);
		expect(chat().status).toBe("ready");
	});

	it.each([
		["the browser cancels the request", "cancel"],
		["a reply arrives anyway", "reply"],
		["a not-configured answer arrives anyway", "conflict"],
	])("clears a message still waiting for its first byte when %s", async (_name, outcome) => {
		cancelReachesNetwork = outcome === "cancel";
		const { chat } = mount();
		await ask("What does G1 claim?");
		const call = await callAt(0);
		await waitFor(() => expect(chat().status).toBe("submitted"));

		await userEvent.click(newChat());
		expect(call.signal.aborted).toBe(true);
		if (outcome === "reply") {
			await deliver(() => answer(call, "a1", "Late reply."));
		}
		if (outcome === "conflict") {
			await deliver(() =>
				call.fail(409, { code: "CONFLICT", error: "No chat model is set up." })
			);
		}
		await settle();

		expect(chat().messages).toEqual([]);
		expect(chat().status).toBe("ready");
		expect(chat().error).toBeUndefined();
		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.queryByText(LATE_REPLY)).toBeNull();
		expect(screen.getByTestId("assistant-intro")).toBeInTheDocument();
		await ask("A second question");
		const next = await callAt(1);
		expect(sentTexts(next)).toEqual(["A second question"]);
	});

	it("stays empty when the panel is closed and opened again, even with text still arriving", async () => {
		const ids = freshIds();
		let view = mount(ids);
		await ask("First question");
		await deliver(() => answer(calls[0] as Call, "a1", "First answer."));
		await screen.findByText("First answer.");
		await userEvent.click(newChat());
		view.unmount();

		view = mount(ids);

		expect(screen.getByTestId("assistant-intro")).toBeInTheDocument();
		expect(screen.queryByText("First answer.")).toBeNull();

		await ask("Second question");
		const second = await callAt(1);
		await deliver(() => startReply(second, "a2", "Second answer. "));
		await screen.findByText(SECOND_ANSWER);
		second.emit(words("a2", "More."));
		fireEvent.click(newChat());
		view.unmount();
		await settle();

		view = mount(ids);

		expect(screen.getByTestId("assistant-intro")).toBeInTheDocument();
		expect(screen.queryByText(SECOND_ANSWER_OR_MORE)).toBeNull();
		expect(view.chat().messages).toEqual([]);
	});

	it("sends a draft that was kept through New chat with no earlier turns, from the focused message box", async () => {
		const { chat } = mount();
		await ask("First question");
		await deliver(() => answer(calls[0] as Call, "a1", "First answer."));
		await screen.findByText("First answer.");
		await userEvent.type(messageBox(), "half-typed question");

		await userEvent.click(newChat());

		expect(messageBox()).toHaveValue("half-typed question");
		expect(messageBox()).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		const next = await callAt(1);
		expect(sentTexts(next)).toEqual(["half-typed question"]);
		expect(next.body.selectedElementId).toBe("el-1");
		expect(chat().messages.map((m) => m.role)).toEqual(["user"]);
	});

	it("sends a suggested prompt with no earlier turns, and the new conversation then carries on", async () => {
		mount();
		await ask("First question");
		await deliver(() => answer(calls[0] as Call, "a1", "First answer."));
		await screen.findByText("First answer.");
		await userEvent.click(newChat());

		await userEvent.click(
			await screen.findByText("Check this case against the rules")
		);
		const second = await callAt(1);
		expect(sentTexts(second)).toEqual(["Check this case against the rules"]);
		await deliver(() => answer(second, "a2", "Nothing to flag."));
		await screen.findByText("Nothing to flag.");
		await ask("And the evidence?");

		const third = await callAt(2);
		expect(sentTexts(third)).toEqual([
			"Check this case against the rules",
			"Nothing to flag.",
			"And the evidence?",
		]);
		expect(JSON.stringify(third.body)).not.toContain("First");
	});

	it.each([
		[
			"a not-configured answer",
			409,
			{ code: "CONFLICT", error: "No chat model is set up." },
			"assistant-not-configured",
		],
		[
			"a provider failure",
			502,
			{ error: "The provider rejected the request." },
			"assistant-error-reason",
		],
	])("clears the notice for %s along with the messages", async (_name, status, body, testId) => {
		const { chat } = mount();
		await ask("What does G1 claim?");
		await deliver(() => (calls[0] as Call).fail(status, body));
		await screen.findByTestId(testId);

		await userEvent.click(newChat());

		expect(screen.queryByTestId(testId)).toBeNull();
		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.getByTestId("assistant-intro")).toBeInTheDocument();
		expect(chat().error).toBeUndefined();
		expect(chat().status).toBe("ready");
		await ask("Try again");
		const retry = await callAt(1);
		expect(sentTexts(retry)).toEqual(["Try again"]);
		await deliver(() => answer(retry, "a2", "Here is the answer."));
		expect(await screen.findByText("Here is the answer.")).toBeInTheDocument();
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("keeps working after repeated presses, including one in the middle of a second reply", async () => {
		const { chat } = mount();
		await ask("First question");
		await deliver(() => answer(calls[0] as Call, "a1", "First answer."));
		await screen.findByText("First answer.");
		const button = newChat();
		fireEvent.click(button);
		fireEvent.click(button);
		expect(chat().messages).toEqual([]);

		await ask("Second question");
		const second = await callAt(1);
		await deliver(() => startReply(second, "a2", "Second answer. "));
		await screen.findByText(SECOND_ANSWER);
		await userEvent.click(newChat());
		expect(second.signal.aborted).toBe(true);
		await settle();
		await ask("Third question");

		const third = await callAt(2);
		expect(sentTexts(third)).toEqual(["Third question"]);
		await deliver(() => answer(third, "a3", "Third answer."));
		await screen.findByText("Third answer.");
		expect(screen.queryByText(SECOND_ANSWER)).toBeNull();
		expect(chat().messages.map((m) => m.role)).toEqual(["user", "assistant"]);
	});

	it("leaves the chats of other cases and other users alone, including a reply still arriving", async () => {
		const mine = freshIds();
		const otherCase = getCaseChat(mine.userId, `${mine.caseId}-b`);
		const otherUser = getCaseChat(`${mine.userId}-b`, mine.caseId);
		const live = getCaseChat(mine.userId, `${mine.caseId}-c`);
		otherCase.messages = [
			seeded("b1", "user", "Question on b"),
			seeded("b2", "assistant", "Answer on b"),
		];
		otherUser.messages = [
			seeded("u1", "user", "Question by another user"),
			seeded("u2", "assistant", "Answer to another user"),
		];
		const otherCaseBefore = structuredClone(otherCase.messages);
		const otherUserBefore = structuredClone(otherUser.messages);
		const liveSend = live.sendMessage({ text: "Question on c" });
		const liveCall = await callFor(`${mine.caseId}-c`);
		await deliver(() => startReply(liveCall, "c1", "Still "));
		mount(mine);
		await ask("Question on mine");
		await deliver(() => answer(calls.at(-1) as Call, "m1", "Answer on mine."));
		await screen.findByText("Answer on mine.");

		await userEvent.click(newChat());
		await deliver(() => liveCall.emit(words("c1", "arriving.")));

		expect(otherCase.messages).toEqual(otherCaseBefore);
		expect(otherUser.messages).toEqual(otherUserBefore);
		expect(liveCall.signal.aborted).toBe(false);
		expect(live.status).toBe("streaming");
		expect(JSON.stringify(live.messages.at(-1))).toContain("Still arriving.");
		await deliver(() => finishReply(liveCall, "c1"));
		await liveSend;
	});

	it("clears the chat of the case the panel now shows when it moves to another case", async () => {
		const first = freshIds();
		const secondCase = `${first.caseId}-b`;
		const firstChat = getCaseChat(first.userId, first.caseId);
		const secondChat = getCaseChat(first.userId, secondCase);
		firstChat.messages = [seeded("f1", "user", "Question on the first case")];
		secondChat.messages = [seeded("s1", "user", "Question on the second case")];
		const view = mount(first);
		await screen.findByText("Question on the first case");

		view.rerender(panel(secondCase));
		await screen.findByText("Question on the second case");
		await userEvent.click(newChat());

		expect(secondChat.messages).toEqual([]);
		expect(firstChat.messages).toHaveLength(1);
		expect(screen.getByTestId("assistant-intro")).toBeInTheDocument();
	});

	it("sends no earlier turns when Send and New chat are pressed in the same instant", async () => {
		const { chat } = mount();
		await ask("First question");
		await deliver(() => answer(calls[0] as Call, "a1", "First answer."));
		await screen.findByText("First answer.");
		await userEvent.type(messageBox(), "Second question");

		// Neither press has given the chat a chance to report that it is busy.
		fireEvent.keyDown(messageBox(), { key: "Enter" });
		fireEvent.click(newChat());
		const second = await callAt(1);
		await deliver(() => answer(second, "a2", "Second answer."));
		await settle();

		expect(JSON.stringify(second.body)).not.toContain("First");
		expect(chat().status).toBe("ready");
		await ask("Third question");
		const third = await callAt(2);
		expect(JSON.stringify(third.body)).not.toContain("First");
		expect(sentTexts(third).at(-1)).toBe("Third question");
	});
});
