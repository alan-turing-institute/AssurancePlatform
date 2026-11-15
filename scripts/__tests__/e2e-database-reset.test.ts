import { describe, expect, it, vi } from "vitest";
import {
	decideE2eDatabaseReset,
	type Env,
	runE2eDatabaseReset,
} from "../e2e-database-reset";

const url = (database: string, query = "") =>
	`postgresql://tea_owner:s3cret-pw@localhost:5433/${database}${query}`;

describe("decideE2eDatabaseReset", () => {
	it("skips when CI is set", () => {
		expect(
			decideE2eDatabaseReset({ CI: "1", DATABASE_URL: url("tea_dev") }).action
		).toBe("skip");
	});

	it.each([
		"1",
		"true",
		"TRUE",
	])("skips when E2E_SKIP_DB_RESET is %s", (value) => {
		expect(
			decideE2eDatabaseReset({
				E2E_SKIP_DB_RESET: value,
				DATABASE_URL: url("tea_dev"),
			}).action
		).toBe("skip");
	});

	it.each([
		undefined,
		"",
		"   ",
	])("refuses when DATABASE_URL is %j", (value) => {
		const decision = decideE2eDatabaseReset({ DATABASE_URL: value });
		expect(decision.action).toBe("refuse");
		expect(decision).toMatchObject({
			message: expect.stringContaining(".env"),
		});
	});

	it("refuses a development database name", () => {
		expect(decideE2eDatabaseReset({ DATABASE_URL: url("tea_dev") })).toEqual({
			action: "refuse",
			message: expect.stringContaining('"tea_dev" on localhost:5433'),
		});
	});

	it.each(["tea_test", "tea_e2e", "TEA_E2E"])("resets %s", (database) => {
		expect(decideE2eDatabaseReset({ DATABASE_URL: url(database) })).toEqual({
			action: "reset",
			url: url(database),
			host: "localhost",
			port: "5433",
			database,
		});
	});

	it.each([
		"1",
		"true",
	])("resets a differently named database when E2E_ALLOW_RESET is %s", (value) => {
		expect(
			decideE2eDatabaseReset({
				DATABASE_URL: url("tea_dev"),
				E2E_ALLOW_RESET: value,
			}).action
		).toBe("reset");
	});

	it("falls through to the guard when CI is blank", () => {
		expect(
			decideE2eDatabaseReset({ CI: "", DATABASE_URL: url("tea_dev") }).action
		).toBe("refuse");
	});

	it("reads the default port when the address has none", () => {
		expect(
			decideE2eDatabaseReset({
				DATABASE_URL: "postgresql://u:p@localhost/tea_e2e",
			})
		).toMatchObject({ action: "reset", port: "5432" });
	});

	it("ignores a query string when reading the database name", () => {
		expect(
			decideE2eDatabaseReset({ DATABASE_URL: url("tea_e2e", "?schema=public") })
		).toMatchObject({ action: "reset", database: "tea_e2e" });
		expect(
			decideE2eDatabaseReset({ DATABASE_URL: url("tea_dev", "?x=_test") })
				.action
		).toBe("refuse");
	});

	it.each([
		"not a url",
		"mysql://u:p@localhost/tea_test",
		"postgresql://u:p@localhost:5433",
		"postgresql://u:p@localhost:5433/tea_dev/x_e2e",
		"postgresql://user:12/secret@host/tea_dev",
		"postgresql://tea_owner:/x_e2e?s3cret@localhost:5433/tea_dev",
		"postgresql://localhost:5433/tea_dev%00_e2e",
		"postgresql://localhost:5433/tea_e2e?host=elsewhere",
		"postgresql://localhost:5433/tea_e2e?port=5432",
	])("refuses an unusable URL %j", (value) => {
		expect(decideE2eDatabaseReset({ DATABASE_URL: value }).action).toBe(
			"refuse"
		);
	});

	it.each([
		"postgresql://u@localhost/tea_e2e",
		"postgresql://:pw@localhost/tea_e2e",
		"postgresql://localhost:5433/tea_e2e",
	])("still resets %j", (value) => {
		expect(decideE2eDatabaseReset({ DATABASE_URL: value }).action).toBe(
			"reset"
		);
	});

	it("refuses a malformed address with the generic message", () => {
		expect(
			decideE2eDatabaseReset({
				DATABASE_URL: "postgresql://user:12/secret@host/tea_dev",
			})
		).toEqual({
			action: "refuse",
			message: expect.stringContaining("is not a postgres URL"),
		});
	});

	it("never puts the user name or password in a refusal", () => {
		for (const value of [
			url("tea_dev"),
			"postgresql://tea_owner:s3cret-pw@",
			"postgresql://tea_owner:s3cret-pw@localhost:5433/tea_dev/x_e2e",
			"postgresql://tea_owner:12/s3cret-pw@host/tea_dev",
			"postgresql://tea_owner:12/s3cret?pw@localhost:5433/tea_dev",
			"postgresql://tea_owner:/s3cret#pw@localhost:5433/tea_dev",
			"postgresql://tea_owner:x@s3cret/tea_dev?pw@localhost:5433/tea_dev",
			"postgresql://tea_owner:Pa@s3cret/word_e2e?1@localhost:5433/tea_dev",
			"postgresql://tea_owner:Pa@s3cret/word_e2e#1@localhost:5433/tea_dev",
			"postgresql://tea_owner:/x_e2e?s3cret@localhost:5433/tea_dev",
		]) {
			const decision = decideE2eDatabaseReset({ DATABASE_URL: value });
			expect(decision.action).toBe("refuse");
			const text = JSON.stringify(decision);
			expect(text).not.toContain("s3cret");
			expect(text).not.toContain("tea_owner");
		}
	});
});

describe("runE2eDatabaseReset", () => {
	it("throws before running anything when it refuses", () => {
		const exec = vi.fn();
		expect(() =>
			runE2eDatabaseReset({ DATABASE_URL: url("tea_dev") }, exec)
		).toThrow("Refusing to reset");
		expect(exec).not.toHaveBeenCalled();
	});

	it("runs the reset and the seed with the checked URL", () => {
		const exec = vi.fn();
		const env: Env = { DATABASE_URL: url("tea_e2e"), OTHER: "kept" };
		runE2eDatabaseReset(env, exec);
		expect(exec).toHaveBeenCalledTimes(2);
		for (const call of exec.mock.calls) {
			expect(call[1].env.DATABASE_URL).toBe(url("tea_e2e"));
			expect(call[1].env.OTHER).toBe("kept");
		}
		expect(exec.mock.calls.map((call) => call[0])).toEqual([
			expect.stringContaining("prisma migrate reset"),
			expect.stringContaining("dev-seed"),
		]);
	});

	it("runs nothing when it skips", () => {
		const exec = vi.fn();
		runE2eDatabaseReset({ CI: "true", DATABASE_URL: url("tea_dev") }, exec);
		expect(exec).not.toHaveBeenCalled();
	});

	it("logs the skip when E2E_SKIP_DB_RESET is set but stays quiet under CI", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const exec = vi.fn();
		try {
			runE2eDatabaseReset({ CI: "true" }, exec);
			expect(log).not.toHaveBeenCalled();
			runE2eDatabaseReset({ E2E_SKIP_DB_RESET: "1" }, exec);
			expect(log).toHaveBeenCalledWith(expect.stringContaining("skipping"));
			expect(exec).not.toHaveBeenCalled();
		} finally {
			log.mockRestore();
		}
	});
});
