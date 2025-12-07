"use client";

import { ExternalLink, Info, Loader2 } from "lucide-react";
import Link from "next/link";
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
import type { PublishStatusType } from "./status-badge";

type StatusModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	status: PublishStatusType;
	hasChanges?: boolean;
	publishedAt?: Date | string | null;
	linkedCaseStudyCount?: number;
	onMarkAsReady?: () => Promise<void>;
	onUpdatePublished?: () => Promise<void>;
};

/**
 * Modal for managing publish status transitions.
 *
 * Shows different content based on current status:
 * - Draft: Option to mark as ready
 * - Ready to Publish: Link to create case study
 * - Published: Info about linked case studies and option to update (if hasChanges)
 */
export function StatusModal({
	open,
	onOpenChange,
	status,
	hasChanges = false,
	publishedAt,
	linkedCaseStudyCount = 0,
	onMarkAsReady,
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
							<span className="ml-2 font-normal text-amber-500 text-sm">
								(Changes pending)
							</span>
						)}
					</DialogTitle>
					<DialogDescription>{getStatusDescription(status)}</DialogDescription>
				</DialogHeader>

				<Separator />

				{status === "DRAFT" && (
					<DraftContent
						handleAction={handleAction}
						loading={loading}
						onMarkAsReady={onMarkAsReady}
					/>
				)}

				{status === "READY_TO_PUBLISH" && (
					<ReadyContent onOpenChange={onOpenChange} />
				)}

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
		case "READY_TO_PUBLISH":
			return "Ready to Publish";
		case "PUBLISHED":
			return "Published";
		default:
			return status satisfies never;
	}
}

function getStatusDescription(status: PublishStatusType): string {
	switch (status) {
		case "DRAFT":
			return "This case is private and not available for case study linking.";
		case "READY_TO_PUBLISH":
			return "This case is linked to a case study. It will show as 'Published' once the case study is made public.";
		case "PUBLISHED":
			return "This case is published and visible in case studies.";
		default:
			return status satisfies never;
	}
}

type DraftContentProps = {
	loading: boolean;
	onMarkAsReady?: () => Promise<void>;
	handleAction: (action: (() => Promise<void>) | undefined) => void;
};

function DraftContent({
	loading,
	onMarkAsReady,
	handleAction,
}: DraftContentProps) {
	return (
		<div className="space-y-4">
			<Alert>
				<AlertDescription>
					Draft cases are only visible to you and collaborators with edit
					permissions. Mark as &quot;Ready to Publish&quot; when you want to
					link this case to a case study.
				</AlertDescription>
			</Alert>

			{onMarkAsReady && (
				<Button
					className="w-full bg-amber-500 text-white hover:bg-amber-600"
					disabled={loading}
					onClick={() => handleAction(onMarkAsReady)}
				>
					{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					Mark as Ready to Publish
				</Button>
			)}
		</div>
	);
}

type ReadyContentProps = {
	onOpenChange: (open: boolean) => void;
};

function ReadyContent({ onOpenChange }: ReadyContentProps) {
	return (
		<Button asChild className="w-full" onClick={() => onOpenChange(false)}>
			<Link href="/dashboard/case-studies/create">
				<ExternalLink className="mr-2 h-4 w-4" />
				Create a Case Study
			</Link>
		</Button>
	);
}

type PublishedContentProps = {
	hasChanges: boolean;
	formattedDate: string | null;
	linkedCaseStudyCount: number;
	loading: boolean;
	onUpdatePublished?: () => Promise<void>;
	handleAction: (action: (() => Promise<void>) | undefined) => void;
};

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
					className="w-full bg-green-500 text-white hover:bg-green-600"
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
