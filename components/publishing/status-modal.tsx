"use client";

import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
	onPublish?: () => Promise<void>;
	onReturnToDraft?: () => Promise<void>;
	onUnpublish?: () => Promise<void>;
	onUpdatePublished?: () => Promise<void>;
};

/**
 * Modal for managing publish status transitions.
 *
 * Shows different content based on current status:
 * - Draft: Option to mark as ready
 * - Ready to Publish: Link to create case study
 * - Published: Options to unpublish or update (if hasChanges)
 */
export function StatusModal({
	open,
	onOpenChange,
	status,
	hasChanges = false,
	publishedAt,
	linkedCaseStudyCount = 0,
	onMarkAsReady,
	onPublish,
	onReturnToDraft,
	onUnpublish,
	onUpdatePublished,
}: StatusModalProps) {
	const [loading, setLoading] = useState(false);
	const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);

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

	const handleUnpublishClick = () => {
		if (linkedCaseStudyCount > 0) {
			setShowUnpublishConfirm(true);
		} else {
			handleAction(onUnpublish);
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
		<>
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
						<DialogDescription>
							{getStatusDescription(status)}
						</DialogDescription>
					</DialogHeader>

					<Separator />

					{status === "DRAFT" && (
						<DraftContent loading={loading} onMarkAsReady={onMarkAsReady} />
					)}

					{status === "READY_TO_PUBLISH" && (
						<ReadyContent
							handleAction={handleAction}
							loading={loading}
							onOpenChange={onOpenChange}
							onPublish={onPublish}
							onReturnToDraft={onReturnToDraft}
						/>
					)}

					{status === "PUBLISHED" && (
						<PublishedContent
							formattedDate={formattedDate}
							handleAction={handleAction}
							handleUnpublishClick={handleUnpublishClick}
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

			<AlertDialog
				onOpenChange={setShowUnpublishConfirm}
				open={showUnpublishConfirm}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Unpublish Case?</AlertDialogTitle>
						<AlertDialogDescription>
							This case is linked to {linkedCaseStudyCount} case{" "}
							{linkedCaseStudyCount === 1 ? "study" : "studies"}. Unpublishing
							will remove these links.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={loading}
							onClick={() => {
								setShowUnpublishConfirm(false);
								handleAction(onUnpublish);
							}}
						>
							{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Unpublish Anyway
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
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
			return "This case is ready to be published or linked to case studies.";
		case "PUBLISHED":
			return "This case is published and visible in case studies.";
		default:
			return status satisfies never;
	}
}

type DraftContentProps = {
	loading: boolean;
	onMarkAsReady?: () => Promise<void>;
};

function DraftContent({ loading, onMarkAsReady }: DraftContentProps) {
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
					onClick={() => onMarkAsReady()}
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
	onPublish?: () => Promise<void>;
	onReturnToDraft?: () => Promise<void>;
	loading: boolean;
	handleAction: (action: (() => Promise<void>) | undefined) => void;
};

function ReadyContent({
	onOpenChange,
	onPublish,
	onReturnToDraft,
	loading,
	handleAction,
}: ReadyContentProps) {
	return (
		<div className="space-y-4">
			<Alert>
				<AlertDescription>
					Ready cases can be linked to case studies, or you can publish directly
					to make this case publicly available.
				</AlertDescription>
			</Alert>

			<div className="flex gap-2">
				{onReturnToDraft && (
					<Button
						className="flex-1"
						disabled={loading}
						onClick={() => handleAction(onReturnToDraft)}
						variant="outline"
					>
						{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Return to Draft
					</Button>
				)}
				{onPublish && (
					<Button
						className="flex-1 bg-green-500 text-white hover:bg-green-600"
						disabled={loading}
						onClick={() => handleAction(onPublish)}
					>
						{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Publish Now
					</Button>
				)}
			</div>

			<Separator />

			<Button
				asChild
				className="w-full"
				onClick={() => onOpenChange(false)}
				variant="outline"
			>
				<Link href="/dashboard/case-studies/create">
					<ExternalLink className="mr-2 h-4 w-4" />
					Create Case Study Instead
				</Link>
			</Button>
		</div>
	);
}

type PublishedContentProps = {
	hasChanges: boolean;
	formattedDate: string | null;
	linkedCaseStudyCount: number;
	loading: boolean;
	onUpdatePublished?: () => Promise<void>;
	handleUnpublishClick: () => void;
	handleAction: (action: (() => Promise<void>) | undefined) => void;
};

function PublishedContent({
	hasChanges,
	formattedDate,
	linkedCaseStudyCount,
	loading,
	onUpdatePublished,
	handleUnpublishClick,
}: PublishedContentProps) {
	return (
		<div className="space-y-4">
			{formattedDate && (
				<p className="text-muted-foreground text-sm">
					Published on: {formattedDate}
				</p>
			)}

			{linkedCaseStudyCount > 0 && (
				<Alert variant="destructive">
					<AlertTriangle className="h-4 w-4" />
					<AlertDescription>
						This case is linked to {linkedCaseStudyCount} case{" "}
						{linkedCaseStudyCount === 1 ? "study" : "studies"}. Unpublishing
						will remove these links.
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

			<div className="flex gap-2">
				<Button
					className="flex-1"
					disabled={loading}
					onClick={handleUnpublishClick}
					variant="outline"
				>
					Unpublish
				</Button>
				{hasChanges && onUpdatePublished && (
					<Button
						className="flex-1 bg-green-500 text-white hover:bg-green-600"
						disabled={loading}
						onClick={() => onUpdatePublished()}
					>
						{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Update Published
					</Button>
				)}
			</div>
		</div>
	);
}
