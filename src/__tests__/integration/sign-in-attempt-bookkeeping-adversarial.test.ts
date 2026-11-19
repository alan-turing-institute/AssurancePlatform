import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyPassword } from "@/lib/auth/password-service";
import {
	clearSignInFailures,
	takeRateLimitSlot,
} from "@/lib/services/rate-limit-service";
import { captureLogs } from "../helpers/capture-logs";
import {
	account,
	at,
	attempt,
	failures,
	failuresAcrossNames,
	nth,
	PASSWORD,
	sameAddress,
} from "../utils/sign-in-attempts-kit";

// The real functions stay in place; these wrappers only let a test make one
// call fail or count the calls.
vi.mock("@/lib/services/rate-limit-service", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/services/rate-limit-service")>();
	return {
		...actual,
		takeRateLimitSlot: vi.fn(actual.takeRateLimitSlot),
		clearSignInFailures: vi.fn(actual.clearSignInFailures),
	};
});
vi.mock("@/lib/auth/password-service", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/auth/password-service")>();
	return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

const ADDRESS = "203.0.113.30";

beforeEach(() => {
	vi.mocked(takeRateLimitSlot).mockClear();
	vi.mocked(clearSignInFailures).mockClear();
	vi.mocked(verifyPassword).mockClear();
});

describe("sign-in limit: when the bookkeeping fails", () => {
	it("refuses a correct password, rather than letting it through, when the count cannot be taken", async () => {
		await account({ username: "demo" });
		vi.mocked(takeRateLimitSlot).mockRejectedValueOnce(new Error("count down"));

		expect(await attempt("demo", PASSWORD, nth(0))).toBe("wrong");
		expect(await attempt("demo", PASSWORD, nth(1))).toBe("ok");
	});

	it("signs a correct password in, and logs the problem, when handing the slot back fails", async () => {
		await account({ username: "refund-check-user" });
		vi.mocked(clearSignInFailures).mockRejectedValueOnce(
			new Error("refund down")
		);
		const logs = captureLogs();
		try {
			expect(await attempt("refund-check-user", PASSWORD, nth(0))).toBe("ok");

			expect(logs.entries.some((entry) => entry.level === "error")).toBe(true);
			expect(JSON.stringify(logs.entries)).not.toContain("refund-check-user");
		} finally {
			logs.restore();
		}
	});
});

describe("sign-in limit: a paused attempt costs no password check", () => {
	it("does not check the password of a name that is paused", async () => {
		await account({ username: "demo" });
		await failures("demo", 10, sameAddress(ADDRESS));
		expect(vi.mocked(verifyPassword)).toHaveBeenCalledTimes(10);

		await attempt("demo", PASSWORD, at(ADDRESS));
		await attempt("demo", "another wrong password", at(ADDRESS));

		expect(vi.mocked(verifyPassword)).toHaveBeenCalledTimes(10);
	});

	it("does not check the password of a visitor from a paused address", async () => {
		await account({ username: "demo" });
		await failuresAcrossNames(20, sameAddress(ADDRESS));

		expect(await attempt("demo", PASSWORD, at(ADDRESS))).toBe("paused:15");
		expect(vi.mocked(verifyPassword)).not.toHaveBeenCalled();
	});
});
