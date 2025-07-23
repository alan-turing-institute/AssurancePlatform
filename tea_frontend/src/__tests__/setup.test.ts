import { describe, expect, it, vi } from "vitest";

describe("Test Setup", () => {
	it("should run basic test", () => {
		expect(1 + 1).toBe(2);
	});

	it("should have DOM globals available", () => {
		expect(typeof window).toBe("object");
		expect(typeof document).toBe("object");
	});

	it("should have vitest globals available", () => {
		expect(typeof vi).toBe("object");
		expect(typeof expect).toBe("function");
	});
});
