import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml } from "../sanitize-html";

const HOSTILE_USERNAME = '"><img src=x onerror=alert(1)>';
const RESET_TOKEN = "reset-token";
const DELETION_DATE = new Date("2026-01-01T00:00:00Z");

type EmailServiceModule = typeof import("../services/email-service");

/**
 * One row per sender. `send` invokes that sender with minimal valid args
 * (a fixed `to`, the given `username`) against a dynamically-imported
 * module instance, so each test exercises its own sender.
 */
const SENDERS: {
	name: string;
	send: (mod: EmailServiceModule, username: string) => Promise<unknown>;
}[] = [
	{
		name: "sendPasswordResetEmail",
		send: (mod, username) =>
			mod.sendPasswordResetEmail({
				resetToken: RESET_TOKEN,
				to: "user@example.test",
				username,
			}),
	},
	{
		name: "sendWelcomeEmail",
		send: (mod, username) =>
			mod.sendWelcomeEmail({ to: "user@example.test", username }),
	},
	{
		name: "sendAccountDeletedEmail",
		send: (mod, username) =>
			mod.sendAccountDeletedEmail({ to: "user@example.test", username }),
	},
	{
		name: "sendRetentionWarningEmail",
		send: (mod, username) =>
			mod.sendRetentionWarningEmail({
				deletionDate: DELETION_DATE,
				to: "user@example.test",
				username,
			}),
	},
	{
		name: "sendRetentionFinalReminderEmail",
		send: (mod, username) =>
			mod.sendRetentionFinalReminderEmail({
				deletionDate: DELETION_DATE,
				to: "user@example.test",
				username,
			}),
	},
];

/**
 * Mocks the ACS client, stubs NEXTAUTH_URL, and imports email-service
 * fresh (after the mock/env are in place) so the module picks them up —
 * then captures the message beginSend received.
 */
async function sendAndCaptureMessage(
	send: (mod: EmailServiceModule, username: string) => Promise<unknown>,
	username: string
) {
	const beginSend = vi.fn().mockResolvedValue({
		pollUntilDone: vi
			.fn()
			.mockResolvedValue({ status: "Succeeded", id: "msg-1" }),
	});
	vi.doMock("@azure/communication-email", () => ({
		EmailClient: class {
			beginSend = beginSend;
		},
	}));
	vi.stubEnv("ACS_CONNECTION_STRING", "endpoint=https://x;accesskey=y");
	vi.stubEnv("NEXTAUTH_URL", "https://example.test");

	const mod = await import("../services/email-service");
	await send(mod, username);

	const call = beginSend.mock.calls.at(0);
	if (!call) {
		throw new Error("beginSend was not called");
	}
	return call[0];
}

describe("email-service", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.doUnmock("@azure/communication-email");
		vi.resetModules();
	});

	it.each(
		SENDERS
	)("$name builds the logo header as an absolute URL under NEXTAUTH_URL with no data: URI", async ({
		send,
	}) => {
		const message = await sendAndCaptureMessage(send, "Alice");

		expect(message.content.html).toContain(
			'<img src="https://example.test/images/logos/tea-logo-full-dark.png"'
		);
		expect(message.content.html).not.toContain("data:");
	});

	it.each(
		SENDERS
	)("$name escapes a hostile username in the HTML body but leaves the plain-text body unescaped", async ({
		send,
	}) => {
		const message = await sendAndCaptureMessage(send, HOSTILE_USERNAME);

		expect(message.content.html).not.toContain(HOSTILE_USERNAME);
		expect(message.content.html).toContain(escapeHtml(HOSTILE_USERNAME));
		expect(message.content.plainText).toContain(HOSTILE_USERNAME);
	});
});
