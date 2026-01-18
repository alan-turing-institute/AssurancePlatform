"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Dynamic imports with ssr: false to reduce initial bundle size
const CaseCreateModal = dynamic(
	() =>
		import("@/components/modals/case-create-modal").then(
			(m) => m.CaseCreateModal
		),
	{ ssr: false }
);
const EmailModal = dynamic(
	() => import("@/components/modals/email-modal").then((m) => m.EmailModal),
	{ ssr: false }
);
const ImportModal = dynamic(
	() => import("@/components/modals/import-modal").then((m) => m.ImportModal),
	{ ssr: false }
);
const MigrationModal = dynamic(
	() =>
		import("@/components/modals/migration-modal").then((m) => m.MigrationModal),
	{ ssr: false }
);
const PermissionsModal = dynamic(
	() =>
		import("@/components/modals/permissions-modal").then(
			(m) => m.PermissionsModal
		),
	{ ssr: false }
);
const PublishModal = dynamic(
	() => import("@/components/modals/publish-modal").then((m) => m.PublishModal),
	{ ssr: false }
);
const ResourcesModal = dynamic(
	() =>
		import("@/components/modals/resources-modal").then((m) => m.ResourcesModal),
	{ ssr: false }
);
const ShareModal = dynamic(
	() => import("@/components/modals/share-modal").then((m) => m.ShareModal),
	{ ssr: false }
);
const StatusModalWrapper = dynamic(
	() =>
		import("@/components/publishing/status-modal-wrapper").then(
			(m) => m.StatusModalWrapper
		),
	{ ssr: false }
);
const CaseSharingDialog = dynamic(
	() => import("@/components/sharing").then((m) => m.CaseSharingDialog),
	{ ssr: false }
);
const CreateTeamDialog = dynamic(
	() => import("@/components/teams").then((m) => m.CreateTeamDialog),
	{ ssr: false }
);
const InviteMemberDialog = dynamic(
	() => import("@/components/teams").then((m) => m.InviteMemberDialog),
	{ ssr: false }
);

/**
 * ModalProvider component that renders several modals for different functionalities.
 *
 * This component manages the mounting state to prevent server-side rendering issues with modals in Next.js.
 * It uses a `useState` hook to track if the component is mounted and a `useEffect` hook to update this state after mounting.
 * The component returns `null` if it is not mounted yet to prevent any rendering issues.
 *
 * @returns {JSX.Element | null} The JSX for the modals when the component is mounted, or `null` if not mounted.
 */
export const ModalProvider = (): JSX.Element | null => {
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		// Set mounted state to true after the component is mounted
		setIsMounted(true);
	}, []);

	if (!isMounted) {
		// Return null to prevent rendering modals during server-side rendering
		return null;
	}

	return (
		<>
			<CaseCreateModal />
			<ImportModal />
			<MigrationModal />
			<ShareModal />
			<PermissionsModal />
			<PublishModal />
			<StatusModalWrapper />
			<EmailModal />
			<ResourcesModal />
			<CreateTeamDialog />
			<InviteMemberDialog />
			<CaseSharingDialog />
		</>
	);
};
