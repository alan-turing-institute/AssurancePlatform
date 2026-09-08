import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";

/**
 * Test seam for the structured logger: installs a sink that pushes every
 * emitted entry into `entries`, and temporarily raises `LOG_LEVEL` so the
 * suite's default `NODE_ENV=test` silence (see `lib/logger.ts`) doesn't
 * swallow the very entries the test wants to assert on. Call `restore()` in
 * a `finally`/`afterEach` to put both back.
 */
export function captureLogs(): { entries: LogEntry[]; restore: () => void } {
	const entries: LogEntry[] = [];
	const previousLogLevel = process.env.LOG_LEVEL;

	process.env.LOG_LEVEL = "debug";
	setLogSink((entry) => {
		entries.push(entry);
	});

	return {
		entries,
		restore(): void {
			resetLogSink();
			if (previousLogLevel === undefined) {
				Reflect.deleteProperty(process.env, "LOG_LEVEL");
			} else {
				process.env.LOG_LEVEL = previousLogLevel;
			}
		},
	};
}
