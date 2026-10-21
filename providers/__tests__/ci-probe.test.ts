import { describe, expect, it } from "vitest";

describe("CI probe", () => {
	it("fails on purpose to probe a failing unit shard", () => {
		expect(1).toBe(2);
	});
});
