"use client";

import { AlertTriangle, Globe, GlobeLock, Info, Loader2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useCaseInformation } from "@/hooks/use-case-information";
import {
	CASE_INFORMATION_FIELD_LABELS,
	getMissingCaseInformationFields,
	type RequiredCaseInformationField,
} from "@/lib/schemas/case-information";
import type { PublishStatusType } from "@/lib/services/case-response-types";

interface StatusModalProps {
	caseId?: string | null;
	hasChanges?: boolean;
	linkedCaseStudyCount?: number;
	onOpenChange: (open: boolean) => void;
	onPublish?: () => Promise<void>;
	onRequestCaseInformation?: (field: RequiredCaseInformationField) => void;
	onUnpublish?: () => Promise<void>;
	onUpdatePublished?: () => Promise<void>;
	open: boolean;
	publishedAt?: Date | string | null;
	publishLoading?: boolean;
	status: PublishStatusType;
	unpublishLoading?: boolean;
}

/**
 * Modal for managing publish status transitions (ADR 0003 §2 — the single
 * guided Publish flow lives here, in the case editor).
 *
 * Shows different content based on current status:
 * - Draft: the Publish flow — validates case information completeness and
 *   either surfaces exactly what's missing (opening the case-information
 *   pane focused on it) or offers a single-confirm Publish.
 * - Published: divergence indicator + "Update published version" (if
 *   changed), and Unpublish with a plain-consequences confirm.
 */
export function StatusModal({
	open,
	onOpenChange,
	caseId,
	status,
	hasChanges = false,
	publishedAt,
	linkedCaseStudyCount = 0,
	onUpdatePublished,
	onPublish,
	onUnpublish,
	onRequestCaseInformation,
	publishLoading = false,
	unpublishLoading = false,
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

				{status === "DRAFT" && caseId && (
					<PublishContent
						caseId={caseId}
						loading={publishLoading}
						onPublish={onPublish}
						onRequestCaseInformation={onRequestCaseInformation}
					/>
				)}

				{status === "PUBLISHED" && (
					<PublishedContent
						caseId={caseId}
						formattedDate={formattedDate}
						handleAction={handleAction}
						hasChanges={hasChanges}
						linkedCaseStudyCount={linkedCaseStudyCount}
						loading={loading}
						onRequestCaseInformation={onRequestCaseInformation}
						onUnpublish={onUnpublish}
						onUpdatePublished={onUpdatePublished}
						unpublishLoading={unpublishLoading}
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
			return "This case is private. Publish it to make it available on Discover.";
		case "PUBLISHED":
			return "This case is published and visible in case studies.";
		default:
			return status satisfies never;
	}
}

// ============================================
// Shared — missing case-information fields gate
// ============================================

interface MissingFieldsGateProps {
	missingFields: RequiredCaseInformationField[];
	onRequestCaseInformation?: (field: RequiredCaseInformationField) => void;
	testId: string;
	trailingCopy: string;
}

/**
 * "Add the missing fields, then complete case information" — shown in place
 * of the Publish action (Draft) or the Update Published action (Published)
 * when the case-information completeness gate (ADR 0003 §4) isn't met.
 * Shared because both flows surface exactly the same missing-fields message
 * and "Complete case information" action, differing only in the testid and
 * the trailing sentence naming which action is blocked.
 */
function MissingFieldsGate({
	missingFields,
	onRequestCaseInformation,
	testId,
	trailingCopy,
}: MissingFieldsGateProps) {
	return (
		<div className="space-y-4" data-testid={testId}>
			<Alert>
				<Info className="h-4 w-4" />
				<AlertDescription>
					Add{" "}
					{missingFields
						.map((field) => CASE_INFORMATION_FIELD_LABELS[field])
						.join(", ")}{" "}
					to the case information {trailingCopy}
				</AlertDescription>
			</Alert>
			<Button
				onClick={() =>
					onRequestCaseInformation?.(
						missingFields[0] as RequiredCaseInformationField
					)
				}
			>
				Complete case information
			</Button>
		</div>
	);
}

// ============================================
// Draft — the Publish flow (ADR 0003 §2)
// ============================================

interface PublishContentProps {
	caseId: string;
	loading: boolean;
	onPublish?: () => Promise<void>;
	onRequestCaseInformation?: (field: RequiredCaseInformationField) => void;
}

/**
 * The single guided Publish action. Loads case information (a lightweight
 * fetch — never the full export/change-detection path) independently of the
 * modal's open state, so the dialog itself never gates on it — it renders
 * immediately with a skeleton while this resolves.
 */
function PublishContent({
	caseId,
	loading,
	onPublish,
	onRequestCaseInformation,
}: PublishContentProps) {
	const { information, loading: infoLoading } = useCaseInformation(caseId);

	if (infoLoading) {
		return (
			<div className="space-y-3" data-testid="publish-content-loading">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3" />
				<Skeleton className="h-9 w-32" />
			</div>
		);
	}

	const missingFields = getMissingCaseInformationFields(information);

	if (missingFields.length > 0) {
		return (
			<MissingFieldsGate
				missingFields={missingFields}
				onRequestCaseInformation={onRequestCaseInformation}
				testId="publish-content-incomplete"
				trailingCopy="before publishing."
			/>
		);
	}

	return (
		<div className="space-y-4" data-testid="publish-content-ready">
			<Alert>
				<Globe className="h-4 w-4" />
				<AlertDescription>
					Case information is complete. Publishing creates a snapshot of this
					case and makes it visible on the Discover page.
				</AlertDescription>
			</Alert>
			<Button disabled={loading} onClick={onPublish}>
				{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
				Publish
			</Button>
		</div>
	);
}

// ============================================
// Published — divergence + unpublish
// ============================================

interface PublishedContentProps {
	caseId?: string | null;
	formattedDate: string | null;
	handleAction: (action: (() => Promise<void>) | undefined) => void;
	hasChanges: boolean;
	linkedCaseStudyCount: number;
	loading: boolean;
	onRequestCaseInformation?: (field: RequiredCaseInformationField) => void;
	onUnpublish?: () => Promise<void>;
	onUpdatePublished?: () => Promise<void>;
	unpublishLoading: boolean;
}

/**
 * Republish ("Update Published") re-runs the same case-information
 * completeness gate first publish does (ADR 0003 §4 — lead adjudication,
 * 2026-08-11): a previously-complete published record could otherwise
 * regress via an edit that clears a required field, then a republish. Shown
 * in place of the Update Published button, mirroring the Draft flow's
 * missing-fields gate (`PublishContent` above) rather than letting the
 * request round-trip to a raw 400.
 */
function PublishedContent({
	caseId,
	hasChanges,
	formattedDate,
	linkedCaseStudyCount,
	loading,
	onUpdatePublished,
	onUnpublish,
	onRequestCaseInformation,
	unpublishLoading,
	handleAction,
}: PublishedContentProps) {
	const [confirmingUnpublish, setConfirmingUnpublish] = useState(false);
	const canUnpublish = linkedCaseStudyCount === 0;
	const { information } = useCaseInformation(caseId ?? undefined);
	const missingFields = getMissingCaseInformationFields(information);
	const republishBlocked = hasChanges && missingFields.length > 0;

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

			{hasChanges && !republishBlocked && (
				<Alert>
					<AlertDescription>
						Changes have been made since this case was last published. Update
						the published version to reflect the latest changes.
					</AlertDescription>
				</Alert>
			)}

			{republishBlocked && (
				<MissingFieldsGate
					missingFields={missingFields}
					onRequestCaseInformation={onRequestCaseInformation}
					testId="republish-content-incomplete"
					trailingCopy="before updating the published version."
				/>
			)}

			{hasChanges && !republishBlocked && onUpdatePublished && (
				<Button
					className="w-full bg-success text-success-foreground hover:bg-success/90"
					disabled={loading}
					onClick={() => handleAction(onUpdatePublished)}
				>
					{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					Update Published
				</Button>
			)}

			{canUnpublish && onUnpublish && (
				<>
					<Separator />
					{confirmingUnpublish ? (
						<div className="space-y-3" data-testid="unpublish-confirm">
							<Alert variant="destructive">
								<AlertTriangle className="h-4 w-4" />
								<AlertDescription>
									Unpublishing removes the public record. Anyone with the
									Discover link will no longer be able to view it. This case
									stays intact as a private draft.
								</AlertDescription>
							</Alert>
							<div className="flex justify-end gap-2">
								<Button
									disabled={unpublishLoading}
									onClick={() => setConfirmingUnpublish(false)}
									variant="outline"
								>
									Cancel
								</Button>
								<Button
									disabled={unpublishLoading}
									onClick={() => onUnpublish()}
									variant="destructive"
								>
									{unpublishLoading && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									<GlobeLock className="mr-2 h-4 w-4" />
									Yes, unpublish
								</Button>
							</div>
						</div>
					) : (
						<Button
							onClick={() => setConfirmingUnpublish(true)}
							variant="outline"
						>
							<GlobeLock className="mr-2 h-4 w-4" />
							Unpublish
						</Button>
					)}
				</>
			)}
		</div>
	);
}
