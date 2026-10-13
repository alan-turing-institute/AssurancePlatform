import type { ChatStatus, UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { showWaitingLine } from "../waiting-state";

function user(): UIMessage {
	return { id: "u", role: "user", parts: [{ type: "text", text: "Hi" }] };
}

function assistant(...parts: unknown[]): UIMessage {
	return { id: "a", role: "assistant", parts: parts as UIMessage["parts"] };
}

function tool(state: string, id = "t1") {
	return { type: "tool-read_case", toolCallId: id, state, input: {} };
}

const STEP = { type: "step-start" };

function waiting(status: ChatStatus, ...messages: UIMessage[]) {
	return showWaitingLine(status, messages);
}

describe("showWaitingLine", () => {
	it.each([
		"ready",
		"error",
	] as const)("is hidden when the chat is %s", (status) => {
		expect(waiting(status, user())).toBe(false);
	});

	it("is shown while the request is submitted, whatever the last message", () => {
		expect(waiting("submitted", user())).toBe(true);
		expect(waiting("submitted", user(), assistant(STEP))).toBe(true);
	});

	it("is shown while the last message is the user's", () => {
		expect(waiting("streaming", user())).toBe(true);
	});

	it("is shown for a reply that has shown nothing yet", () => {
		expect(waiting("streaming", user(), assistant(STEP))).toBe(true);
		expect(
			waiting(
				"streaming",
				user(),
				assistant(STEP, { type: "reasoning", text: "", state: "streaming" })
			)
		).toBe(true);
	});

	it("is hidden while thinking or text is arriving", () => {
		expect(
			waiting(
				"streaming",
				user(),
				assistant({ type: "reasoning", text: "Let me", state: "streaming" })
			)
		).toBe(false);
		expect(
			waiting(
				"streaming",
				user(),
				assistant({ type: "text", text: "G1", state: "streaming" })
			)
		).toBe(false);
	});

	it("is hidden under finished text even while the reply is still open", () => {
		expect(
			waiting(
				"streaming",
				user(),
				assistant({ type: "text", text: "Done.", state: "done" })
			)
		).toBe(false);
		expect(
			waiting("streaming", user(), assistant({ type: "text", text: "Done." }))
		).toBe(false);
	});

	it("is hidden under finished thinking", () => {
		expect(
			waiting(
				"streaming",
				user(),
				assistant({ type: "reasoning", text: "Hmm", state: "done" })
			)
		).toBe(false);
	});

	it.each([
		"input-streaming",
		"input-available",
	])("is hidden while a tool is %s", (state) => {
		expect(waiting("streaming", user(), assistant(tool(state)))).toBe(false);
	});

	it.each([
		"output-available",
		"output-error",
		"output-denied",
	])("is shown after a tool call that ended with %s", (state) => {
		expect(waiting("streaming", user(), assistant(tool(state)))).toBe(true);
	});

	it("is hidden while a second tool runs after the first finished", () => {
		expect(
			waiting(
				"streaming",
				user(),
				assistant(tool("output-available", "t1"), tool("input-available", "t2"))
			)
		).toBe(false);
	});

	it("is hidden while the first of two tools is still running and the second has finished", () => {
		expect(
			waiting(
				"streaming",
				user(),
				assistant(tool("input-available", "t1"), tool("output-available", "t2"))
			)
		).toBe(false);
	});

	it("is shown after a tool when a step marker follows it", () => {
		expect(
			waiting("streaming", user(), assistant(tool("output-available"), STEP))
		).toBe(true);
	});

	it("is hidden under the timeout notice", () => {
		expect(
			waiting(
				"streaming",
				user(),
				assistant(tool("output-available"), {
					type: "data-notice",
					data: "timeout",
				})
			)
		).toBe(false);
	});
});
