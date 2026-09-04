import { afterEach, describe, expect, it, vi } from "vitest";
import { type LogEntry, logger, resetLogSink, setLogSink } from "@/lib/logger";

function capture(): LogEntry[] {
	const entries: LogEntry[] = [];
	setLogSink((entry) => {
		entries.push(entry);
	});
	return entries;
}

describe("logger", () => {
	afterEach(() => {
		resetLogSink();
		vi.unstubAllEnvs();
	});

	it("emits one JSON-shaped entry with ts/level/msg plus fields", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries = capture();

		logger.info("hello", { a: 1 });

		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ level: "info", msg: "hello", a: 1 });
		expect(typeof entries[0]!.ts).toBe("string");
		expect(Number.isNaN(Date.parse(entries[0]!.ts))).toBe(false);
	});

	it("suppresses entries below the LOG_LEVEL threshold", () => {
		vi.stubEnv("LOG_LEVEL", "warn");
		const entries = capture();

		logger.debug("suppressed");
		logger.info("also suppressed");
		logger.warn("kept");

		expect(entries.map((entry) => entry.msg)).toEqual(["kept"]);
	});

	it("defaults to the info threshold outside a test environment", () => {
		vi.stubEnv("LOG_LEVEL", "");
		vi.stubEnv("NODE_ENV", "production");
		const entries = capture();

		logger.debug("suppressed");
		logger.info("kept");

		expect(entries.map((entry) => entry.msg)).toEqual(["kept"]);
	});

	it("is silent under NODE_ENV=test unless LOG_LEVEL is set", () => {
		vi.stubEnv("LOG_LEVEL", "");
		vi.stubEnv("NODE_ENV", "test");
		const entries = capture();

		logger.error("should not appear");

		expect(entries).toHaveLength(0);
	});

	it("child() merges bindings into every entry alongside per-call fields", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries = capture();

		const child = logger.child({ component: "security" });
		child.warn("event happened", { userId: "u1" });

		expect(entries[0]).toMatchObject({
			component: "security",
			userId: "u1",
			msg: "event happened",
			level: "warn",
		});
	});

	it("serialises an Error field to {name, message, stack}", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries = capture();

		logger.error("failed", { error: new Error("boom") });

		expect(entries[0]!.error).toMatchObject({ name: "Error", message: "boom" });
		expect(typeof (entries[0]!.error as { stack: string }).stack).toBe(
			"string"
		);
	});

	it("serialises an Error nested inside a plain-object field", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries = capture();

		logger.error("failed", { context: { cause: new Error("nested") } });

		expect((entries[0]!.context as { cause: unknown }).cause).toMatchObject({
			name: "Error",
			message: "nested",
		});
	});

	it("setLogSink swaps the sink and resetLogSink restores the default", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries = capture();
		resetLogSink();

		const writeSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		try {
			logger.info("via default sink");
			expect(writeSpy).toHaveBeenCalledTimes(1);
			expect(entries).toHaveLength(0);
		} finally {
			writeSpy.mockRestore();
		}
	});

	it("never throws even when the sink itself throws", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		setLogSink(() => {
			throw new Error("sink exploded");
		});

		expect(() => logger.info("x")).not.toThrow();
	});

	it("does not throw and still emits when a field holds a circular reference", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		resetLogSink();

		// A class instance, not a plain object — `serialiseValue` deliberately
		// passes these through unchanged, so this exercises the JSON.stringify
		// replacer's own cycle-breaking, not the earlier plain-object guard
		// already covered by the "nested inside a plain-object field" test.
		class Node {
			self?: Node;
		}
		const node = new Node();
		node.self = node;

		const writeSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		try {
			expect(() => logger.info("circular", { node })).not.toThrow();
			expect(writeSpy).toHaveBeenCalledTimes(1);
			const line = writeSpy.mock.calls[0]?.[0] as string;
			const parsed = JSON.parse(line);
			expect(parsed.msg).toBe("circular");
			expect(parsed.node.self).toBe("[Circular]");
		} finally {
			writeSpy.mockRestore();
		}
	});

	it("does not throw and still emits when a field holds a BigInt", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		resetLogSink();

		const writeSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		try {
			expect(() => logger.info("bigint", { big: BigInt(10) })).not.toThrow();
			expect(writeSpy).toHaveBeenCalledTimes(1);
			const line = writeSpy.mock.calls[0]?.[0] as string;
			const parsed = JSON.parse(line);
			expect(parsed.msg).toBe("bigint");
			expect(parsed.big).toBe("10");
		} finally {
			writeSpy.mockRestore();
		}
	});

	it.each([
		"ts",
		"level",
		"msg",
	] as const)("keeps the entry's own %s when a field collides, under caller_%s", (key) => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries = capture();

		logger.info("hello", { [key]: "spoofed" });

		expect(entries[0]?.[key]).not.toBe("spoofed");
		expect(entries[0]?.[`caller_${key}`]).toBe("spoofed");
	});

	it.each([
		"ts",
		"level",
		"msg",
	] as const)("keeps the entry's own %s when a binding collides, under caller_%s", (key) => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries = capture();

		const child = logger.child({ [key]: "spoofed" });
		child.info("hello");

		expect(entries[0]?.[key]).not.toBe("spoofed");
		expect(entries[0]?.[`caller_${key}`]).toBe("spoofed");
	});

	it("keeps a bound component when a per-call field collides, under caller_component", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		const entries = capture();

		const child = logger.child({ component: "security" });
		child.info("hello", { component: "spoofed" });

		expect(entries[0]?.component).toBe("security");
		expect(entries[0]?.caller_component).toBe("spoofed");
	});

	it("falls back to console[level] when process.stdout.write is unavailable", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		resetLogSink();
		const originalWrite = process.stdout.write;
		// @ts-expect-error — simulating an edge/browser runtime with no stdout.write
		process.stdout.write = undefined;
		const consoleInfoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		try {
			logger.info("edge path", { runtime: "edge" });

			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
			const line = consoleInfoSpy.mock.calls[0]?.[0] as string;
			const parsed = JSON.parse(line);
			expect(parsed).toMatchObject({ level: "info", msg: "edge path" });
		} finally {
			process.stdout.write = originalWrite;
			consoleInfoSpy.mockRestore();
		}
	});
});
