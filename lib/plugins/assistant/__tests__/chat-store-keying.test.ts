import { describe, expect, it } from "vitest";
import { getCaseChat } from "@/lib/plugins/assistant/chat-store";

const MESSAGE = {
	id: "m1",
	role: "user" as const,
	parts: [{ type: "text" as const, text: "hello" }],
};

describe("getCaseChat", () => {
	it("returns the same chat, with its messages, when asked again for the same user and case", () => {
		const first = getCaseChat("keying-user-a", "keying-case-1");
		first.messages = [MESSAGE];
		const again = getCaseChat("keying-user-a", "keying-case-1");
		expect(again).toBe(first);
		expect(again.messages).toHaveLength(1);
	});

	it("gives a different user an empty chat for the same case", () => {
		getCaseChat("keying-user-b", "keying-case-2").messages = [MESSAGE];
		const other = getCaseChat("keying-user-c", "keying-case-2");
		expect(other.messages).toHaveLength(0);
	});

	it("gives the same user an empty chat for a different case", () => {
		getCaseChat("keying-user-d", "keying-case-3").messages = [MESSAGE];
		expect(getCaseChat("keying-user-d", "keying-case-4").messages).toHaveLength(
			0
		);
	});
});
