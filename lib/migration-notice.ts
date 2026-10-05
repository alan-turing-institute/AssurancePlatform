/**
 * Whether a user should be shown the migration notice: they have no usable
 * email address (missing, or a placeholder), or they have not yet seen it.
 */
export function isMigrationNoticeDue(user: {
	email?: string | null;
	hasSeenMigrationNotice?: boolean;
}): boolean {
	return isEmailMissing(user.email) || !user.hasSeenMigrationNotice;
}

/** Whether an email is absent or one of the placeholder addresses. */
export function isEmailMissing(email?: string | null): boolean {
	return !email || email.includes("@placeholder");
}
