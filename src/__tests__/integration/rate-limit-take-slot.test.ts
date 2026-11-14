import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	RATE_LIMIT_CONFIGS,
	type RateLimitConfig,
	takeRateLimitSlot,
} from "@/lib/services/rate-limit-service";

/**
 * `takeRateLimitSlot` counts and records an attempt together, so requests that
 * arrive at the same moment cannot all be let through.
 */

const CONFIG: RateLimitConfig = {
	endpoint: "take_slot_test",
	limits: [{ identifierType: "user_id", maxAttempts: 20, windowMs: 600_000 }],
};

const recorded = (identifier: string) =>
	prisma.rateLimitAttempt.count({
		where: { endpoint: CONFIG.endpoint, identifier },
	});

describe("takeRateLimitSlot", () => {
	it("lets exactly the budget through when many requests arrive at once", async () => {
		const outcomes = await Promise.all(
			Array.from({ length: 60 }, () =>
				takeRateLimitSlot(CONFIG, { userId: "busy-user" })
			)
		);

		expect(outcomes.filter((outcome) => outcome.allowed)).toHaveLength(20);
		expect(await recorded("busy-user")).toBe(20);
	});

	it("does not record an attempt it refuses, and says how long until the oldest one expires", async () => {
		for (let index = 0; index < 20; index += 1) {
			expect((await takeRateLimitSlot(CONFIG, { userId: "u" })).allowed).toBe(
				true
			);
		}

		const refused = await takeRateLimitSlot(CONFIG, { userId: "u" });

		expect(refused.allowed).toBe(false);
		expect(refused.retryAfterMs).toBeGreaterThan(0);
		expect(refused.retryAfterMs).toBeLessThanOrEqual(600_000);
		expect(await recorded("u")).toBe(20);
	});

	it("keeps one budget for each identifier", async () => {
		for (let index = 0; index < 20; index += 1) {
			await takeRateLimitSlot(CONFIG, { userId: "first" });
		}

		expect((await takeRateLimitSlot(CONFIG, { userId: "first" })).allowed).toBe(
			false
		);
		expect(
			(await takeRateLimitSlot(CONFIG, { userId: "second" })).allowed
		).toBe(true);
	});

	it("gives the budget back as attempts leave the window", async () => {
		for (let index = 0; index < 20; index += 1) {
			await takeRateLimitSlot(CONFIG, { userId: "u" });
		}
		await prisma.rateLimitAttempt.updateMany({
			where: { endpoint: CONFIG.endpoint, identifier: "u" },
			data: { attemptedAt: new Date(Date.now() - 11 * 60_000) },
		});

		expect((await takeRateLimitSlot(CONFIG, { userId: "u" })).allowed).toBe(
			true
		);
	});

	it("holds every limit of a config and records nothing when any one is full", async () => {
		const both: RateLimitConfig = {
			endpoint: "take_slot_two_limits",
			limits: [
				{ identifierType: "ip", maxAttempts: 2, windowMs: 600_000 },
				{ identifierType: "user_id", maxAttempts: 5, windowMs: 600_000 },
			],
		};
		const who = { ipAddress: "203.0.113.9", userId: "u" };
		expect((await takeRateLimitSlot(both, who)).allowed).toBe(true);
		expect((await takeRateLimitSlot(both, who)).allowed).toBe(true);

		expect((await takeRateLimitSlot(both, who)).allowed).toBe(false);
		expect(
			await prisma.rateLimitAttempt.count({
				where: { endpoint: "take_slot_two_limits", identifierType: "user_id" },
			})
		).toBe(2);
	});

	it("allows the call, and records nothing, when the config has no identifier to count", async () => {
		const outcome = await takeRateLimitSlot(RATE_LIMIT_CONFIGS.modelCalls, {});

		expect(outcome.allowed).toBe(true);
		expect(await prisma.rateLimitAttempt.count()).toBe(0);
	});
});
