/** A plain identifier of at most 64 characters: what a class name looks like. */
const CLASS_NAME = /^[A-Za-z_$][\w$]{0,63}$/;

/**
 * The class name of a thrown value, for a log entry; `"unknown"` for anything
 * else. It never throws: a getter or a proxy trap on the thrown value that
 * throws gives `"unknown"`, so a `catch` block that calls it cannot throw in
 * turn. A name that is not a plain identifier is also `"unknown"`, since a
 * name is set by whatever threw and can hold any text.
 *
 * This module imports nothing, so code that must stay clear of the logger
 * chain can use it.
 */
export function errorClassName(thrown: unknown): string {
	try {
		if (!(thrown instanceof Error)) {
			return "unknown";
		}
		const name: unknown = thrown.name;
		return typeof name === "string" && CLASS_NAME.test(name) ? name : "unknown";
	} catch {
		return "unknown";
	}
}
