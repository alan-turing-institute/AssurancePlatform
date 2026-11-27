import { afterEach, describe, expect, it, vi } from "vitest";
import { type LogEntry, logger, resetLogSink, setLogSink } from "@/lib/logger";

function capture(): LogEntry[] {
	const entries: LogEntry[] = [];
	setLogSink((entry) => {
		entries.push(entry);
	});
	return entries;
}

const ALL_LEVELS = ["debug", "info", "warn", "error"] as const;

/** Logs one message at each level and returns the levels that were written. */
function levelsWritten(): string[] {
	const entries = capture();
	for (const level of ALL_LEVELS) {
		logger[level](level);
	}
	return entries.map((entry) => entry.level);
}

/** Runs `fn` against the default sink and returns each line written to stdout. */
function stdoutLines(fn: () => void): string[] {
	resetLogSink();
	const writeSpy = vi
		.spyOn(process.stdout, "write")
		.mockImplementation(() => true);
	fn();
	return writeSpy.mock.calls.map((call) => String(call[0]));
}

class Holder {
	big = BigInt(10);
	label = "kept";
}

class Exploding {
	toJSON(): never {
		throw new Error("cannot serialise");
	}
}

describe("logger threshold", () => {
	afterEach(() => {
		resetLogSink();
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it.each([
		["debug", ["debug", "info", "warn", "error"]],
		["info", ["info", "warn", "error"]],
		["warn", ["warn", "error"]],
		["error", ["error"]],
	])("writes the levels at or above LOG_LEVEL=%s", (configured, expected) => {
		vi.stubEnv("NODE_ENV", "test");
		vi.stubEnv("LOG_LEVEL", configured);

		expect(levelsWritten()).toStrictEqual(expected);
	});

	it.each([
		["production", ["info", "warn", "error"]],
		["development", ["info", "warn", "error"]],
		["test", []],
	])("with no LOG_LEVEL and NODE_ENV=%s writes %j", (nodeEnv, expected) => {
		vi.stubEnv("NODE_ENV", nodeEnv);
		vi.stubEnv("LOG_LEVEL", "");

		expect(levelsWritten()).toStrictEqual(expected);
	});

	it.each([
		["production", ["info", "warn", "error"]],
		["test", []],
	])("treats an unknown or wrongly cased LOG_LEVEL as unset under NODE_ENV=%s", (nodeEnv, expected) => {
		vi.stubEnv("NODE_ENV", nodeEnv);
		for (const configured of ["verbose", "INFO", " info", "silent"]) {
			vi.stubEnv("LOG_LEVEL", configured);
			expect(levelsWritten()).toStrictEqual(expected);
		}
	});

	it("follows a change of LOG_LEVEL between calls", () => {
		vi.stubEnv("NODE_ENV", "test");
		vi.stubEnv("LOG_LEVEL", "error");
		expect(levelsWritten()).toStrictEqual(["error"]);

		vi.stubEnv("LOG_LEVEL", "debug");
		expect(levelsWritten()).toHaveLength(4);
	});
});

describe("logger entries", () => {
	beforeEach(() => {
		vi.stubEnv("LOG_LEVEL", "debug");
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));
	});

	afterEach(() => {
		resetLogSink();
		vi.useRealTimers();
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it.each(
		ALL_LEVELS
	)("logger.%s writes an entry at that level with the message, the time and the fields", (level) => {
		const entries = capture();

		logger[level]("hello", { a: 1 });

		expect(entries).toStrictEqual([
			{ ts: "2026-07-04T12:00:00.000Z", level, msg: "hello", a: 1 },
		]);
	});

	it("writes only ts, level and msg when there are no fields", () => {
		const entries = capture();

		logger.info("bare");

		expect(Object.keys(entries[0] ?? {}).sort()).toStrictEqual([
			"level",
			"msg",
			"ts",
		]);
	});

	it("carries a child's component on every entry and leaves the parent unchanged", () => {
		const entries = capture();
		const child = logger.child({ component: "billing" });

		child.info("from child");
		logger.info("from parent");

		expect(entries[0]?.component).toBe("billing");
		expect("component" in (entries[1] ?? {})).toBe(false);
	});

	it("merges a grandchild's bindings over its parent's and fields over bindings", () => {
		const entries = capture();
		const grandchild = logger
			.child({ component: "outer", scope: "a", shared: "from-parent" })
			.child({ component: "inner", shared: "from-child" });

		grandchild.info("m", { shared: "from-call", extra: true });

		expect(entries[0]).toStrictEqual({
			ts: "2026-07-04T12:00:00.000Z",
			level: "info",
			msg: "m",
			component: "inner",
			scope: "a",
			shared: "from-call",
			extra: true,
		});
	});

	it("serialises an Error field to exactly its name, message and stack", () => {
		const entries = capture();

		logger.error("failed", { error: new TypeError("boom") });

		expect(entries[0]?.error).toStrictEqual({
			name: "TypeError",
			message: "boom",
			stack: expect.any(String),
		});
	});

	it("serialises Errors and BigInts inside plain objects and arrays", () => {
		const entries = capture();

		logger.error("failed", {
			context: { cause: new Error("nested"), big: BigInt(7) },
			list: [new Error("in list"), BigInt(5), { n: BigInt(6) }, "text", 3],
		});

		expect(entries[0]?.context).toStrictEqual({
			cause: { name: "Error", message: "nested", stack: expect.any(String) },
			big: "7",
		});
		expect(entries[0]?.list).toStrictEqual([
			{ name: "Error", message: "in list", stack: expect.any(String) },
			"5",
			{ n: "6" },
			"text",
			3,
		]);
	});

	it("serialises an Error inside an object that has no prototype", () => {
		const entries = capture();
		const dictionary = Object.create(null) as Record<string, unknown>;
		dictionary.err = new Error("in dictionary");

		logger.error("failed", { dictionary });

		expect(entries[0]?.dictionary).toStrictEqual({
			err: {
				name: "Error",
				message: "in dictionary",
				stack: expect.any(String),
			},
		});
	});

	it("keeps null and primitive field values as they are", () => {
		const entries = capture();

		logger.info("values", { none: null, flag: false, zero: 0, text: "" });

		expect(entries[0]).toMatchObject({
			none: null,
			flag: false,
			zero: 0,
			text: "",
		});
	});

	it("passes class instances and dates through unchanged", () => {
		const entries = capture();
		const holder = new Holder();
		const when = new Date("2026-01-01T00:00:00.000Z");

		logger.info("instances", { holder, when });

		expect(entries[0]?.holder).toBe(holder);
		expect(entries[0]?.when).toBe(when);
	});

	it("marks a cycle among plain objects", () => {
		const entries = capture();
		const loop: Record<string, unknown> = { name: "loop" };
		loop.self = loop;

		logger.info("cycle", { loop });

		expect(entries[0]?.loop).toStrictEqual({
			name: "loop",
			self: "[Circular]",
		});
	});

	it("does not change the object the caller passed in", () => {
		capture();
		const fields = { msg: "mine", error: new Error("x") };

		logger.info("note", fields);

		expect(fields.msg).toBe("mine");
		expect(fields.error).toBeInstanceOf(Error);
		expect(Object.keys(fields)).toStrictEqual(["msg", "error"]);
	});

	it("writes one JSON line ending in a newline to stdout by default", () => {
		const lines = stdoutLines(() => logger.warn("to stdout", { n: 1 }));

		expect(lines).toHaveLength(1);
		expect(lines[0]?.endsWith("\n")).toBe(true);
		expect(JSON.parse(lines[0] ?? "")).toStrictEqual({
			ts: "2026-07-04T12:00:00.000Z",
			level: "warn",
			msg: "to stdout",
			n: 1,
		});
	});

	it("writes null field values to stdout as null", () => {
		const lines = stdoutLines(() => logger.info("nulls", { none: null }));

		expect(JSON.parse(lines[0] ?? "").none).toBeNull();
	});

	it("writes a BigInt held inside a class instance to stdout as a string", () => {
		const lines = stdoutLines(() =>
			logger.info("nested", { holder: new Holder() })
		);

		expect(JSON.parse(lines[0] ?? "").holder).toStrictEqual({
			big: "10",
			label: "kept",
		});
	});

	it("writes a reduced entry when a field cannot be turned into JSON", () => {
		const lines = stdoutLines(() =>
			logger.error("broken", { bad: new Exploding(), other: "dropped" })
		);

		expect(lines).toHaveLength(1);
		const parsed = JSON.parse(lines[0] ?? "");
		expect(Object.keys(parsed).sort()).toStrictEqual([
			"level",
			"msg",
			"serialisationError",
			"ts",
		]);
		expect(parsed).toMatchObject({
			ts: "2026-07-04T12:00:00.000Z",
			level: "error",
			msg: "broken",
		});
		expect(typeof parsed.serialisationError).toBe("string");
	});

	it("sends the entry to the sink and not to stdout once a sink is set", () => {
		const entries: LogEntry[] = [];
		const writeSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		setLogSink((entry) => entries.push(entry));

		logger.info("to sink");

		expect(entries).toHaveLength(1);
		expect(writeSpy).not.toHaveBeenCalled();
	});
});

describe("logger", () => {
	afterEach(() => {
		resetLogSink();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
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

	it("falls back to console[level] when there is no process at all", () => {
		vi.stubEnv("LOG_LEVEL", "debug");
		resetLogSink();
		const consoleInfoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);
		vi.stubGlobal("process", undefined);

		logger.info("browser path", { runtime: "browser" });
		vi.unstubAllGlobals();

		expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
		const parsed = JSON.parse(consoleInfoSpy.mock.calls[0]?.[0] as string);
		expect(parsed).toMatchObject({ msg: "browser path", runtime: "browser" });
	});

	it("uses the info threshold when there is no process to read settings from", () => {
		resetLogSink();
		const consoleSpies = {
			debug: vi.spyOn(console, "debug").mockImplementation(() => undefined),
			info: vi.spyOn(console, "info").mockImplementation(() => undefined),
		};
		vi.stubGlobal("process", undefined);

		logger.debug("quiet");
		logger.info("loud");
		vi.unstubAllGlobals();

		expect(consoleSpies.debug).not.toHaveBeenCalled();
		expect(consoleSpies.info).toHaveBeenCalledTimes(1);
	});

	it("falls back to console[level] when process has no stdout", () => {
		resetLogSink();
		const consoleWarnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);
		vi.stubGlobal("process", { env: { LOG_LEVEL: "debug" } });

		logger.warn("no stdout");
		vi.unstubAllGlobals();

		expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
		expect(
			JSON.parse(consoleWarnSpy.mock.calls[0]?.[0] as string)
		).toMatchObject({ level: "warn", msg: "no stdout" });
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
