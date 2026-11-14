import { z } from "zod";

/**
 * The account setting that decides whether the case diagram marks a goal,
 * strategy or claim with nothing beneath it. `show` is a strict boolean: a
 * string such as "false" is refused rather than coerced, so a malformed call
 * cannot switch the markers off by accident.
 */
export const unsupportedMarkerSettingSchema = z.strictObject({
	show: z.boolean(),
});
