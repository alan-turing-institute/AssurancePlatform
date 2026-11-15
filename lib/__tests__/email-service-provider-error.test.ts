import { afterEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../logger";

const RECIPIENT = "leak.canary@recipient-domain.test";

const { beginSend } = vi.hoisted(() => ({ beginSend: vi.fn() }));

vi.mock("@azure/communication-email", () => ({
	EmailClient: class {
		beginSend = beginSend;
	},
}));

async function load() {
	vi.resetModules();
	vi.stubEnv("LOG_LEVEL", "debug");
	vi.stubEnv("ACS_CONNECTION_STRING", "endpoint=https://acs.test/;accesskey=x");
	const captured: LogEntry[] = [];
	const { setLogSink } = await import("../logger");
	setLogSink((entry) => {
		captured.push(entry);
	});
	return { service: await import("../services/email-service"), captured };
}

const send = (service: Awaited<ReturnType<typeof load>>["service"]) =>
	service.sendWelcomeEmail({ to: RECIPIENT, username: "Alice" });

describe("a send the email provider refuses", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
		beginSend.mockReset();
	});

	it("reports a fixed message and the provider's code, not its text", async () => {
		beginSend.mockResolvedValue({
			pollUntilDone: async () => ({
				status: "Failed",
				error: { code: "InvalidRecipient", message: `${RECIPIENT} rejected` },
			}),
		});
		const { service, captured } = await load();

		const result = await send(service);

		expect(result).toEqual({
			error: "Email sending failed (InvalidRecipient)",
		});
		expect(JSON.stringify(captured)).not.toContain(RECIPIENT);
	});

	it("keeps the address out of the result and the log when the send throws", async () => {
		const failure = Object.assign(new Error(`Bad recipient ${RECIPIENT}`), {
			code: "Throttled",
		});
		beginSend.mockRejectedValue(failure);
		const { service, captured } = await load();

		const result = await send(service);

		expect(result).toEqual({ error: "Email sending failed (Throttled)" });
		expect(JSON.stringify(captured)).not.toContain(RECIPIENT);
	});

	it("leaves out a code that is not a short code", async () => {
		beginSend.mockRejectedValue(
			Object.assign(new Error("x"), { code: `fails for ${RECIPIENT}` })
		);
		const { service } = await load();

		expect(await send(service)).toEqual({ error: "Email sending failed" });
	});
});
