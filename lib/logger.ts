/**
 * Bespoke structured logger — no vendor SDK, one JSON line per entry on
 * stdout. Runs in every runtime our code runs in: Node server code
 * (services, routes), the Next.js edge runtime (`middleware.ts`), and the
 * browser (components, hooks, store). See the "TEA — Structured logging &
 * OpenTelemetry" issue's Design (G0) section for the rationale.
 *
 * `setLogSink`/`resetLogSink` are the single seam: the post-1.0
 * `instrumentation.ts` swaps the sink for the OpenTelemetry logs bridge
 * without touching any call site, and tests capture entries through the
 * sink instead of spying on `console.*`.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEntry = {
	ts: string;
	level: LogLevel;
	msg: string;
} & Record<string, unknown>;

export interface Logger {
	/** Returns a logger whose entries also carry `bindings`. */
	child(bindings: Record<string, unknown>): Logger;
	debug(message: string, fields?: Record<string, unknown>): void;
	error(message: string, fields?: Record<string, unknown>): void;
	info(message: string, fields?: Record<string, unknown>): void;
	warn(message: string, fields?: Record<string, unknown>): void;
}

type LogSink = (entry: LogEntry) => void;

const LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

/** Above every real level — nothing is emitted when the threshold is this. */
const SILENT_THRESHOLD = 100;

let sink: LogSink | null = null;

function hasNodeStdoutWrite(): boolean {
	return (
		typeof process !== "undefined" &&
		typeof process.stdout?.write === "function"
	);
}

/**
 * `JSON.stringify` replacer: renders any `BigInt` that reached this point as
 * a string (values are also converted earlier in `serialiseValue`, but this
 * is the last line of defence for anything that bypassed it — e.g. a BigInt
 * nested inside a non-plain-object class instance) and breaks reference
 * cycles with a `"[Circular]"` marker. `serialiseFields` already breaks
 * cycles among plain objects/arrays before an entry is built; this replacer
 * additionally covers class instances and Maps/Sets, which `serialiseValue`
 * deliberately passes through unchanged.
 */
function jsonReplacer(): (key: string, value: unknown) => unknown {
	const seen = new WeakSet<object>();
	return (_key: string, value: unknown): unknown => {
		if (typeof value === "bigint") {
			return value.toString();
		}
		if (typeof value === "object" && value !== null) {
			if (seen.has(value)) {
				return "[Circular]";
			}
			seen.add(value);
		}
		return value;
	};
}

/**
 * Never throws: an entry that still can't be stringified (the replacer
 * above should prevent this, but a getter that throws or similar is always
 * possible) falls back to a minimal line carrying `msg` and a
 * `serialisationError` field instead of dropping the entry entirely.
 */
function stringifyEntry(entry: LogEntry): string {
	try {
		return JSON.stringify(entry, jsonReplacer());
	} catch {
		return JSON.stringify({
			ts: entry.ts,
			level: entry.level,
			msg: entry.msg,
			serialisationError: "Failed to serialise log entry",
		});
	}
}

/**
 * Default sink: JSON on `process.stdout` when it exists (Node), otherwise
 * `console[level]` (Next.js edge runtime / browser). Checked at call time,
 * not import time, so the same module serves every runtime.
 */
function defaultSink(entry: LogEntry): void {
	const line = stringifyEntry(entry);
	if (hasNodeStdoutWrite()) {
		process.stdout.write(`${line}\n`);
		return;
	}
	console[entry.level](line);
}

/** Installs a replacement sink — the OpenTelemetry seam, and the test seam. */
export function setLogSink(fn: LogSink): void {
	sink = fn;
}

/** Restores the default stdout/console sink. */
export function resetLogSink(): void {
	sink = null;
}

function isValidLevel(value: string | undefined): value is LogLevel {
	return (
		value === "debug" ||
		value === "info" ||
		value === "warn" ||
		value === "error"
	);
}

/**
 * Threshold is read fresh on every call (not cached at import time) so it
 * follows whatever `LOG_LEVEL`/`NODE_ENV` are at the moment of the call —
 * this is what lets tests toggle it with plain `process.env` writes.
 */
function currentThreshold(): number {
	const env = typeof process === "undefined" ? undefined : process.env;
	const configured = env?.LOG_LEVEL;
	if (isValidLevel(configured)) {
		return LEVEL_ORDER[configured];
	}
	if (env?.NODE_ENV === "test") {
		return SILENT_THRESHOLD;
	}
	return LEVEL_ORDER.info;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object") {
		return false;
	}
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/**
 * Serialises `Error` instances anywhere in a value to `{name, message,
 * stack}`, and `BigInt`s to strings (`JSON.stringify` throws on a raw
 * `BigInt`, and there's no upside to waiting for the sink to find that out).
 */
function serialiseValue(value: unknown, seen: WeakSet<object>): unknown {
	if (typeof value === "bigint") {
		return value.toString();
	}
	if (value instanceof Error) {
		return { name: value.name, message: value.message, stack: value.stack };
	}
	if (Array.isArray(value)) {
		return value.map((item) => serialiseValue(item, seen));
	}
	if (isPlainObject(value)) {
		if (seen.has(value)) {
			return "[Circular]";
		}
		seen.add(value);
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			result[key] = serialiseValue(val, seen);
		}
		return result;
	}
	return value;
}

function serialiseFields(
	fields: Record<string, unknown>
): Record<string, unknown> {
	const seen = new WeakSet<object>();
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(fields)) {
		result[key] = serialiseValue(value, seen);
	}
	return result;
}

function emit(
	level: LogLevel,
	bindings: Record<string, unknown>,
	message: string,
	fields?: Record<string, unknown>
): void {
	try {
		if (LEVEL_ORDER[level] < currentThreshold()) {
			return;
		}
		const entry: LogEntry = {
			ts: new Date().toISOString(),
			level,
			msg: message,
			...serialiseFields(bindings),
			...(fields ? serialiseFields(fields) : {}),
		};
		(sink ?? defaultSink)(entry);
	} catch {
		// Never throw from the logger.
	}
}

function createLogger(bindings: Record<string, unknown>): Logger {
	return {
		debug: (message, fields) => emit("debug", bindings, message, fields),
		info: (message, fields) => emit("info", bindings, message, fields),
		warn: (message, fields) => emit("warn", bindings, message, fields),
		error: (message, fields) => emit("error", bindings, message, fields),
		child: (childBindings) => createLogger({ ...bindings, ...childBindings }),
	};
}

export const logger: Logger = createLogger({});
