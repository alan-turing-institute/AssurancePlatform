"use client";

import dynamic from "next/dynamic";

import { ErrorBoundary } from "@/components/ui/error-boundary";

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
 * All child modals use `dynamic(..., { ssr: false })`, so no mounted gate is needed here.
 *
 * @returns {JSX.Element} The JSX for the modals.
 */
export const ModalProvider = (): JSX.Element => (
	<>
		<CaseCreateModal />
		<ErrorBoundary
			fallback={
				<p className="p-4 text-destructive text-sm">
					Something went wrong. Please refresh.
				</p>
			}
		>
			<ImportModal />
		</ErrorBoundary>
		<MigrationModal />
		<ShareModal />
		<PermissionsModal />
		<PublishModal />
		<StatusModalWrapper />
		<EmailModal />
		<ResourcesModal />
		<CreateTeamDialog />
		<InviteMemberDialog />
		<ErrorBoundary
			fallback={
				<p className="p-4 text-destructive text-sm">
					Something went wrong. Please refresh.
				</p>
			}
		>
			<CaseSharingDialog />
		</ErrorBoundary>
	</>
);
