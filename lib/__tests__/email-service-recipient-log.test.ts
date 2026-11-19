import { afterEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../logger";

type EmailService = typeof import("../services/email-service");
type Send = (service: EmailService) => Promise<unknown>;

const RECIPIENT = "Leak.Canary+reset@recipient-domain.test";
const RECIPIENT_NAME = "leak.canary+reset";
const PARTY = { to: RECIPIENT, username: "Alice" };
const DELETION_DATE = new Date("2026-01-01T00:00:00Z");

/** Every sender in the module, each handed the same recipient. */
const SENDS = {
	sendPasswordResetEmail: (s) =>
		s.sendPasswordResetEmail({ ...PARTY, resetToken: "tok-1234" }),
	sendWelcomeEmail: (s) => s.sendWelcomeEmail(PARTY),
	sendAccountDeletedEmail: (s) => s.sendAccountDeletedEmail(PARTY),
	sendRetentionWarningEmail: (s) =>
		s.sendRetentionWarningEmail({ ...PARTY, deletionDate: DELETION_DATE }),
	sendRetentionFinalReminderEmail: (s) =>
		s.sendRetentionFinalReminderEmail({
			...PARTY,
			deletionDate: DELETION_DATE,
		}),
} satisfies Record<string, Send>;

const ALL_SENDS = Object.entries(SENDS);

/** Loads the module with no email service configured and a log sink in place. */
async function loadWithoutProvider(mode: string) {
	vi.resetModules();
	vi.stubEnv("LOG_LEVEL", "debug");
	vi.stubEnv("NODE_ENV", mode);
	vi.stubEnv("ACS_CONNECTION_STRING", undefined);
	vi.stubEnv("NEXTAUTH_URL", "https://app.test");
	const captured: LogEntry[] = [];
	const { setLogSink } = await import("../logger");
	setLogSink((entry) => {
		captured.push(entry);
	});
	const service = await import("../services/email-service");
	return { service, captured };
}

function failureEntries(captured: LogEntry[]): LogEntry[] {
	return captured.filter(
		(entry) => entry.msg === "Email provider not configured"
	);
}

describe("a failed send with no email service configured in production", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it.each(
		ALL_SENDS
	)("%s logs one entry that names the subject and no recipient", async (_name, send) => {
		const { service, captured } = await loadWithoutProvider("production");

		const result = await send(service);

		expect(result).toEqual({ error: "Email provider not configured" });
		const entries = failureEntries(captured);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.level).toBe("error");
		expect(entries[0]?.subject).toEqual(
			expect.stringContaining("TEA Platform")
		);
		expect(entries[0]).not.toHaveProperty("to");
	});

	it.each(
		ALL_SENDS
	)("%s leaves the address and its name part out of every log entry", async (_name, send) => {
		const { service, captured } = await loadWithoutProvider("production");

		await send(service);

		const everything = JSON.stringify(captured).toLowerCase();
		expect(everything).not.toContain(RECIPIENT.toLowerCase());
		expect(everything).not.toContain(RECIPIENT_NAME);
	});

	it("leaves the username and the message body out of the log as well", async () => {
		const { service, captured } = await loadWithoutProvider("production");

		await SENDS.sendPasswordResetEmail(service);

		const everything = JSON.stringify(captured);
		expect(everything).not.toContain("Alice");
		expect(everything).not.toContain("tok-1234");
		expect(everything).not.toContain("reset-password");
	});
});

describe("a send with no email service configured outside production", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it("still shows the recipient in the development preview", async () => {
		const { service, captured } = await loadWithoutProvider("development");

		const result = await SENDS.sendWelcomeEmail(service);

		expect(result).toHaveProperty("data");
		expect(captured).toContainEqual(
			expect.objectContaining({
				msg: "Email (development mode)",
				to: RECIPIENT,
			})
		);
	});
});
