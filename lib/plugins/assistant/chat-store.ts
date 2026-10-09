import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage, type UIMessageChunk } from "ai";

import { ABORT_NOTICE_PART } from "@/lib/plugins/assistant/abort-notice";

const chats = new Map<string, Chat<UIMessage>>();

/**
 * The client ignores a stream's `abort` event, so a model call cancelled by
 * its time limit would leave an empty reply. This turns the event into a
 * notice part on the message.
 */
class AssistantChatTransport extends DefaultChatTransport<UIMessage> {
	protected override processResponseStream(
		stream: ReadableStream<Uint8Array>
	): ReadableStream<UIMessageChunk> {
		return super.processResponseStream(stream).pipeThrough(
			new TransformStream<UIMessageChunk, UIMessageChunk>({
				transform(chunk, controller) {
					if (chunk.type === "abort") {
						controller.enqueue({
							type: ABORT_NOTICE_PART,
							data: "timeout",
						} as UIMessageChunk);
					}
					controller.enqueue(chunk);
				},
			})
		);
	}
}

/**
 * One chat per user and case, held at module level so its messages (and any
 * reply still streaming) survive the sheet closing and its component
 * unmounting. Keying by user as well means a different user signing in
 * without a page reload starts with an empty chat.
 */
export function getCaseChat(userId: string, caseId: string): Chat<UIMessage> {
	const key = `${userId}:${caseId}`;
	let chat = chats.get(key);
	if (!chat) {
		chat = new Chat<UIMessage>({
			transport: new AssistantChatTransport({
				api: `/api/cases/${encodeURIComponent(caseId)}/assistant`,
			}),
		});
		chats.set(key, chat);
	}
	return chat;
}
