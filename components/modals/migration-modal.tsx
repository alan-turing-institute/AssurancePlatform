"use client";

import {
	AlertTriangleIcon,
	MoveRightIcon,
	PartyPopperIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useMigrationModal } from "@/hooks/use-migration-modal";
import { Button } from "../ui/button";

export const MigrationModal = () => {
	const migrationModal = useMigrationModal();
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleGoToSettings = () => {
		migrationModal.onClose();
		router.push("/dashboard/settings");
	};

	const handleClose = async () => {
		// If user is missing email, just close (will show again next time)
		if (migrationModal.isMissingEmail) {
			migrationModal.onClose();
			return;
		}

		// If user has email, mark as seen in database
		setIsSubmitting(true);
		try {
			const response = await fetch("/api/users/me/migration-notice", {
				method: "POST",
			});

			if (!response.ok) {
				console.error("Failed to mark migration notice as seen");
			}
		} catch (error) {
			console.error("Error marking migration notice as seen:", error);
		} finally {
			setIsSubmitting(false);
			migrationModal.onClose();
		}
	};

	return (
		<Modal
			description="We've made some exciting improvements to the TEA Platform."
			isOpen={migrationModal.isOpen}
			onClose={handleClose}
			title="Welcome to the New TEA Platform"
		>
			<div className="space-y-4">
				{/* What's new section */}
				<div className="rounded-lg border border-success/20 bg-success/10 p-4">
					<div className="flex items-start gap-3">
						<PartyPopperIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" />
						<div>
							<h4 className="font-medium text-success-foreground">
								What's new
							</h4>
							<ul className="mt-2 list-inside list-disc space-y-1 text-sm text-success">
								<li>Improved performance and reliability</li>
								<li>Enhanced collaboration features</li>
								<li>New team management capabilities</li>
								<li>Updated user interface</li>
							</ul>
						</div>
					</div>
				</div>

				{/* Action required section (conditional) */}
				{migrationModal.isMissingEmail && (
					<div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
						<div className="flex items-start gap-3">
							<AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
							<div>
								<h4 className="font-medium text-warning-foreground">
									Action required
								</h4>
								<p className="mt-1 text-sm text-warning-foreground">
									Please add your email address to continue using collaboration
									features. This notice will appear until you update your
									profile.
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Action buttons */}
				<div className="flex items-center justify-start gap-2 pt-2">
					{migrationModal.isMissingEmail && (
						<Button
							className="focus-visible:outline-hidden focus-visible:ring-0 focus-visible:ring-ring focus-visible:ring-offset-0"
							onClick={handleGoToSettings}
						>
							Take me to settings <MoveRightIcon className="ml-2 h-4 w-4" />
						</Button>
					)}
					<Button
						disabled={isSubmitting}
						onClick={handleClose}
						variant={migrationModal.isMissingEmail ? "outline" : "default"}
					>
						{isSubmitting ? "Saving..." : "Got it"}
					</Button>
				</div>
			</div>
		</Modal>
	);
};
