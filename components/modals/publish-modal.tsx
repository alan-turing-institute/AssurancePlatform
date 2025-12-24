"use client";

import { AlertTriangle, Check, Globe, GlobeLock, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import useStore from "@/data/store";
import { usePublishModal } from "@/hooks/use-publish-modal";
import { useToast } from "@/lib/toast";

/**
 * Shows a toast notification based on the unpublish result.
 */
function showUnpublishToast(
	toast: ReturnType<typeof useToast>["toast"],
	response: Response,
	result: { error?: string },
	linkedCaseStudyCount: number
): boolean {
	if (!response.ok) {
		if (
			response.status === 409 &&
			result.error === "Cannot unpublish: linked to case studies"
		) {
			toast({
				variant: "destructive",
				title: "Cannot unpublish",
				description: `This case is linked to ${linkedCaseStudyCount} case ${linkedCaseStudyCount === 1 ? "study" : "studies"}. Use the force option to unpublish anyway.`,
			});
			return false;
		}

		toast({
			variant: "destructive",
			title: "Unable to unpublish case",
			description: result.error || "An error occurred while unpublishing",
		});
		return false;
	}

	return true;
}

/**
 * Modal for publishing or unpublishing an assurance case.
 *
 * Three states:
 * 1. Publish - Description textarea + confirm button
 * 2. Unpublish (no linked case studies) - Simple confirmation
 * 3. Unpublish (with linked case studies) - Warning + force option
 */
export const PublishModal = () => {
	const { assuranceCase, setAssuranceCase } = useStore();
	const publishModal = usePublishModal();
	const { toast } = useToast();

	const [publishDescription, setPublishDescription] = useState("");
	const [loading, setLoading] = useState(false);

	const handlePublish = async () => {
		if (!publishModal.caseId) {
			return;
		}

		setLoading(true);

		try {
			const response = await fetch(
				`/api/cases/${publishModal.caseId}/publish`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						description: publishDescription.trim() || undefined,
					}),
				}
			);

			const result = await response.json();

			if (!response.ok) {
				toast({
					variant: "destructive",
					title: "Unable to publish case",
					description: result.error || "An error occurred while publishing",
				});
				return;
			}

			// Update the store with new published status
			if (assuranceCase) {
				setAssuranceCase({
					...assuranceCase,
					published: true,
					publishedAt: result.published_at,
				});
			}

			toast({
				variant: "success",
				title: "Case published",
				description: "Your assurance case is now publicly available",
			});

			publishModal.onClose();
			setPublishDescription("");
		} catch {
			toast({
				variant: "destructive",
				title: "Error",
				description: "Something went wrong while publishing",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleUnpublish = async (force = false) => {
		if (!publishModal.caseId) {
			return;
		}

		setLoading(true);

		try {
			const url = force
				? `/api/cases/${publishModal.caseId}/publish?force=true`
				: `/api/cases/${publishModal.caseId}/publish`;

			const response = await fetch(url, { method: "DELETE" });
			const result = await response.json();

			const success = showUnpublishToast(
				toast,
				response,
				result,
				publishModal.linkedCaseStudyCount
			);

			if (!success) {
				return;
			}

			// Update the store
			if (assuranceCase) {
				setAssuranceCase({
					...assuranceCase,
					published: false,
					publishedAt: null,
				});
			}

			toast({
				variant: "success",
				title: "Case unpublished",
				description: "Your assurance case is no longer publicly available",
			});

			publishModal.onClose();
		} catch {
			toast({
				variant: "destructive",
				title: "Error",
				description: "Something went wrong while unpublishing",
			});
		} finally {
			setLoading(false);
		}
	};

	const renderPublishContent = () => (
		<div className="space-y-4">
			<div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
				<Globe className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
				<div className="text-sm">
					<p className="font-medium text-blue-800 dark:text-blue-200">
						Make this case publicly available
					</p>
					<p className="text-blue-600 dark:text-blue-400">
						A snapshot of your assurance case will be created and visible on the
						Discover page.
					</p>
				</div>
			</div>

			<div className="space-y-2">
				<label className="font-medium text-sm" htmlFor="publish-description">
					Description (optional)
				</label>
				<Textarea
					id="publish-description"
					onChange={(e) => setPublishDescription(e.target.value)}
					placeholder="Add a brief description of this published version..."
					rows={3}
					value={publishDescription}
				/>
			</div>

			<div className="flex justify-end gap-2">
				<Button
					disabled={loading}
					onClick={() => publishModal.onClose()}
					variant="outline"
				>
					Cancel
				</Button>
				<Button disabled={loading} onClick={handlePublish}>
					{loading ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<Check className="mr-2 h-4 w-4" />
					)}
					Publish
				</Button>
			</div>
		</div>
	);

	const renderUnpublishContent = () => {
		const hasLinkedCaseStudies = publishModal.linkedCaseStudyCount > 0;

		return (
			<div className="space-y-4">
				{hasLinkedCaseStudies ? (
					<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
						<AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
						<div className="text-sm">
							<p className="font-medium text-amber-800 dark:text-amber-200">
								Warning: Linked to case studies
							</p>
							<p className="text-amber-600 dark:text-amber-400">
								This case is linked to {publishModal.linkedCaseStudyCount} case{" "}
								{publishModal.linkedCaseStudyCount === 1 ? "study" : "studies"}.
								Unpublishing will break those links.
							</p>
						</div>
					</div>
				) : (
					<div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
						<GlobeLock className="mt-0.5 h-5 w-5 text-gray-600 dark:text-gray-400" />
						<div className="text-sm">
							<p className="font-medium text-gray-800 dark:text-gray-200">
								Remove public access
							</p>
							<p className="text-gray-600 dark:text-gray-400">
								Your assurance case will no longer be visible on the Discover
								page.
							</p>
						</div>
					</div>
				)}

				<div className="flex justify-end gap-2">
					<Button
						disabled={loading}
						onClick={() => publishModal.onClose()}
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						disabled={loading}
						onClick={() => handleUnpublish(hasLinkedCaseStudies)}
						variant={hasLinkedCaseStudies ? "destructive" : "default"}
					>
						{loading ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<GlobeLock className="mr-2 h-4 w-4" />
						)}
						{hasLinkedCaseStudies ? "Force Unpublish" : "Unpublish"}
					</Button>
				</div>
			</div>
		);
	};

	const modalTitle = publishModal.isPublished
		? "Unpublish Case"
		: "Publish Case";
	const modalDescription = publishModal.isPublished
		? "Remove public access to this assurance case"
		: "Make this assurance case publicly available";

	return (
		<Modal
			description={modalDescription}
			isOpen={publishModal.isOpen}
			onClose={publishModal.onClose}
			title={modalTitle}
		>
			{publishModal.isPublished
				? renderUnpublishContent()
				: renderPublishContent()}
		</Modal>
	);
};
