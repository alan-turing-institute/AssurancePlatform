import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signInIdentifierKey } from "@/lib/auth/sign-in-identifier";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { acceptInvite } from "@/lib/services/case-invite-service";
import { requestPasswordReset } from "@/lib/services/password-reset-service";
import {
	checkAndRecordRateLimit,
	RATE_LIMIT_CONFIGS,
} from "@/lib/services/rate-limit-service";
import { createTestCase, createTestUser } from "../utils/prisma-factories";

// The reset service imports the email service, an external boundary.
vi.mock("@/lib/services/email-service", () => ({
	sendPasswordResetEmail: vi
		.fn()
		.mockResolvedValue({ data: { messageId: "m" } }),
}));

const IP = "198.51.100.7";
const UNKNOWN = "Nobody.Here@example.com";

let logged: LogEntry[] = [];

beforeEach(() => {
	logged = [];
	setLogSink((entry) => {
		logged.push(entry);
	});
});

afterEach(() => {
	resetLogSink();
	vi.unstubAllEnvs();
});

function auditRows(eventType: string) {
	return prisma.securityAuditLog.findMany({ where: { eventType } });
}

function loggedText(): string {
	return JSON.stringify(logged).toLowerCase();
}

describe("a password-reset request for an address", () => {
	it("keeps an unknown address out of the log and the audit row", async () => {
		await requestPasswordReset(UNKNOWN, IP);

		const rows = await auditRows("password_reset_requested_invalid_user");
		expect(rows).toHaveLength(1);
		expect(JSON.stringify(rows[0]?.metadata).toLowerCase()).not.toContain(
			UNKNOWN.toLowerCase()
		);
		expect(rows[0]?.metadata).toMatchObject({
			identifier: signInIdentifierKey(UNKNOWN),
			reason: "user_not_found",
		});
		expect(loggedText()).not.toContain(UNKNOWN.toLowerCase());
	});

	it("keeps the address of an account with no password out of both", async () => {
		const user = await createTestUser({ authProvider: "GITHUB" });

		await requestPasswordReset(user.email, IP);

		const rows = await auditRows("password_reset_requested_invalid_user");
		expect(rows[0]?.metadata).toMatchObject({
			identifier: signInIdentifierKey(user.email),
			reason: "oauth_user",
		});
		expect(JSON.stringify(rows[0]?.metadata)).not.toContain(user.email);
		expect(loggedText()).not.toContain(user.email.toLowerCase());
	});

	it("keeps the address out when the hourly limit refuses it", async () => {
		for (let i = 0; i < 4; i++) {
			await requestPasswordReset(UNKNOWN, IP);
		}

		const rows = await auditRows("password_reset_rate_limited");
		expect(rows.length).toBeGreaterThan(0);
		expect(rows[0]?.metadata).toMatchObject({
			identifier: signInIdentifierKey(UNKNOWN),
		});
		expect(JSON.stringify(rows[0]?.metadata).toLowerCase()).not.toContain(
			UNKNOWN.toLowerCase()
		);
		expect(loggedText()).not.toContain(UNKNOWN.toLowerCase());
	});

	it("answers an unknown and a known address alike when the secret is missing", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });
		vi.stubEnv("NEXTAUTH_SECRET", "");

		const unknown = await requestPasswordReset(UNKNOWN, IP);
		const known = await requestPasswordReset(user.email, IP);

		expect(unknown).toEqual({ data: null });
		expect(known).toEqual({ data: null });
		const rows = await auditRows("password_reset_requested_invalid_user");
		expect(rows[0]?.metadata).not.toHaveProperty("identifier");
		expect(loggedText()).not.toContain(UNKNOWN.toLowerCase());
	});
});

describe("a registration refused by the rate limit", () => {
	it("keeps the typed address out of the log and the audit row", async () => {
		const typed = "Typed.Person@example.com";
		const attempts = RATE_LIMIT_CONFIGS.register.limits[0].maxAttempts + 1;
		for (let i = 0; i < attempts; i++) {
			await checkAndRecordRateLimit(
				RATE_LIMIT_CONFIGS.register,
				{ ipAddress: IP, emailKey: signInIdentifierKey(typed) },
				{ ipAddress: IP }
			);
		}

		const rows = await auditRows("register_rate_limited");
		expect(rows.length).toBeGreaterThan(0);
		expect(JSON.stringify(rows[0]?.metadata).toLowerCase()).not.toContain(
			typed.toLowerCase()
		);
		expect(rows[0]?.metadata).toMatchObject({
			identifiers: { identifier: signInIdentifierKey(typed) },
		});
		expect(loggedText()).not.toContain(typed.toLowerCase());
	});
});

describe("an invitation refused because it was sent to another address", () => {
	it("keeps both addresses out of the log and the audit row", async () => {
		const owner = await createTestUser();
		const invitee = await createTestUser({
			email: "actual.person@example.com",
		});
		const testCase = await createTestCase(owner.id);
		const { createCaseInvite } = await import(
			"@/lib/services/case-invite-service"
		);
		const created = await createCaseInvite({
			caseId: testCase.id,
			email: "someone.else@example.com",
			permission: "VIEW",
			invitedById: owner.id,
		});
		if (!("data" in created)) {
			throw new Error("invite not created");
		}

		const result = await acceptInvite(invitee.id, created.data.invite_token);

		expect(result).toEqual({
			error: "Invite was sent to a different email address",
		});
		const rows = await auditRows("invite_acceptance_email_mismatch");
		expect(rows).toHaveLength(1);
		const stored = JSON.stringify(rows[0]?.metadata).toLowerCase();
		expect(stored).not.toContain("someone.else@example.com");
		expect(stored).not.toContain("actual.person@example.com");
		expect(rows[0]?.metadata).toMatchObject({
			inviteIdentifier: signInIdentifierKey("someone.else@example.com"),
			userIdentifier: signInIdentifierKey("actual.person@example.com"),
		});
		expect(loggedText()).not.toContain(
			"someone.else@example.com".toLowerCase()
		);
		expect(loggedText()).not.toContain(
			"actual.person@example.com".toLowerCase()
		);
	});
});
