import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { NOTICE_PART } from "../abort-notice";
import { markReplyStopped, silentReplyIds } from "../silent-reply";

type Parts = UIMessage["parts"];

const text = (value: string) => ({ type: "text", text: value });

/** A message with the given id and role; every id in this file is its own, because the stopped replies are kept for the whole run. */
function message(id: string, role: UIMessage["role"], ...parts: unknown[]) {
	return { id, role, parts: parts as Parts } satisfies UIMessage;
}

const silentIds = (
	messages: UIMessage[],
	status: Parameters<typeof silentReplyIds>[1] = "ready",
	error?: Error
) => [...silentReplyIds(messages, status, error)];

describe("silentReplyIds", () => {
	it.each([
		["no parts", []],
		["empty text", [text("")]],
		["text of spaces and line breaks", [text("  \n\t ")]],
		["only a step marker", [{ type: "step-start" }]],
	])("reports a reply with %s", (_name, parts) => {
		expect(silentIds([message("silent-a", "assistant", ...parts)])).toEqual([
			"silent-a",
		]);
	});

	it.each([
		["answer text", [text("Hello")]],
		["answer text padded with spaces", [text("  Hello  ")]],
		["a notice", [{ type: NOTICE_PART, data: "length" }]],
	])("does not report a reply with %s", (_name, parts) => {
		expect(silentIds([message("answered-a", "assistant", ...parts)])).toEqual(
			[]
		);
	});

	it("never reports the user's own messages", () => {
		expect(
			silentIds([
				message("user-a", "user"),
				message("user-b", "user", text("  ")),
			])
		).toEqual([]);
	});

	it("reports every finished silent reply, in order, and leaves out the answered ones", () => {
		const messages = [
			message("order-1", "assistant"),
			message("order-2", "assistant", text("An answer")),
			message("order-3", "assistant", text(" ")),
		];

		expect(silentIds(messages)).toEqual(["order-1", "order-3"]);
	});

	it("leaves out the last reply until the chat is idle without an error, but reports earlier ones", () => {
		const messages = [
			message("last-1", "assistant"),
			message("last-2", "assistant"),
		];

		expect(silentIds(messages, "streaming")).toEqual(["last-1"]);
		expect(silentIds(messages, "submitted")).toEqual(["last-1"]);
		expect(silentIds(messages, "error")).toEqual(["last-1"]);
		expect(silentIds(messages, "ready", new Error("Failed"))).toEqual([
			"last-1",
		]);
		expect(silentIds(messages, "ready")).toEqual(["last-1", "last-2"]);
	});

	it("does not report a reply the user stopped", () => {
		markReplyStopped("stopped-a");
		const messages = [
			message("stopped-a", "assistant"),
			message("stopped-b", "assistant"),
		];

		expect(silentIds(messages)).toEqual(["stopped-b"]);
	});

	it("ignores a stop with no message id, and an empty one, so that a message with an empty id is still reported", () => {
		markReplyStopped(undefined);
		markReplyStopped("");

		expect(silentIds([message("", "assistant")])).toEqual([""]);
	});
});
