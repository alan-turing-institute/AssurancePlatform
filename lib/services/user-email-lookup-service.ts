import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/src/generated/prisma";

const log = logger.child({ component: "user-email-lookup" });

/**
 * Finds the one account whose stored email equals `email` ignoring capitals,
 * for callers that have already tried the exact text and found nothing.
 *
 * Stored emails are not all lowercase: GitHub and Google sign-up keep the
 * address as the provider sent it, and imported accounts keep it as typed.
 * The comparison is `lower(email) = lower($1)` in a parameterised raw query,
 * so `%` and `_` in the typed value are ordinary characters (Prisma's
 * `mode: "insensitive"` is a `LIKE`, where they are wildcards).
 *
 * Two or more matches mean two accounts differ only in capitals. Neither is
 * returned, so a sign-in or reset never lands on the wrong person's account;
 * the event is logged without the typed value.
 */
export async function findUserByEmailIgnoringCase<S extends Prisma.UserSelect>(
	email: string,
	select: S
): Promise<Prisma.UserGetPayload<{ select: S }> | null> {
	const matches = await prisma.$queryRaw<Array<{ id: string }>>`
		SELECT id FROM users WHERE lower(email) = lower(${email}) LIMIT 2
	`;

	if (matches.length > 1) {
		log.warn("sign_in_identifier_ambiguous");
		return null;
	}

	const match = matches[0];
	if (!match) {
		return null;
	}

	// The generic `select` is applied by Prisma; TypeScript cannot narrow the
	// payload type of a call whose `select` is a type parameter.
	return (await prisma.user.findUnique({
		where: { id: match.id },
		select,
	})) as Prisma.UserGetPayload<{ select: S }> | null;
}
