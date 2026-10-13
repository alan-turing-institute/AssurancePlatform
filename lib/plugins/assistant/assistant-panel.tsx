"use client";

import { useChat } from "@ai-sdk/react";
import { isToolUIPart, type UIMessage } from "ai";
import { Bot } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
	type FormEvent,
	type KeyboardEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	Conversation,
	ConversationContent,
	ConversationEmptyState,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
	Message,
	MessageContent,
	MessageResponse,
} from "@/components/ai-elements/message";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Textarea } from "@/components/ui/textarea";
import {
	ERROR_REASON_PART,
	NOTICE_PART,
	noticeText,
	SILENT_REPLY_NOTICE,
} from "@/lib/plugins/assistant/abort-notice";
import { getCaseChat } from "@/lib/plugins/assistant/chat-store";
import { REPLY_MARKDOWN_PROPS } from "@/lib/plugins/assistant/reply-markdown";
import {
	markReplyStopped,
	silentReplyIds,
} from "@/lib/plugins/assistant/silent-reply";
import { suggestedPrompts } from "@/lib/plugins/assistant/suggested-prompts";
import { ToolCallRow } from "@/lib/plugins/assistant/tool-call-row";
import { useAssistantTools } from "@/lib/plugins/assistant/use-assistant-tools";
import { showWaitingLine } from "@/lib/plugins/assistant/waiting-state";
import type { CaseSlotContext } from "@/lib/plugins/slots/index";

/** The route answers 409 when the user's chat job is missing or its connection cannot be used; its message says which. */
function notConfiguredMessage(error: Error): string | null {
	try {
		const body = JSON.parse(error.message) as { code?: string; error?: string };
		return body.code === "CONFLICT" ? (body.error ?? "Not configured.") : null;
	} catch {
		return null;
	}
}

const MAX_REASON_CHARS = 300;

/** A reason as plain text of a short length; null when it is not text or says nothing. */
function shortReason(reason: unknown): string | null {
	if (typeof reason !== "string" || reason.trim() === "") {
		return null;
	}
	const text = reason.trim();
	return text.length > MAX_REASON_CHARS
		? `${text.slice(0, MAX_REASON_CHARS)}…`
		: text;
}

/**
 * The route's own message when the failed answer was TEA's JSON error. None
 * for anything else that can come back instead of a reply: a host's error
 * page, response text of another shape, or a network failure's message.
 */
function routeMessage(error: Error): string | null {
	try {
		const body: unknown = JSON.parse(error.message);
		return typeof body === "object" && body !== null && "error" in body
			? shortReason(body.error)
			: null;
	} catch {
		return null;
	}
}

/** The sentence for a reply that could not be answered, with its reason as plain text when there is one. */
function FailureNotice({ reason }: { reason: string | null }) {
	return (
		<div className="text-destructive text-sm" role="alert">
			<p>The assistant could not answer.{reason ? "" : " Try again."}</p>
			{reason && (
				<p className="mt-1 break-words" data-testid="assistant-error-reason">
					{reason}
				</p>
			)}
		</div>
	);
}

/** Whether the last message is a reply that carries the reason it failed, which is where that failure is shown. */
function endsWithFailedReply(messages: readonly UIMessage[]): boolean {
	const last = messages.at(-1);
	return (
		last?.role === "assistant" &&
		last.parts.some((part) => part.type === ERROR_REASON_PART)
	);
}

type MessagePart = UIMessage["parts"][number];

/** Parts carry no id of their own: tool parts are keyed by call id, others by type and how many of that type came before. */
function keyedParts(
	parts: MessagePart[]
): { key: string; part: MessagePart }[] {
	const seen = new Map<string, number>();
	return parts.map((part) => {
		if ("toolCallId" in part) {
			return { key: part.toolCallId, part };
		}
		const count = seen.get(part.type) ?? 0;
		seen.set(part.type, count + 1);
		return { key: `${part.type}:${count}`, part };
	});
}

/** The thinking steps of a reply that have text, joined into one text. Empty when the model sent none or sent them empty. */
function thinkingText(message: UIMessage): string {
	return message.parts
		.flatMap((part) =>
			part.type === "reasoning" && part.text.trim() !== "" ? [part.text] : []
		)
		.join("\n\n");
}

/** How many thinking steps the reply has had so far, counting ones still empty. */
function thinkingSteps(message: UIMessage): number {
	return message.parts.filter((part) => part.type === "reasoning").length;
}

function MessagePartView({
	part,
	replyEnded,
	role,
}: {
	part: MessagePart;
	replyEnded: boolean;
	role: UIMessage["role"];
}) {
	if (part.type === NOTICE_PART) {
		return (
			<p className="text-destructive text-sm" role="alert">
				{noticeText(part.data)}
			</p>
		);
	}
	if (part.type === ERROR_REASON_PART) {
		return <FailureNotice reason={shortReason(part.data)} />;
	}
	if (part.type === "text") {
		return role === "assistant" ? (
			<MessageResponse {...REPLY_MARKDOWN_PROPS}>{part.text}</MessageResponse>
		) : (
			part.text
		);
	}
	return isToolUIPart(part) ? (
		<ToolCallRow part={part} replyEnded={replyEnded} />
	) : null;
}

function MessageView({
	message,
	replyEnded,
	silent,
	thinking,
}: {
	message: UIMessage;
	/** The message is not the reply that is still arriving. */
	replyEnded: boolean;
	/** The reply finished with nothing to read. */
	silent: boolean;
	thinking: { steps: number; streaming: boolean; text: string };
}) {
	return (
		<ErrorBoundary
			fallback={
				<p
					className="text-destructive text-sm"
					data-testid="assistant-message-failed"
					role="alert"
				>
					This message could not be shown.
				</p>
			}
		>
			<Message
				data-testid={`assistant-message-${message.role}`}
				from={message.role}
			>
				<MessageContent
					className={
						message.role === "user" ? "whitespace-pre-wrap break-words" : ""
					}
				>
					{thinking.text && (
						<Reasoning
							data-testid="assistant-reasoning"
							isStreaming={thinking.streaming}
							key={thinking.steps}
						>
							<ReasoningTrigger />
							<ReasoningContent streamdownProps={REPLY_MARKDOWN_PROPS}>
								{thinking.text}
							</ReasoningContent>
						</Reasoning>
					)}
					{keyedParts(message.parts).map(({ key, part }) => (
						<MessagePartView
							key={key}
							part={part}
							replyEnded={replyEnded}
							role={message.role}
						/>
					))}
					{silent && (
						<p className="text-destructive text-sm" role="alert">
							{SILENT_REPLY_NOTICE}
						</p>
					)}
				</MessageContent>
			</Message>
		</ErrorBoundary>
	);
}

/** The notice for a failed request at the foot of the chat. A reply that failed shows its own reason, so nothing is added for it here. */
function ErrorNotice({
	error,
	messages,
}: {
	error: Error;
	messages: readonly UIMessage[];
}) {
	if (endsWithFailedReply(messages)) {
		return null;
	}
	const notConfigured = notConfiguredMessage(error);
	if (notConfigured) {
		return (
			<div
				className="rounded-md border border-dashed p-3 text-sm"
				data-testid="assistant-not-configured"
			>
				<p>{notConfigured}</p>
				<p className="mt-1">
					<Link
						className="underline"
						href="/dashboard/settings/plugins#ai-models"
					>
						Set up AI models
					</Link>
				</p>
			</div>
		);
	}
	return <FailureNotice reason={routeMessage(error)} />;
}

const INTRO_BASE =
	"The assistant reads this case to answer your questions and never changes it. It can check the case against the assurance-case rules.";
const INTRO_TECHNIQUES =
	" With an element selected, it can suggest techniques from the TEA Techniques library that could produce evidence for it.";
const INTRO_LIMIT = " It does not judge whether the case is good enough.";

/** The case assistant's chat: messages, tool calls as collapsible rows, and a prompt box. Messages live in a per-user, per-case module store, so closing the sheet keeps them. The chat is built only once the session is known, so no entry is ever keyed to an unknown user. */
export function AssistantPanel(context: CaseSlotContext) {
	const { data: session, status } = useSession();
	const userId = session?.user?.id;
	if (status !== "authenticated" || !userId) {
		return null;
	}
	return <AssistantChat {...context} userId={userId} />;
}

/**
 * A function that answers whether a message may go out now. It says yes once
 * until the chat is idle again: the claim is made as the message goes out,
 * before the chat reports that it is busy, so a second call in the same task
 * sends nothing. It is released after any render in which the chat is idle,
 * whether the reply finished or failed.
 */
function useSendClaim(busy: boolean): () => boolean {
	const claimed = useRef(false);
	useEffect(() => {
		if (!busy) {
			claimed.current = false;
		}
	});
	return () => {
		if (busy || claimed.current) {
			return false;
		}
		claimed.current = true;
		return true;
	};
}

function AssistantChat({
	caseId,
	selectedElementId,
	selectedElementLabel,
	userId,
}: CaseSlotContext & { userId: string }) {
	const { messages, sendMessage, status, stop, error } = useChat({
		chat: getCaseChat(userId, caseId),
	});
	const tools = useAssistantTools(caseId);
	const [draft, setDraft] = useState("");
	const busy = status === "submitted" || status === "streaming";
	const { prompts, mentionsTechniques } = suggestedPrompts({
		tools: tools ?? [],
		selected: Boolean(selectedElementId),
		label: selectedElementLabel,
	});
	const lastId = messages.at(-1)?.id;
	const claimSend = useSendClaim(busy);
	const silentIds = silentReplyIds(messages, status, error);

	function send(text: string) {
		if (!claimSend()) {
			return;
		}
		sendMessage({ text }, { body: { selectedElementId } });
	}

	function submit() {
		const text = draft.trim();
		if (!text || busy) {
			return;
		}
		setDraft("");
		send(text);
	}

	function onSubmit(event: FormEvent) {
		event.preventDefault();
		submit();
	}

	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			submit();
		}
	}

	return (
		<div
			className="flex flex-col gap-3"
			style={{ height: "calc(100vh - 8rem)" }}
		>
			<p
				className="text-muted-foreground text-sm"
				data-testid="assistant-selection"
			>
				{selectedElementId
					? `Selected: ${selectedElementLabel || "an element"}`
					: "No element selected"}
			</p>
			<Conversation>
				<ConversationContent data-testid="assistant-messages">
					{messages.length === 0 && (
						<ConversationEmptyState
							data-testid="assistant-intro"
							description={`${INTRO_BASE}${mentionsTechniques ? INTRO_TECHNIQUES : ""}${INTRO_LIMIT}`}
							icon={<Bot className="size-6" />}
							title="Ask about this case"
						/>
					)}
					{messages.map((message) => (
						<MessageView
							key={message.id}
							message={message}
							replyEnded={!busy || message.id !== lastId}
							silent={silentIds.has(message.id)}
							thinking={{
								steps: thinkingSteps(message),
								streaming:
									status === "streaming" &&
									message.id === lastId &&
									message.parts.at(-1)?.type === "reasoning",
								text: thinkingText(message),
							}}
						/>
					))}
					{showWaitingLine(status, messages) && (
						<output>
							<Shimmer as="span">Thinking…</Shimmer>
						</output>
					)}
					{error && <ErrorNotice error={error} messages={messages} />}
				</ConversationContent>
				<ConversationScrollButton aria-label="Scroll to the latest message" />
			</Conversation>
			{messages.length === 0 && prompts.length > 0 && (
				<Suggestions
					className="w-full flex-wrap"
					data-testid="assistant-suggestions"
				>
					{prompts.map((prompt) => (
						<Suggestion
							className="h-auto max-w-full whitespace-normal py-1.5 text-left"
							key={prompt}
							onClick={send}
							suggestion={prompt}
						/>
					))}
				</Suggestions>
			)}
			<form className="flex items-end gap-2" onSubmit={onSubmit}>
				<Textarea
					aria-label="Message the assistant"
					className="min-h-16 flex-1"
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={onKeyDown}
					placeholder="Ask about this case"
					value={draft}
				/>
				{busy && (
					<Button
						key="stop"
						onClick={() => {
							markReplyStopped(lastId);
							stop();
						}}
						type="button"
						variant="outline"
					>
						Stop
					</Button>
				)}
				{!busy && (
					<Button disabled={!draft.trim()} key="send" type="submit">
						Send
					</Button>
				)}
			</form>
		</div>
	);
}
