import { Prisma } from "@/src/generated/prisma";

/** What the database driver reported underneath a Prisma error, when it reported anything. */
function driverCauseOf(
	error: Prisma.PrismaClientKnownRequestError
): { kind?: string; originalCode?: string } | undefined {
	const meta = error.meta as
		| {
				driverAdapterError?: {
					cause?: { kind?: string; originalCode?: string };
				};
		  }
		| undefined;
	return meta?.driverAdapterError?.cause;
}

/**
 * Whether `error` is the database ending a transaction because another one got
 * in first: a deadlock or write conflict. Prisma reports it as P2034, or, when
 * the failing statement was a raw query (such as a row lock), as P2010 with the
 * driver's own cause underneath: Postgres 40P01 (deadlock), or the driver's
 * `TransactionWriteConflict` kind, which it gives to 40P01 and 40001
 * (serialisation failure). Running the same request again is the right
 * response to each.
 */
export function isWriteConflict(error: unknown): boolean {
	if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
		return false;
	}
	const cause = driverCauseOf(error);
	return (
		error.code === "P2034" ||
		cause?.kind === "TransactionWriteConflict" ||
		cause?.originalCode === "40P01"
	);
}
