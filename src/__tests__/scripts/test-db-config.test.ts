/**
 * Unit tests for the pure per-invocation worker-database naming logic in
 * test-db-config.ts — no Postgres required. Covers the two things the
 * integration-only evidence in the parent fix couldn't cheaply exercise:
 * validation failure modes (bad pool id, missing/malformed invocation id)
 * and the parse/format round-trip the stray-sweep and teardown code depends
 * on to recover an invocation id from a database name.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
	currentInvocationId,
	INTEGRATION_TEST_WORKER_COUNT,
	INTEGRATION_TEST_WORKER_DATABASE_PATTERN,
	parseWorkerDatabaseName,
	setInvocationId,
	workerDatabaseName,
} from "./test-db-config";

const ENV_VAR = "INTEGRATION_TEST_INVOCATION_ID";
const ENV_VAR_NAME_PATTERN = /INTEGRATION_TEST_INVOCATION_ID/;
const NOT_A_PID_PATTERN = /"not-a-pid"/;
const INVALID_WORKER_ID_PATTERN = /Invalid vitest worker id/;

describe("test-db-config", () => {
	afterEach(() => {
		delete process.env[ENV_VAR];
	});

	describe("setInvocationId / currentInvocationId", () => {
		it("round-trips a numeric pid through the environment", () => {
			setInvocationId(48_213);
			expect(currentInvocationId()).toBe("48213");
		});

		it("accepts a string pid", () => {
			setInvocationId("999");
			expect(currentInvocationId()).toBe("999");
		});

		it("throws, naming the bad value, when unset", () => {
			delete process.env[ENV_VAR];
			expect(() => currentInvocationId()).toThrow(ENV_VAR_NAME_PATTERN);
		});

		it("throws when set to a non-numeric value rather than silently accepting it", () => {
			process.env[ENV_VAR] = "not-a-pid";
			expect(() => currentInvocationId()).toThrow(NOT_A_PID_PATTERN);
		});

		it("throws on an empty string (falsy, must not fall through to the falsy-default branch)", () => {
			process.env[ENV_VAR] = "";
			expect(() => currentInvocationId()).toThrow();
		});
	});

	describe("workerDatabaseName", () => {
		it("formats a worker database name scoped to an explicit invocation id", () => {
			expect(workerDatabaseName(2, "48213")).toBe("tea_test_p48213_w2");
		});

		it("accepts a numeric-string pool id", () => {
			expect(workerDatabaseName("3", "1")).toBe("tea_test_p1_w3");
		});

		it("falls back to currentInvocationId() when no invocation id is passed", () => {
			setInvocationId(555);
			expect(workerDatabaseName(1)).toBe("tea_test_p555_w1");
		});

		it("rejects a pool id of 0", () => {
			expect(() => workerDatabaseName(0, "1")).toThrow(
				INVALID_WORKER_ID_PATTERN
			);
		});

		it("rejects a pool id above INTEGRATION_TEST_WORKER_COUNT", () => {
			expect(() =>
				workerDatabaseName(INTEGRATION_TEST_WORKER_COUNT + 1, "1")
			).toThrow(INVALID_WORKER_ID_PATTERN);
		});

		it("accepts the boundary values 1 and INTEGRATION_TEST_WORKER_COUNT", () => {
			expect(workerDatabaseName(1, "1")).toBe("tea_test_p1_w1");
			expect(workerDatabaseName(INTEGRATION_TEST_WORKER_COUNT, "1")).toBe(
				`tea_test_p1_w${INTEGRATION_TEST_WORKER_COUNT}`
			);
		});

		// Number.parseInt("1.5", 10) truncates to 1 rather than failing to
		// parse, so this does NOT throw — it silently resolves to worker 1.
		// That's real behaviour, not a bug this test suite should paper over:
		// flagged in QA (2026-08-12) as a pre-existing gap in the "fails
		// loudly on a bad id" guarantee the surrounding code comments claim.
		// Low real-world risk (VITEST_POOL_ID is vitest-generated, never
		// hand-typed), but documented here so a future change to the
		// truncating-vs-strict parsing choice is deliberate, not accidental.
		it("does NOT reject a non-integer numeric-string pool id — parseInt truncation (documented gap)", () => {
			expect(workerDatabaseName("1.5", "1")).toBe("tea_test_p1_w1");
		});

		it("rejects a non-numeric pool id", () => {
			expect(() => workerDatabaseName("abc", "1")).toThrow(
				INVALID_WORKER_ID_PATTERN
			);
		});
	});

	describe("parseWorkerDatabaseName / INTEGRATION_TEST_WORKER_DATABASE_PATTERN round-trip", () => {
		it("recovers the invocation id and pool id from a name it produced", () => {
			const name = workerDatabaseName(3, "48213");
			expect(parseWorkerDatabaseName(name)).toEqual({
				invocationId: "48213",
				poolId: 3,
			});
		});

		it("returns null for a name that doesn't match the scheme at all", () => {
			expect(parseWorkerDatabaseName("tea_test_template")).toBeNull();
			expect(parseWorkerDatabaseName("some_other_database")).toBeNull();
		});

		it("returns null for the OLD pre-fix fixed-name scheme (tea_test_w1) — must not be treated as a match", () => {
			expect(parseWorkerDatabaseName("tea_test_w1")).toBeNull();
		});

		it("returns null for a name with a non-numeric invocation id", () => {
			expect(parseWorkerDatabaseName("tea_test_pABC_w1")).toBeNull();
		});

		it("agrees with the exported pattern constant on what matches", () => {
			const matching = "tea_test_p1_w1";
			const nonMatching = "tea_test_p1_w1_extra";
			expect(INTEGRATION_TEST_WORKER_DATABASE_PATTERN.test(matching)).toBe(
				true
			);
			expect(parseWorkerDatabaseName(matching)).not.toBeNull();
			expect(INTEGRATION_TEST_WORKER_DATABASE_PATTERN.test(nonMatching)).toBe(
				false
			);
			expect(parseWorkerDatabaseName(nonMatching)).toBeNull();
		});
	});
});
