"use client";

import { useState } from "react";
import { useChangeDetection } from "@/hooks/use-change-detection";
import { useStatusModal } from "@/hooks/use-status-modal";
import type { RequiredCaseInformationField } from "@/lib/schemas/case-information";
import { toast } from "@/lib/toast";
import useStore from "@/store/store";
import { StatusModal } from "./status-modal";

/**
 * Wrapper component that connects StatusModal to the useStatusModal store
 * and handles API calls for status transitions.
 *
 * This component is rendered by ModalProvider.
 */
export function StatusModalWrapper() {
	const {
		assuranceCase,
		setAssuranceCase,
		setCaseDetailsOpen,
		setCaseInformationFocusField,
	} = useStore();
	const statusModal = useStatusModal();
	const [loading, setLoading] = useState(false);
	const [publishLoading, setPublishLoading] = useState(false);
	const [unpublishLoading, setUnpublishLoading] = useState(false);

	// Use change detection when the modal is open and status is PUBLISHED —
	// this is the asynchronous half of the divergence indicator; the modal
	// itself is already visible before this resolves (never gates first
	// paint, per the ADR 0003 issue's hard requirement).
	const { hasChanges, refresh: refreshChanges } = useChangeDetection({
		caseId: statusModal.caseId,
		enabled: statusModal.isOpen && statusModal.status === "PUBLISHED",
	});

	const handleStatusTransition = async (
		targetStatus: "DRAFT" | "PUBLISHED",
		description?: string,
		setBusy: (busy: boolean) => void = setLoading
	) => {
		if (!statusModal.caseId) {
			return;
		}

		setBusy(true);

		try {
			const response = await fetch(`/api/cases/${statusModal.caseId}/status`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ targetStatus, description }),
			});

			const result = await response.json();

			if (!response.ok) {
				toast({
					variant: "destructive",
					title: "Status change failed",
					description: result.error || "An error occurred",
				});
				return;
			}

			// Update the store
			if (assuranceCase) {
				setAssuranceCase({
					...assuranceCase,
					published: targetStatus === "PUBLISHED",
					publishStatus: targetStatus,
					publishedAt: result.publishedAt ?? assuranceCase.publishedAt,
					markedReadyAt: result.markedReadyAt,
				});
			}

			// Update modal state
			statusModal.updateState({
				status: targetStatus,
				publishedAt: result.publishedAt,
			});

			// Show success toast
			const messages: Record<string, { title: string; description: string }> = {
				DRAFT: {
					title: "Case unpublished",
					description: "The public record has been removed",
				},
				PUBLISHED: {
					title: "Case published",
					description: "Your case is now publicly available",
				},
			};

			toast({
				variant: "success",
				...messages[targetStatus],
			});

			// Refresh change detection if now published
			if (targetStatus === "PUBLISHED") {
				refreshChanges();
			}

			// Unpublish (DRAFT target) isn't wrapped by StatusModal's own
			// `handleAction` the way "Update Published" is — close explicitly on
			// success so the dialog doesn't linger and flip to showing the
			// Publish flow for the now-draft case. Harmless no-op if already
			// closing via the other path.
			statusModal.onClose();
		} catch {
			toast({
				variant: "destructive",
				title: "Error",
				description: "Something went wrong",
			});
		} finally {
			setBusy(false);
		}
	};

	const handleUpdatePublished = async () => {
		await handleStatusTransition("PUBLISHED");
	};

	const handleUnpublish = async () => {
		await handleStatusTransition("DRAFT", undefined, setUnpublishLoading);
	};

	// The first publish (DRAFT -> PUBLISHED) goes through the dedicated
	// publish route rather than `handleStatusTransition`'s PATCH /status —
	// this is the route the completeness gate (ADR 0003 §4) lives on
	// (`POST /api/cases/[id]/publish`, see lib/services/publish-service.ts).
	const handlePublish = async () => {
		if (!statusModal.caseId) {
			return;
		}

		setPublishLoading(true);
		try {
			const response = await fetch(`/api/cases/${statusModal.caseId}/publish`, {
				method: "POST",
			});
			const result = await response.json();

			if (!response.ok) {
				toast({
					variant: "destructive",
					title: "Unable to publish case",
					description: result.error || "An error occurred while publishing",
				});
				return;
			}

			if (assuranceCase) {
				setAssuranceCase({
					...assuranceCase,
					published: true,
					publishStatus: "PUBLISHED",
					publishedAt: result.published_at,
				});
			}

			statusModal.updateState({
				status: "PUBLISHED",
				publishedAt: result.published_at,
			});

			toast({
				variant: "success",
				title: "Case published",
				description: "Your case is now publicly available",
			});

			statusModal.onClose();
		} catch {
			toast({
				variant: "destructive",
				title: "Error",
				description: "Something went wrong while publishing",
			});
		} finally {
			setPublishLoading(false);
		}
	};

	// Sends the user to the case-information pane, focused on a specific
	// missing field (ADR 0003 §2 — "opening the case information form
	// focused on them"), closing this status dialog first so the two
	// overlays don't stack.
	const handleRequestCaseInformation = (
		field: RequiredCaseInformationField
	) => {
		statusModal.onClose();
		setCaseInformationFocusField(field);
		setCaseDetailsOpen(true);
	};

	return (
		<StatusModal
			caseId={statusModal.caseId}
			hasChanges={hasChanges || statusModal.hasChanges}
			onOpenChange={(open) => {
				if (!open) {
					statusModal.onClose();
				}
			}}
			onPublish={handlePublish}
			onRequestCaseInformation={handleRequestCaseInformation}
			onUnpublish={handleUnpublish}
			onUpdatePublished={loading ? undefined : handleUpdatePublished}
			open={statusModal.isOpen}
			publishedAt={statusModal.publishedAt}
			publishLoading={publishLoading}
			status={statusModal.status}
			unpublishLoading={unpublishLoading}
		/>
	);
}
