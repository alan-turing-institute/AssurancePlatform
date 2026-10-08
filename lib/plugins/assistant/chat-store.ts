import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";

const chats = new Map<string, Chat<UIMessage>>();

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
			transport: new DefaultChatTransport({
				api: `/api/cases/${encodeURIComponent(caseId)}/assistant`,
			}),
		});
		chats.set(key, chat);
	}
	return chat;
}
