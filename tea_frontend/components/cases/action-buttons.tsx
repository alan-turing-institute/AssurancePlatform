"use client";

import html2canvas from "html2canvas";
import {
	Camera,
	Download,
	Group,
	Info,
	Notebook,
	Plus,
	RotateCw,
	Share2,
	Trash2,
	Users2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import NodeCreate from "@/components/common/node-create";
import useStore from "@/data/store";
import { AlertModal } from "../modals/alert-modal";
import ActionTooltip from "../ui/action-tooltip";
import CaseNotes from "./case-notes";
import "react-toastify/dist/ReactToastify.css";
import { useSession } from "next-auth/react";
import { useCaseSharingModal } from "@/hooks/use-case-sharing-modal";
import { usePermissionsModal } from "@/hooks/use-permissions-modal";
import { useResourcesModal } from "@/hooks/use-resources-modal";
import { useShareModal } from "@/hooks/use-share-modal";

type ActionButtonProps = {
	showCreateGoal: boolean;
	actions: {
		onLayout: (direction: "LR" | "TB" | "RL" | "BT") => void;
	};
	notify: (message: string) => void;
	notifyError: (message: string) => void;
};

const ActionButtons = ({
	showCreateGoal,
	actions,
	notify,
	notifyError,
}: ActionButtonProps) => {
	const [open, setOpen] = useState(false);
	const [alertOpen, setAlertOpen] = useState(false);
	const [notesOpen, setNotesOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [loading, setLoading] = useState(false);

	const { data: session } = useSession();
	const { assuranceCase } = useStore();
	const router = useRouter();

	const { onLayout } = actions;

	const caseSharingModal = useCaseSharingModal();
	const shareModal = useShareModal();
	const permissionModal = usePermissionsModal();
	const resourcesModal = useResourcesModal();

	const onDelete = async () => {
		if (!assuranceCase) {
			return;
		}

		try {
			setLoading(true);
			const requestOptions: RequestInit = {
				headers: {
					Authorization: `Token ${session?.key}`,
				},
				method: "DELETE",
			};

			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase.id}/`,
				requestOptions
			);
			if (response.ok) {
				router.push("/dashboard");
			}
		} catch (_error: unknown) {
			// Error handling is done through the response status check above
		} finally {
			setLoading(false);
			setDeleteOpen(false);
		}
	};

	const handleCapture = async () => {
		if (!assuranceCase) {
			return;
		}

		const token = session?.key ?? "";
		const screenshotTarget = document.getElementById("ReactFlow");
		if (screenshotTarget) {
			const canvas = await html2canvas(screenshotTarget);

			const base64image = canvas.toDataURL("image/png");

			const myHeaders = new Headers();
			myHeaders.append("Content-Type", "application/json");

			const newImage = JSON.stringify({
				caseId: assuranceCase.id.toString(),
				image: base64image,
				token,
			});

			const requestOptions: RequestInit = {
				method: "POST",
				headers: myHeaders,
				body: newImage,
				redirect: "follow",
			};

			const response = await fetch("/api/screenshot", requestOptions);

			if (!response.ok) {
				notifyError("Failed to save screenshot");
				return;
			}

			const result = await response.json();

			if (result.error) {
				notifyError(result.message || "Failed to save screenshot");
				return;
			}

			notify("Screenshot Saved!");
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
				window.location.reload();
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
				className="m-auto flex w-1/8 items-center justify-center gap-2 rounded-full bg-indigo-100 px-4 py-2 text-white shadow-lg dark:bg-indigo-500/20"
				data-show-create-goal={showCreateGoal}
				data-testid="action-buttons"
			>
				<div className="flex items-center justify-center gap-2 border-r-2 border-r-indigo-200 pr-2 dark:border-r-indigo-800/60">
					{showCreateGoal &&
						assuranceCase &&
						assuranceCase.permissions !== "view" &&
						assuranceCase.permissions !== "review" && (
							<ActionTooltip label="New Goal">
								<button
									className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
									onClick={() => setOpen(true)}
									type="button"
								>
									<Plus className="h-5 w-5" />
									<span className="sr-only">Add Goal</span>
								</button>
							</ActionTooltip>
						)}
					<ActionTooltip label="Focus">
						<button
							className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
							id="FocusBtn"
							onClick={() => onLayout("TB")}
							type="button"
						>
							<Group className="h-5 w-5" />
							<span className="sr-only">Focus</span>
						</button>
					</ActionTooltip>
					{assuranceCase &&
						assuranceCase.permissions !== "view" &&
						assuranceCase.permissions !== "review" && (
							<ActionTooltip label="Reset Identifiers">
								<button
									className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
									onClick={() => setAlertOpen(true)}
									type="button"
								>
									<RotateCw className="h-5 w-5" />
									<span className="sr-only">Reset Identifiers</span>
								</button>
							</ActionTooltip>
						)}
					<ActionTooltip label="Resources">
						<button
							className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
							onClick={() => resourcesModal.onOpen()}
							type="button"
						>
							<Info className="h-5 w-5" />
							<span className="sr-only">Resources</span>
						</button>
					</ActionTooltip>
				</div>
				<div className="flex items-center justify-center gap-2">
					{assuranceCase && assuranceCase.permissions === "manage" && (
						<ActionTooltip label="Share">
							<button
								className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
								onClick={() =>
									caseSharingModal.onOpen(assuranceCase?.id?.toString() ?? "")
								}
								type="button"
							>
								<Share2 className="h-5 w-5" />
								<span className="sr-only">Share</span>
							</button>
						</ActionTooltip>
					)}
					{assuranceCase && assuranceCase.permissions !== "view" && (
						<ActionTooltip label="Export">
							<button
								className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
								onClick={() => shareModal.onOpen()}
								type="button"
							>
								<Download className="h-5 w-5" />
								<span className="sr-only">Export</span>
							</button>
						</ActionTooltip>
					)}
					{assuranceCase && assuranceCase.permissions === "manage" && (
						<ActionTooltip label="Permissions">
							<button
								className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
								onClick={() => permissionModal.onOpen()}
								type="button"
							>
								<Users2 className="h-5 w-5" />
								<span className="sr-only">Permissions</span>
							</button>
						</ActionTooltip>
					)}
					<ActionTooltip label="Notes">
						<button
							className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
							onClick={() => setNotesOpen(true)}
							type="button"
						>
							<Notebook className="h-5 w-5" />
							<span className="sr-only">Notes</span>
						</button>
					</ActionTooltip>
					{assuranceCase &&
						(assuranceCase.permissions === "manage" ||
							assuranceCase.permissions === "editor") && (
							<ActionTooltip label="Capture">
								<button
									className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
									onClick={handleCapture}
									type="button"
								>
									<Camera className="h-5 w-5" />
									<span className="sr-only">Capture</span>
								</button>
							</ActionTooltip>
						)}
					{assuranceCase && assuranceCase.permissions === "manage" && (
						<ActionTooltip label="Delete">
							<button
								className="h-50 w-50 rounded-full bg-rose-500 p-3 transition-all hover:bg-rose-600"
								onClick={() => setDeleteOpen(true)}
								type="button"
							>
								<Trash2 className="h-5 w-5" />
								<span className="sr-only">Delete</span>
							</button>
						</ActionTooltip>
					)}
				</div>
				<NodeCreate isOpen={open} setOpen={setOpen} />
				<CaseNotes isOpen={notesOpen} onClose={() => setNotesOpen(false)} />
				<AlertModal
					confirmButtonText={"Delete"}
					isOpen={deleteOpen}
					loading={loading}
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
