"use client";

import { useEffect } from "react";
import { useMigrationModal } from "@/hooks/use-migration-modal";

type CheckMigrationNoticeProps = {
	user: {
		email?: string | null;
		hasSeenMigrationNotice?: boolean;
	} | null;
};

/**
 * Component that checks if the migration notice modal should be shown.
 *
 * Shows the modal if:
 * - User is missing a valid email (includes placeholder emails)
 * - User hasn't seen the migration notice yet
 *
 * For users without email, the modal will show on every load until they add one.
 * For users with email, it shows once and is dismissed when closed.
 */
const CheckMigrationNotice = ({ user }: CheckMigrationNoticeProps) => {
	const onOpen = useMigrationModal((state) => state.onOpen);

	useEffect(() => {
		if (!user) {
			return;
		}

		// Check if user is missing a valid email (including placeholder emails)
		const isMissingEmail = !user.email || user.email.includes("@placeholder");

		// Show modal if:
		// 1. User is missing email (will show every time until email is added)
		// 2. User has email but hasn't seen the migration notice yet
		if (isMissingEmail || !user.hasSeenMigrationNotice) {
			onOpen(isMissingEmail);
		}
	}, [user, onOpen]);

	return null;
};

export default CheckMigrationNotice;
