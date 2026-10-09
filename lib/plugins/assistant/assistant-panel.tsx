"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
	type FormEvent,
	type KeyboardEvent,
	type ReactNode,
	useState,
} from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ABORT_NOTICE_PART } from "@/lib/plugins/assistant/abort-notice";
import { getCaseChat } from "@/lib/plugins/assistant/chat-store";
import { ToolCallRow } from "@/lib/plugins/assistant/tool-call-row";
import type { CaseSlotContext } from "@/lib/plugins/slots/index";

/** The route answers 409 when the provider, model, endpoint or key is not usable; its message says which. */
function notConfiguredMessage(error: Error): string | null {
	try {
		const body = JSON.parse(error.message) as { code?: string; error?: string };
		return body.code === "CONFLICT" ? (body.error ?? "Not configured.") : null;
	} catch {
		return null;
	}
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

const MARKDOWN_COMPONENTS = {
	a: ({ href, children }: { href?: string; children?: ReactNode }) => (
		<a
			className="underline"
			href={href}
			rel="noopener noreferrer"
			target="_blank"
		>
			{children}
		</a>
	),
	// Remote images would let a reply make the browser fetch an arbitrary URL.
	img: ({ alt }: { alt?: string }) => (alt ? <span>{alt}</span> : null),
};

/** Assistant text as markdown. Raw HTML is never rendered: it appears as text. */
function AssistantText({ text }: { text: string }) {
	return (
		<div className="space-y-2 break-words [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
			<ReactMarkdown components={MARKDOWN_COMPONENTS}>{text}</ReactMarkdown>
		</div>
	);
}

function MessagePartView({
	part,
	role,
}: {
	part: MessagePart;
	role: UIMessage["role"];
}) {
	if (part.type === ABORT_NOTICE_PART) {
		return (
			<p className="text-destructive text-sm" role="alert">
				The model did not answer in time. Try again or ask something shorter.
			</p>
		);
	}
	if (part.type !== "text") {
		return <ToolCallRow part={part} />;
	}
	if (role === "assistant") {
		return <AssistantText text={part.text} />;
	}
	return <p className="whitespace-pre-wrap break-words">{part.text}</p>;
}

function ErrorNotice({ error }: { error: Error }) {
	const notConfigured = notConfiguredMessage(error);
	if (notConfigured) {
		return (
			<div
				className="rounded-md border border-dashed p-3 text-sm"
				data-testid="assistant-not-configured"
			>
				<p>{notConfigured}</p>
				<p className="mt-1">
					<Link className="underline" href="/dashboard/settings/plugins">
						Open plugin settings
					</Link>
				</p>
			</div>
		);
	}
	return (
		<p className="text-destructive text-sm" role="alert">
			The assistant could not answer. Try again.
		</p>
	);
}

/** The case assistant's chat: messages, tool calls as collapsible rows, and a prompt box. Messages live in a per-user, per-case module store, so closing the sheet keeps them. The chat is built only once the session is known, so no entry is ever keyed to an unknown user. */
export function AssistantPanel(context: CaseSlotContext) {
	const { data: session, status } = useSession();
	const userId = session?.user?.id;
	if (status !== "authenticated" || !userId) {
		return null;
	}
	return <AssistantChat {...context} userId={userId} />;
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
	const [draft, setDraft] = useState("");
	const busy = status === "submitted" || status === "streaming";

	function submit() {
		const text = draft.trim();
		if (!text || busy) {
			return;
		}
		setDraft("");
		sendMessage({ text }, { body: { selectedElementId } });
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
			<div
				className="flex-1 space-y-3 overflow-y-auto"
				data-testid="assistant-messages"
			>
				{messages.length === 0 && (
					<p className="text-muted-foreground text-sm">
						Ask a question about this case. The assistant reads it to answer and
						never changes it.
					</p>
				)}
				{messages.map((message) => (
					<div
						className={
							message.role === "user"
								? "ml-6 rounded-md bg-primary/10 p-2 text-sm"
								: "space-y-2 text-sm"
						}
						data-testid={`assistant-message-${message.role}`}
						key={message.id}
					>
						{keyedParts(message.parts).map(({ key, part }) => (
							<MessagePartView key={key} part={part} role={message.role} />
						))}
					</div>
				))}
				{error && <ErrorNotice error={error} />}
			</div>
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
						onClick={() => stop()}
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
