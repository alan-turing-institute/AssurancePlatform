import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	acceptInvite,
	createCaseInvite,
} from "@/lib/services/case-invite-service";
import {
	requestPasswordReset,
	resetPassword,
} from "@/lib/services/password-reset-service";
import {
	checkAndRecordRateLimit,
	RATE_LIMIT_CONFIGS,
} from "@/lib/services/rate-limit-service";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestUser,
	getTestPasswordResetToken,
} from "../utils/prisma-factories";

const TEST_IP = "127.0.0.1";

/**
 * `TEA — Persist security audit events`: the three pre-existing
 * `logSecurityEvent`-only call sites (case-invite, password-reset,
 * rate-limit) now go through `recordSecurityEvent`
 * (`lib/services/security-audit-service.ts`) alongside
 * `integration-registry-service.ts`, which already had its own persisted
 * audit trail covered in `machine-auth.test.ts`. Each test below proves one
 * call site's event actually lands a `SecurityAuditLog` row — the DB write
 * failure/`audit_log_write_failed` path is shared code, already covered
 * once (against `integration-registry-service`) in `machine-auth.test.ts`,
 * so it is not repeated per call site here.
 */
describe("security audit persistence — case-invite-service", () => {
	it("persists a row for a successfully accepted invite", async () => {
		const owner = await createTestUser();
		const invitee = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const { invite_token: inviteToken } = expectSuccess(
			await createCaseInvite({
				caseId: testCase.id,
				email: invitee.email,
				permission: "VIEW",
				invitedById: owner.id,
			})
		);

		expectSuccess(
			await acceptInvite(invitee.id, inviteToken, {
				ipAddress: TEST_IP,
				userAgent: "vitest",
			})
		);

		const row = await prisma.securityAuditLog.findFirst({
			where: { eventType: "invite_acceptance_completed", userId: invitee.id },
		});
		expect(row).not.toBeNull();
		expect(row?.ipAddress).toBe(TEST_IP);
	});
});

describe("security audit persistence — password-reset-service", () => {
	it("persists a row for a completed password reset", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });
		await requestPasswordReset(user.email, TEST_IP);
		const token = await getTestPasswordResetToken(user.id);
		if (!token) {
			throw new Error("Token was not created");
		}

		expectSuccess(await resetPassword(token, "StrongP@ss1", TEST_IP));

		const row = await prisma.securityAuditLog.findFirst({
			where: { eventType: "password_reset_completed", userId: user.id },
		});
		expect(row).not.toBeNull();
	});
});

describe("security audit persistence — rate-limit-service", () => {
	it("persists a row when a blocked attempt is recorded", async () => {
		const user = await createTestUser();
		// One past the ip limit's maxAttempts: each call before this one is
		// allowed (and merely recorded), so the (maxAttempts + 1)-th is the
		// first one `checkRateLimit` actually blocks.
		const callsToExceedLimit =
			RATE_LIMIT_CONFIGS.register.limits[0]!.maxAttempts + 1;

		for (let i = 0; i < callsToExceedLimit; i++) {
			await checkAndRecordRateLimit(
				RATE_LIMIT_CONFIGS.register,
				{ ipAddress: "10.9.9.9" },
				{ userId: user.id, ipAddress: "10.9.9.9" }
			);
		}

		const row = await prisma.securityAuditLog.findFirst({
			where: { eventType: "register_rate_limited", userId: user.id },
		});
		expect(row).not.toBeNull();
	});
});
