"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { type FormEvent, type KeyboardEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
					<Link className="underline" href="/settings/plugins">
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

/** The case assistant's chat: messages, tool calls as collapsible rows, and a prompt box. Messages live in a per-user, per-case module store, so closing the sheet keeps them. */
export function AssistantPanel({
	caseId,
	selectedElementId,
	selectedElementLabel,
}: CaseSlotContext) {
	const { data: session } = useSession();
	const { messages, sendMessage, status, stop, error } = useChat({
		chat: getCaseChat(session?.user?.id ?? "anonymous", caseId),
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
		<div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
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
						{keyedParts(message.parts).map(({ key, part }) =>
							part.type === "text" ? (
								<p className="whitespace-pre-wrap break-words" key={key}>
									{part.text}
								</p>
							) : (
								<ToolCallRow key={key} part={part} />
							)
						)}
					</div>
				))}
				{error && <ErrorNotice error={error} />}
			</div>
			<form className="flex items-end gap-2" onSubmit={onSubmit}>
				<Textarea
					aria-label="Message the assistant"
					className="min-h-[60px] flex-1"
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={onKeyDown}
					placeholder="Ask about this case"
					value={draft}
				/>
				{busy ? (
					<Button onClick={() => stop()} type="button" variant="outline">
						Stop
					</Button>
				) : (
					<Button disabled={!draft.trim()} type="submit">
						Send
					</Button>
				)}
			</form>
		</div>
	);
}
