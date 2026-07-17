"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { ErrorBoundary } from "@/components/ui/error-boundary";
// Registers every official plugin's UI modules for the running app (ADR 0002
// v2 §2.3 implementation decision, cid 2026-07-04) — a bare side-effect
// import, so it runs once as this always-mounted, root-level client
// component loads (`app/layout.tsx` renders `<ModalProvider />` for every
// route), before any canvas node or the node-edit dialog can render a slot.
import "@/lib/plugins/bootstrap";

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
const HelpModal = dynamic(
	() => import("@/components/modals/help-modal").then((m) => m.HelpModal),
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
 * @returns {ReactNode} The JSX for the modals.
 */
export const ModalProvider = (): ReactNode => (
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
		<HelpModal />
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
