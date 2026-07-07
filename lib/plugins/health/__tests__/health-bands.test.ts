import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_BAND_SCORES,
	deriveHealthBand,
	isHealthStale,
} from "../health-bands";

describe("deriveHealthBand — defaults", () => {
	it("maps the default PASS score (1) to pass", () => {
		expect(deriveHealthBand(1)).toBe("pass");
	});

	it("maps the default DEGRADED score (0.5) to degraded", () => {
		expect(deriveHealthBand(0.5)).toBe("degraded");
	});

	it("maps the default FAIL score (0) to fail", () => {
		expect(deriveHealthBand(0)).toBe("fail");
	});

	it("maps a score closer to pass than degraded to pass", () => {
		expect(deriveHealthBand(0.9)).toBe("pass");
	});

	it("maps a score closer to fail than degraded to fail", () => {
		expect(deriveHealthBand(0.1)).toBe("fail");
	});

	it("resolves an exact midpoint tie to the worse band (fail over degraded)", () => {
		// Midpoint between fail (0) and degraded (0.5) is 0.25 — equidistant.
		expect(deriveHealthBand(0.25)).toBe("fail");
	});

	it("resolves the other exact midpoint tie to the worse band (degraded over pass)", () => {
		// Midpoint between degraded (0.5) and pass (1) is 0.75 — equidistant.
		expect(deriveHealthBand(0.75)).toBe("degraded");
	});
});

describe("deriveHealthBand — custom verdictScores (ADR §2.2 settings mechanism)", () => {
	it("keeps bands consistent with a rescaled custom mapping", () => {
		const custom = { fail: 0.1, degraded: 0.4, pass: 0.9 };
		expect(deriveHealthBand(0.1, custom)).toBe("fail");
		expect(deriveHealthBand(0.4, custom)).toBe("degraded");
		expect(deriveHealthBand(0.9, custom)).toBe("pass");
	});

	it("still resolves ties to the worse band under a custom mapping", () => {
		const custom = { fail: 0, degraded: 0.5, pass: 1 };
		expect(deriveHealthBand(0.25, custom)).toBe("fail");
	});

	it("degrades to nearest-band even under a misconfigured (non-monotonic) mapping", () => {
		// FAIL scored higher than PASS — deliberately invalid, but the
		// nearest-distance rule still returns a defined band, never throws.
		const misconfigured = { fail: 1, degraded: 0.5, pass: 0 };
		expect(deriveHealthBand(0.9, misconfigured)).toBe("fail");
		expect(deriveHealthBand(0.1, misconfigured)).toBe("pass");
	});
});

describe("DEFAULT_BAND_SCORES", () => {
	it("mirrors health-scoring-service.ts's DEFAULT_VERDICT_SCORES exactly", () => {
		expect(DEFAULT_BAND_SCORES).toEqual({ fail: 0, degraded: 0.5, pass: 1 });
	});
});

describe("isHealthStale", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("is not stale when lastEvaluatedAt is well within the validity window", () => {
		expect(
			isHealthStale({
				score: 1,
				lastEvaluatedAt: "2026-07-04T11:00:00.000Z", // 1h ago
				validityWindowSeconds: 24 * 60 * 60, // 24h
			})
		).toBe(false);
	});

	it("is stale when lastEvaluatedAt is outside the validity window", () => {
		expect(
			isHealthStale({
				score: 1,
				lastEvaluatedAt: "2026-07-01T12:00:00.000Z", // 3 days ago
				validityWindowSeconds: 24 * 60 * 60, // 24h
			})
		).toBe(true);
	});

	it("treats the exact boundary (age === window) as not stale", () => {
		expect(
			isHealthStale({
				score: 1,
				lastEvaluatedAt: "2026-07-03T12:00:00.000Z", // exactly 24h ago
				validityWindowSeconds: 24 * 60 * 60,
			})
		).toBe(false);
	});

	it("treats null lastEvaluatedAt as stale (defensive — currently unreachable in practice)", () => {
		expect(
			isHealthStale({
				score: 1,
				lastEvaluatedAt: null,
				validityWindowSeconds: 24 * 60 * 60,
			})
		).toBe(true);
	});
});
