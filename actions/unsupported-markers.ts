"use server";

import { validateSession } from "@/lib/auth/validate-session";
import { unsupportedMarkerSettingSchema } from "@/lib/schemas/unsupported-markers";

/**
 * Whether the signed-in user has the case diagram's unsupported markers
 * switched on. Returns null when nobody is signed in or the setting cannot be
 * read, so the caller can tell "off" from "unknown".
 */
export async function fetchShowUnsupportedMarkers(): Promise<boolean | null> {
	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	const { getShowUnsupportedMarkers } = await import(
		"@/lib/services/unsupported-marker-service"
	);
	const result = await getShowUnsupportedMarkers(validated.userId);
	if ("error" in result) {
		return null;
	}
	return result.data;
}

/**
 * Saves the signed-in user's choice to show or hide the unsupported markers.
 * Returns the value now stored, or null when nobody is signed in, the input
 * is not a boolean, or the save fails; nothing is written in those cases.
 */
export async function saveShowUnsupportedMarkers(
	show: boolean
): Promise<boolean | null> {
	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	const parsed = unsupportedMarkerSettingSchema.safeParse({ show });
	if (!parsed.success) {
		return null;
	}

	const { setShowUnsupportedMarkers } = await import(
		"@/lib/services/unsupported-marker-service"
	);
	const result = await setShowUnsupportedMarkers(
		validated.userId,
		parsed.data.show
	);
	if ("error" in result) {
		return null;
	}
	return result.data;
}
