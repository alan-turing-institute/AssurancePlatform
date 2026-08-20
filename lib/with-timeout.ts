/**
 * Races a promise against a wall-clock timeout, rejecting with
 * `TimeoutError` if it hasn't settled in time.
 *
 * Defense-in-depth for server-side hangs (e.g. DB connection-pool
 * contention) that would otherwise leave a request open indefinitely — see
 * `lib/prisma.ts` for the primary fix (a bounded connection-acquisition
 * wait) and "TEA — Status endpoint can hang indefinitely" for the incident
 * this guards against. This is a second, independent backstop: even if some
 * future slow path has no bounded wait of its own, the route still returns
 * a response instead of hanging on the client forever.
 *
 * Does NOT cancel the underlying work — there is no `AbortSignal` plumbed
 * through Prisma/pg here — it only bounds how long the *caller* waits, so a
 * client always gets a timely response even if server-side work is stuck.
 */
export class TimeoutError extends Error {
	constructor(ms: number) {
		super(`Operation timed out after ${ms}ms`);
		this.name = "TimeoutError";
	}
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			}
		);
	});
}
