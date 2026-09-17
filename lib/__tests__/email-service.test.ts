import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../logger";
import { escapeHtml } from "../sanitize-html";
import { redactTokensInUrls } from "../services/email-service";

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

describe("email-service — no client configured", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	/**
	 * `vi.resetModules()` clears the module registry, so a dynamic import of
	 * `email-service` after this point pulls in a *fresh* instance of
	 * `lib/logger` too — distinct from the one this file imported statically
	 * at the top. Importing logger dynamically here, before email-service,
	 * and installing the sink on that instance keeps the two in the same
	 * module graph, so the sink actually receives email-service's entries.
	 */
	async function importEmailServiceWithCapturedLogs(nodeEnv: string) {
		vi.resetModules();
		vi.stubEnv("LOG_LEVEL", "debug");
		vi.stubEnv("NODE_ENV", nodeEnv);
		// Falsy, like an unset connection string — vi.stubEnv can't unset a
		// var, only set it, so an empty string stands in for "not configured".
		vi.stubEnv("ACS_CONNECTION_STRING", "");
		vi.stubEnv("NEXTAUTH_URL", "https://example.test");

		const entries: LogEntry[] = [];
		const loggerMod = await import("../logger");
		loggerMod.setLogSink((entry) => {
			entries.push(entry);
		});

		const mod = await import("../services/email-service");
		return { mod, entries };
	}

	it("in production, returns an error result and logs no body or token", async () => {
		const { mod, entries } =
			await importEmailServiceWithCapturedLogs("production");

		const result = await mod.sendPasswordResetEmail({
			resetToken: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
			to: "user@example.test",
			username: "Alice",
		});

		expect(result).toHaveProperty("error");
		const serialised = JSON.stringify(entries);
		expect(serialised).not.toContain("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6");
		expect(serialised).not.toContain("reset-password");
		expect(entries).toContainEqual(
			expect.objectContaining({
				level: "error",
				to: "user@example.test",
				subject: expect.stringContaining("Reset your"),
			})
		);
	});

	it("outside production, logs the reset URL with the token reduced to its last 4 characters", async () => {
		const { mod, entries } = await importEmailServiceWithCapturedLogs("test");
		const resetToken = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";

		const result = await mod.sendPasswordResetEmail({
			resetToken,
			to: "user@example.test",
			username: "Alice",
		});

		expect(result).toHaveProperty("data");
		const serialised = JSON.stringify(entries);
		expect(serialised).not.toContain(resetToken);
		expect(serialised).toContain(`…${resetToken.slice(-4)}`);
	});
});

describe("redactTokensInUrls", () => {
	it("leaves the scheme and hostname untouched", () => {
		const content = "https://staging-assuranceplatform.azurewebsites.net/login";

		const redacted = redactTokensInUrls(content);

		expect(redacted).toContain(
			"https://staging-assuranceplatform.azurewebsites.net/"
		);
	});

	it("redacts a 64-hex ?token= value to its last 4 characters", () => {
		const token =
			"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
		const content = `https://example.test/reset-password?token=${token}`;

		const redacted = redactTokensInUrls(content);

		expect(redacted).not.toContain(token);
		expect(redacted).toContain(`token=…${token.slice(-4)}`);
	});

	it("redacts a short ?code= value the same way, regardless of its length", () => {
		const content = "https://example.test/login?code=123456";

		const redacted = redactTokensInUrls(content);

		expect(redacted).toContain("code=…3456");
		expect(redacted).not.toContain("code=123456");
	});

	it("redacts a base64 ?token= value (with +, /, =) to its last 4 characters", () => {
		const token = "aGVsbG8gd29ybGQ+cmFuZG9tL2Jhc2U2NA==";
		const content = `https://example.test/reset-password?token=${encodeURIComponent(token)}`;

		const redacted = redactTokensInUrls(content);

		expect(redacted).not.toContain(encodeURIComponent(token));
		expect(redacted).toContain(`token=…${token.slice(-4)}`);
	});

	it("redacts a token-like final path segment (e.g. /verify/<token>)", () => {
		const content = "https://example.test/verify/abcdefghijklmnopqrstuvwx";

		const redacted = redactTokensInUrls(content);

		expect(redacted).toBe("https://example.test/verify/…uvwx");
	});

	it("leaves a plain path like /reset-password untouched (only the query is redacted)", () => {
		const content =
			"https://example.test/reset-password?token=a1b2c3d4e5f6a7b8";

		const redacted = redactTokensInUrls(content);

		expect(redacted).toContain("example.test/reset-password?");
		expect(redacted).not.toContain("reset-…word");
	});

	it("leaves a non-URL 16+ character word in the body untouched", () => {
		const content =
			"Your reference code for this request is abcdefghijklmnopqrstuvwx, keep it safe.";

		const redacted = redactTokensInUrls(content);

		expect(redacted).toBe(content);
	});
});
