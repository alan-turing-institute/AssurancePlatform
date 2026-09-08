import { afterEach, describe, expect, it, vi } from "vitest";
import { logSecurityEvent } from "@/lib/audit/security-log";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";

function capture(): LogEntry[] {
	const entries: LogEntry[] = [];
	setLogSink((entry) => {
		entries.push(entry);
	});
	return entries;
}

describe("logSecurityEvent", () => {
	afterEach(() => {
		resetLogSink();
		vi.unstubAllEnvs();
	});

	it.each([
		"low",
		"medium",
	] as const)("logs %s severity at warn", (severity) => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries = capture();

		logSecurityEvent({ event: "some_event", severity });

		expect(entries).toHaveLength(1);
		expect(entries[0]?.level).toBe("warn");
	});

	it.each([
		"high",
		"critical",
	] as const)("logs %s severity at error", (severity) => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries = capture();

		logSecurityEvent({ event: "some_event", severity });

		expect(entries).toHaveLength(1);
		expect(entries[0]?.level).toBe("error");
	});

	it("carries event as msg, severity and metadata as fields, and the security binding", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries = capture();

		logSecurityEvent({
			event: "password_reset_completed",
			severity: "low",
			metadata: { userId: "u1", ipAddress: "127.0.0.1" },
		});

		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			component: "security",
			msg: "password_reset_completed",
			severity: "low",
			userId: "u1",
			ipAddress: "127.0.0.1",
		});
	});

	it("carries the security binding and severity field even with no metadata", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries = capture();

		logSecurityEvent({ event: "token_revoked", severity: "high" });

		expect(entries[0]).toMatchObject({
			component: "security",
			msg: "token_revoked",
			severity: "high",
			level: "error",
		});
	});

	it("keeps its own severity when metadata.severity collides, under caller_severity", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries = capture();

		logSecurityEvent({
			event: "privilege_escalation_attempt",
			severity: "critical",
			metadata: { severity: "low" },
		});

		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			severity: "critical",
			caller_severity: "low",
			level: "error",
		});
	});
});
