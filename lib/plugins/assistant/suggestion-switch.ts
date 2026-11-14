/** Values that leave the suggestions on, so that `ASSISTANT_SUGGESTIONS_DISABLED=false` does not switch them off. */
const LEAVES_ON = new Set(["", "0", "false", "no", "off"]);

/**
 * Whether the deployment has switched the assistant's suggestion tools off,
 * read from ASSISTANT_SUGGESTIONS_DISABLED on every call. Unset, empty, `0`,
 * `false`, `no` and `off` leave them on; any other value switches them off for
 * everyone, which returns the assistant to read-only with no code change.
 */
export function suggestionsSwitchedOff(
	raw: string | undefined = process.env.ASSISTANT_SUGGESTIONS_DISABLED
): boolean {
	return !LEAVES_ON.has(raw?.trim().toLowerCase() ?? "");
}
