import { afterEach, describe, expect, it, vi } from "vitest";
import { modelTimeoutMs, techniquesTimeoutMs } from "../model-timeout";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("modelTimeoutMs", () => {
	it("defaults to 60000 when unset or empty", () => {
		expect(modelTimeoutMs(undefined)).toBe(60_000);
		expect(modelTimeoutMs("")).toBe(60_000);
	});

	it("uses an in-range integer as given", () => {
		expect(modelTimeoutMs("90000")).toBe(90_000);
	});

	it("raises a value below the range to 5000", () => {
		expect(modelTimeoutMs("100")).toBe(5000);
	});

	it("lowers a value above the range to 600000", () => {
		expect(modelTimeoutMs("9999999")).toBe(600_000);
	});

	it("falls back to the default for a non-number", () => {
		expect(modelTimeoutMs("soon")).toBe(60_000);
		expect(modelTimeoutMs("12.5")).toBe(60_000);
	});

	it("reads the environment variable at call time", () => {
		vi.stubEnv("ASSISTANT_MODEL_TIMEOUT_MS", "20000");
		expect(modelTimeoutMs()).toBe(20_000);
		vi.stubEnv("ASSISTANT_MODEL_TIMEOUT_MS", "30000");
		expect(modelTimeoutMs()).toBe(30_000);
	});
});

describe("techniquesTimeoutMs", () => {
	it("defaults to 70000 when unset or empty", () => {
		expect(techniquesTimeoutMs(undefined)).toBe(70_000);
		expect(techniquesTimeoutMs("")).toBe(70_000);
	});

	it("uses an in-range integer as given", () => {
		expect(techniquesTimeoutMs("90000")).toBe(90_000);
	});

	it("raises a value below the range to 5000", () => {
		expect(techniquesTimeoutMs("100")).toBe(5000);
	});

	it("lowers a value above the range to 600000", () => {
		expect(techniquesTimeoutMs("9999999")).toBe(600_000);
	});

	it("falls back to the default for a non-number", () => {
		expect(techniquesTimeoutMs("soon")).toBe(70_000);
		expect(techniquesTimeoutMs("12.5")).toBe(70_000);
	});

	it("reads the environment variable at call time", () => {
		vi.stubEnv("ASSISTANT_TECHNIQUES_TIMEOUT_MS", "20000");
		expect(techniquesTimeoutMs()).toBe(20_000);
		vi.stubEnv("ASSISTANT_TECHNIQUES_TIMEOUT_MS", "30000");
		expect(techniquesTimeoutMs()).toBe(30_000);
	});

	it("is independent of the model timeout", () => {
		vi.stubEnv("ASSISTANT_MODEL_TIMEOUT_MS", "20000");
		expect(techniquesTimeoutMs()).toBe(70_000);
	});
});
