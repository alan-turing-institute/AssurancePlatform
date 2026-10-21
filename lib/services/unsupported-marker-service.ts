/**
 * Unsupported-marker setting service
 *
 * Reads and writes the account setting that decides whether the case diagram
 * marks a goal, strategy or claim with nothing beneath it. The setting
 * belongs to the signed-in user and is never a property of a case, so every
 * viewer of a case sees the markers by their own choice.
 */

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ component: "unsupported-marker-service" });

/** Same text as the other per-user lookups: a missing account is not told apart from a refused one. */
const NO_SUCH_USER = "Permission denied";

/**
 * Whether the user has the unsupported markers switched on. Every account
 * starts with them on.
 */
export async function getShowUnsupportedMarkers(
	userId: string
): ServiceResult<boolean> {
	try {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { showUnsupportedMarkers: true },
		});

		if (!user) {
			return { error: NO_SUCH_USER };
		}

		return { data: user.showUnsupportedMarkers };
	} catch (error) {
		log.error("getShowUnsupportedMarkers", { userId, error });
		return { error: "Failed to fetch the unsupported marker setting" };
	}
}

/**
 * Switches the unsupported markers on or off for the user, and returns the
 * value now stored. Saving the value a user already has changes nothing.
 */
export async function setShowUnsupportedMarkers(
	userId: string,
	show: boolean
): ServiceResult<boolean> {
	try {
		const { count } = await prisma.user.updateMany({
			where: { id: userId },
			data: { showUnsupportedMarkers: show },
		});

		if (count === 0) {
			return { error: NO_SUCH_USER };
		}

		return { data: show };
	} catch (error) {
		log.error("setShowUnsupportedMarkers", { userId, show, error });
		return { error: "Failed to save the unsupported marker setting" };
	}
}
