"use client";

import {
	Code2,
	Download,
	Group,
	Info,
	Loader2,
	Notebook,
	Plus,
	RotateCw,
	Share2,
	Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import NodeCreate from "@/components/cases/node-create";
import { Button } from "@/components/ui/button";
import { useExportModal, useResourcesModal } from "@/hooks/modal-hooks";
import { useCaseSharingModal } from "@/hooks/use-case-sharing-modal";
import useStore from "@/store/store";
import { AlertModal } from "../modals/alert-modal";
import ActionTooltip from "../ui/action-tooltip";
import { ErrorBoundary } from "../ui/error-boundary";
import CaseNotes from "./case-notes";
import { CaseSettingsPopover } from "./case-settings-popover";
import { HistoryControls } from "./history-controls";
import JsonViewPanel from "./json-view-panel";

type ActionButtonProps = {
	showCreateGoal: boolean;
	actions: {
		onLayout: (direction: "LR" | "TB" | "RL" | "BT") => Promise<void>;
	};
	notifyError: (message: string) => void;
};

const ActionButtons = ({
	showCreateGoal,
	actions,
	notifyError,
}: ActionButtonProps) => {
	const [open, setOpen] = useState(false);
	const [alertOpen, setAlertOpen] = useState(false);
	const [notesOpen, setNotesOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [jsonViewOpen, setJsonViewOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [isLayouting, setIsLayouting] = useState(false);

	const { assuranceCase, layoutDirection } = useStore();
	const router = useRouter();

	const { onLayout } = actions;

	const handleFocus = async () => {
		setIsLayouting(true);
		await onLayout(layoutDirection);
		setIsLayouting(false);
	};

	const caseSharingModal = useCaseSharingModal();
	const exportModal = useExportModal();
	const resourcesModal = useResourcesModal();

	const onDelete = async () => {
		if (!assuranceCase) {
			return;
		}

		try {
			setLoading(true);
			const response = await fetch(`/api/cases/${assuranceCase.id}`, {
				method: "DELETE",
			});

			if (response.ok) {
				router.push("/dashboard");
			} else {
				const data = await response.json();
				notifyError(data.error || "Failed to delete case");
			}
		} catch (_error: unknown) {
			notifyError("Failed to delete case");
		} finally {
			setLoading(false);
			setDeleteOpen(false);
		}
	};

	const handleNameReset = async () => {
		if (!assuranceCase) {
			return;
		}

		try {
			setLoading(true);
			const response = await fetch(
				`/api/cases/${assuranceCase.id}/update-ids`,
				{ method: "POST" }
			);
			if (response.ok) {
				router.refresh();
			} else {
				notifyError("Failed to reset identifiers");
			}
		} catch (_error) {
			notifyError("Failed to reset identifiers");
		} finally {
			setLoading(false);
			setAlertOpen(false);
		}
	};

	return (
		<div className="-translate-x-1/2 fixed bottom-4 left-1/2 z-40 flex transform items-center justify-center">
			<div
				className="m-auto flex items-center justify-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary-foreground shadow-lg"
				data-show-create-goal={showCreateGoal}
				data-testid="action-buttons"
				data-tour="toolbar"
			>
				<div className="flex items-center justify-center gap-2 border-r-2 border-r-primary/20 pr-2">
					{showCreateGoal &&
						assuranceCase &&
						assuranceCase.permissions !== "view" &&
						assuranceCase.permissions !== "review" && (
							<ActionTooltip label="New Goal">
								<Button
									className="rounded-full p-3"
									onClick={() => setOpen(true)}
									size="icon"
									type="button"
								>
									<Plus className="h-5 w-5" />
									<span className="sr-only">Add Goal</span>
								</Button>
							</ActionTooltip>
						)}
					{assuranceCase &&
						assuranceCase.permissions !== "view" &&
						assuranceCase.permissions !== "review" && <HistoryControls />}
					<ActionTooltip label="Focus">
						<Button
							className="rounded-full p-3 disabled:opacity-50"
							data-tour="toolbar-focus"
							disabled={isLayouting}
							id="FocusBtn"
							onClick={handleFocus}
							size="icon"
							type="button"
						>
							{isLayouting ? (
								<Loader2 className="h-5 w-5 animate-spin" />
							) : (
								<Group className="h-5 w-5" />
							)}
							<span className="sr-only">Focus</span>
						</Button>
					</ActionTooltip>
					{assuranceCase &&
						assuranceCase.permissions !== "view" &&
						assuranceCase.permissions !== "review" && (
							<ActionTooltip label="Reset Identifiers">
								<Button
									className="rounded-full p-3"
									onClick={() => setAlertOpen(true)}
									size="icon"
									type="button"
								>
									<RotateCw className="h-5 w-5" />
									<span className="sr-only">Reset Identifiers</span>
								</Button>
							</ActionTooltip>
						)}
					<ActionTooltip label="Resources">
						<Button
							className="rounded-full p-3"
							data-tour="toolbar-resources"
							onClick={() => resourcesModal.onOpen()}
							size="icon"
							type="button"
						>
							<Info className="h-5 w-5" />
							<span className="sr-only">Resources</span>
						</Button>
					</ActionTooltip>
				</div>
				<div className="flex items-center justify-center gap-2">
					{assuranceCase && assuranceCase.permissions === "manage" && (
						<ActionTooltip label="Share">
							<Button
								className="rounded-full p-3"
								data-tour="toolbar-share"
								onClick={() =>
									caseSharingModal.onOpen(assuranceCase?.id?.toString() ?? "")
								}
								size="icon"
								type="button"
							>
								<Share2 className="h-5 w-5" />
								<span className="sr-only">Share</span>
							</Button>
						</ActionTooltip>
					)}
					{assuranceCase && assuranceCase.permissions !== "view" && (
						<ActionTooltip label="Export">
							<Button
								className="rounded-full p-3"
								data-tour="toolbar-export"
								onClick={() => exportModal.onOpen()}
								size="icon"
								type="button"
							>
								<Download className="h-5 w-5" />
								<span className="sr-only">Export</span>
							</Button>
						</ActionTooltip>
					)}
					<ActionTooltip label="JSON View">
						<Button
							className="rounded-full p-3"
							data-tour="toolbar-json"
							onClick={() => setJsonViewOpen(true)}
							size="icon"
							type="button"
						>
							<Code2 className="h-5 w-5" />
							<span className="sr-only">JSON View</span>
						</Button>
					</ActionTooltip>
					<ActionTooltip label="Notes">
						<Button
							className="rounded-full p-3"
							data-tour="toolbar-notes"
							onClick={() => setNotesOpen(true)}
							size="icon"
							type="button"
						>
							<Notebook className="h-5 w-5" />
							<span className="sr-only">Notes</span>
						</Button>
					</ActionTooltip>
					<span data-tour="toolbar-settings">
						<CaseSettingsPopover />
					</span>
					{assuranceCase && assuranceCase.permissions === "manage" && (
						<ActionTooltip label="Delete">
							<Button
								className="rounded-full p-3"
								onClick={() => setDeleteOpen(true)}
								size="icon"
								type="button"
								variant="destructive"
							>
								<Trash2 className="h-5 w-5" />
								<span className="sr-only">Delete</span>
							</Button>
						</ActionTooltip>
					)}
				</div>
				<NodeCreate isOpen={open} setOpen={setOpen} />
				<CaseNotes isOpen={notesOpen} onClose={() => setNotesOpen(false)} />
				<ErrorBoundary
					fallback={
						<div className="p-4 text-muted-foreground">
							<p>JSON editor failed. Close and reopen to retry.</p>
						</div>
					}
				>
					<JsonViewPanel
						isOpen={jsonViewOpen}
						onClose={() => setJsonViewOpen(false)}
					/>
				</ErrorBoundary>
				<AlertModal
					confirmButtonText={"Move to Trash"}
					isOpen={deleteOpen}
					loading={loading}
					message="This case will be moved to the trash. You can restore it within 30 days or permanently delete it from the trash."
					onClose={() => setDeleteOpen(false)}
					onConfirm={onDelete}
				/>
				<AlertModal
					cancelButtonText={"No, keep current identifiers"}
					confirmButtonText={"Yes, reset all identifiers"}
					isOpen={alertOpen}
					loading={loading}
					message={
						"Updating the identifiers will systematically reset all of the unique labels that are displayed for each of the elements (e.g. P1, E1), so that they are continuous. This cannot be undone."
					}
					onClose={() => setAlertOpen(false)}
					onConfirm={handleNameReset}
				/>
			</div>
		</div>
	);
};

export default ActionButtons;
