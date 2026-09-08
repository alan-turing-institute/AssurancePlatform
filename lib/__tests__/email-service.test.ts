import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeHtml } from "../services/email-service";

const HOSTILE_USERNAME = '"><img src=x onerror=alert(1)>';

/**
 * Mocks the ACS client and returns the message captured by beginSend, so
 * tests can assert on the exact HTML/plain-text sent without a real ACS
 * connection.
 */
async function sendWelcomeAndCaptureMessage(username: string) {
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

	const { sendWelcomeEmail } = await import("../services/email-service");
	await sendWelcomeEmail({ to: "user@example.test", username });

	const call = beginSend.mock.calls.at(0);
	if (!call) {
		throw new Error("beginSend was not called");
	}
	return call[0];
}

describe("email-service", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.doUnmock("@azure/communication-email");
		vi.resetModules();
	});

	it("builds the logo header as an absolute URL under NEXTAUTH_URL with no data: URI", async () => {
		vi.stubEnv("NEXTAUTH_URL", "https://example.test");

		const message = await sendWelcomeAndCaptureMessage("Alice");

		expect(message.content.html).toContain(
			'<img src="https://example.test/images/logos/tea-logo-full-dark.png"'
		);
		expect(message.content.html).not.toContain("data:");
	});

	it("escapes a hostile username in the HTML body but leaves the plain-text body unescaped", async () => {
		vi.stubEnv("NEXTAUTH_URL", "https://example.test");

		const message = await sendWelcomeAndCaptureMessage(HOSTILE_USERNAME);

		expect(message.content.html).not.toContain(HOSTILE_USERNAME);
		expect(message.content.html).toContain(escapeHtml(HOSTILE_USERNAME));
		expect(message.content.plainText).toContain(HOSTILE_USERNAME);
	});

	describe("escapeHtml", () => {
		it("escapes ampersand", () => {
			expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
		});

		it("escapes less-than", () => {
			expect(escapeHtml("a < b")).toBe("a &lt; b");
		});

		it("escapes greater-than", () => {
			expect(escapeHtml("a > b")).toBe("a &gt; b");
		});

		it("escapes double quotes", () => {
			expect(escapeHtml('say "hi"')).toBe("say &quot;hi&quot;");
		});

		it("escapes single quotes", () => {
			expect(escapeHtml("it's")).toBe("it&#39;s");
		});
	});
});
