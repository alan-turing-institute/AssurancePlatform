"use client";

import { Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { PublishStatusType } from "@/lib/services/case-response-types";

interface StatusModalProps {
	hasChanges?: boolean;
	linkedCaseStudyCount?: number;
	onOpenChange: (open: boolean) => void;
	onUpdatePublished?: () => Promise<void>;
	open: boolean;
	publishedAt?: Date | string | null;
	status: PublishStatusType;
}

/**
 * Modal for managing publish status transitions.
 *
 * Shows different content based on current status:
 * - Draft: informational only (the "Ready to Publish" intermediate step and
 *   its "mark as ready" trigger were retired, ADR 0003 §2/§4 — the guided
 *   single-action Publish flow that replaces it is a later issue in the
 *   chain, not wired here)
 * - Published: Info about linked case studies and option to update (if hasChanges)
 */
export function StatusModal({
	open,
	onOpenChange,
	status,
	hasChanges = false,
	publishedAt,
	linkedCaseStudyCount = 0,
	onUpdatePublished,
}: StatusModalProps) {
	const [loading, setLoading] = useState(false);

	const handleAction = async (action: (() => Promise<void>) | undefined) => {
		if (!action) {
			return;
		}

		setLoading(true);
		try {
			await action();
			onOpenChange(false);
		} finally {
			setLoading(false);
		}
	};

	const formattedDate = publishedAt
		? new Date(publishedAt).toLocaleDateString("en-GB", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			})
		: null;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						Case Status: {getStatusLabel(status)}
						{hasChanges && status === "PUBLISHED" && (
							<span className="ml-2 font-normal text-sm text-warning">
								(Changes pending)
							</span>
						)}
					</DialogTitle>
					<DialogDescription>{getStatusDescription(status)}</DialogDescription>
				</DialogHeader>

				<Separator />

				{status === "DRAFT" && <DraftContent />}

				{status === "PUBLISHED" && (
					<PublishedContent
						formattedDate={formattedDate}
						handleAction={handleAction}
						hasChanges={hasChanges}
						linkedCaseStudyCount={linkedCaseStudyCount}
						loading={loading}
						onUpdatePublished={onUpdatePublished}
					/>
				)}

				<DialogFooter>
					<Button
						disabled={loading}
						onClick={() => onOpenChange(false)}
						variant="outline"
					>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function getStatusLabel(status: PublishStatusType): string {
	switch (status) {
		case "DRAFT":
			return "Draft";
		case "PUBLISHED":
			return "Published";
		default:
			return status satisfies never;
	}
}

function getStatusDescription(status: PublishStatusType): string {
	switch (status) {
		case "DRAFT":
			return "This case is private. Use Publish (in the case editor) to make it available on Discover.";
		case "PUBLISHED":
			return "This case is published and visible in case studies.";
		default:
			return status satisfies never;
	}
}

// A future issue in the ADR 0003 chain wires the guided single-action
// Publish flow (§2: validate case information, confirm, snapshot) onto this
// Draft state — not built here, so this content is informational only.
function DraftContent() {
	return (
		<Alert>
			<AlertDescription>
				Draft cases are only visible to you and collaborators with edit
				permissions.
			</AlertDescription>
		</Alert>
	);
}

interface PublishedContentProps {
	formattedDate: string | null;
	handleAction: (action: (() => Promise<void>) | undefined) => void;
	hasChanges: boolean;
	linkedCaseStudyCount: number;
	loading: boolean;
	onUpdatePublished?: () => Promise<void>;
}

function PublishedContent({
	hasChanges,
	formattedDate,
	linkedCaseStudyCount,
	loading,
	onUpdatePublished,
	handleAction,
}: PublishedContentProps) {
	return (
		<div className="space-y-4">
			{formattedDate && (
				<p className="text-muted-foreground text-sm">
					Published on: {formattedDate}
				</p>
			)}

			{linkedCaseStudyCount > 0 && (
				<Alert>
					<Info className="h-4 w-4" />
					<AlertDescription>
						This case is linked to {linkedCaseStudyCount} case{" "}
						{linkedCaseStudyCount === 1 ? "study" : "studies"}. To unpublish,
						remove this case from the linked case studies first.
					</AlertDescription>
				</Alert>
			)}

			{hasChanges && (
				<Alert>
					<AlertDescription>
						Changes have been made since this case was last published. Update
						the published version to reflect the latest changes.
					</AlertDescription>
				</Alert>
			)}

			{hasChanges && onUpdatePublished && (
				<Button
					className="w-full bg-success text-success-foreground hover:bg-success/90"
					disabled={loading}
					onClick={() => handleAction(onUpdatePublished)}
				>
					{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					Update Published
				</Button>
			)}
		</div>
	);
}
