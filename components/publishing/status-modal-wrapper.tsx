"use client";

import { useState } from "react";
import useStore from "@/data/store";
import { useChangeDetection } from "@/hooks/use-change-detection";
import { useStatusModal } from "@/hooks/use-status-modal";
import { useToast } from "../ui/use-toast";
import { StatusModal } from "./status-modal";

/**
 * Wrapper component that connects StatusModal to the useStatusModal store
 * and handles API calls for status transitions.
 *
 * This component is rendered by ModalProvider.
 */
export function StatusModalWrapper() {
	const { assuranceCase, setAssuranceCase } = useStore();
	const statusModal = useStatusModal();
	const { toast } = useToast();
	const [loading, setLoading] = useState(false);

	// Use change detection when the modal is open and status is PUBLISHED
	const { hasChanges, refresh: refreshChanges } = useChangeDetection({
		caseId: statusModal.caseId,
		enabled: statusModal.isOpen && statusModal.status === "PUBLISHED",
	});

	const handleStatusTransition = async (
		targetStatus: "DRAFT" | "READY_TO_PUBLISH" | "PUBLISHED",
		description?: string
	) => {
		if (!statusModal.caseId) {
			return;
		}

		setLoading(true);

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
					title: "Returned to draft",
					description: "Your case is now a private draft",
				},
				READY_TO_PUBLISH: {
					title: "Marked as ready",
					description: "Your case can now be linked to case studies",
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
		} catch {
			toast({
				variant: "destructive",
				title: "Error",
				description: "Something went wrong",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleMarkAsReady = async () => {
		await handleStatusTransition("READY_TO_PUBLISH");
	};

	const handlePublish = async () => {
		await handleStatusTransition("PUBLISHED");
	};

	const handleReturnToDraft = async () => {
		await handleStatusTransition("DRAFT");
	};

	const handleUnpublish = async () => {
		await handleStatusTransition("DRAFT");
	};

	const handleUpdatePublished = async () => {
		await handleStatusTransition("PUBLISHED");
	};

	return (
		<StatusModal
			hasChanges={hasChanges || statusModal.hasChanges}
			linkedCaseStudyCount={statusModal.linkedCaseStudyCount}
			onMarkAsReady={loading ? undefined : handleMarkAsReady}
			onOpenChange={(open) => {
				if (!open) {
					statusModal.onClose();
				}
			}}
			onPublish={loading ? undefined : handlePublish}
			onReturnToDraft={loading ? undefined : handleReturnToDraft}
			onUnpublish={loading ? undefined : handleUnpublish}
			onUpdatePublished={loading ? undefined : handleUpdatePublished}
			open={statusModal.isOpen}
			publishedAt={statusModal.publishedAt}
			status={statusModal.status}
		/>
	);
}
