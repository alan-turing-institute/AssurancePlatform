import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseChat } from "@/lib/plugins/assistant/chat-store";

function sse(...events: unknown[]) {
	const body = [...events.map((e) => JSON.stringify(e)), "[DONE]"]
		.map((data) => `data: ${data}\n\n`)
		.join("");
	return new Response(body, {
		headers: { "Content-Type": "text/event-stream" },
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("getCaseChat stream handling", () => {
	it("turns an abort event from the server into a notice part on the reply", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				sse(
					{ type: "start" },
					{
						type: "abort",
						reason: "The operation was aborted due to timeout",
					}
				)
			)
		);
		const chat = getCaseChat("abort-user", "abort-case");

		await chat.sendMessage({ text: "hello" });

		const reply = chat.messages.at(-1);
		expect(reply?.role).toBe("assistant");
		expect(reply?.parts.map((p) => p.type)).toContain("data-notice");
		expect(chat.status).toBe("ready");
	});
});
