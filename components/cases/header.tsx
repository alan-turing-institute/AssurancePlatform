import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useRef, useState } from "react";
import { useReactFlow, useUpdateNodeInternals } from "reactflow";
import SearchNodes from "@/components/cases/search-nodes";
import { useChangeDetection } from "@/hooks/use-change-detection";
import { useStatusModal } from "@/hooks/use-status-modal";
import { type ReactFlowNode, toggleHiddenForParent } from "@/lib/case";
import type { PublishStatusType } from "@/lib/services/case-response-types";
import { toastError } from "@/lib/toast";
import useStore from "@/store/store";
import LogoutButton from "../auth/logout-button";
import { StatusButton } from "../publishing/status-button";
import { Button } from "../ui/button";
import ActiveUsersList from "./active-users-list";

interface HeaderProps {
	setOpen: (open: boolean) => void;
}

const Header = ({ setOpen }: HeaderProps) => {
	const { nodes, assuranceCase, setAssuranceCase } = useStore();
	const router = useRouter();
	const _updateNodeInternals = useUpdateNodeInternals();
	const statusModal = useStatusModal();

	const [editName, setEditName] = useState<boolean>(false);
	const [newCaseName, setNewCaseName] = useState<string>(
		assuranceCase?.name || ""
	);
	const _inputRef = useRef<HTMLInputElement>(null);

	const { setCenter } = useReactFlow();

	// Show "Published" when the case's own publishStatus is PUBLISHED. (The
	// "Ready to Publish" intermediate display was retired alongside the
	// status itself, ADR 0003 §2 — there is no longer a distinct "published
	// but not yet public" state to show.)
	const getDisplayStatus = (): PublishStatusType => {
		if (assuranceCase?.publishStatus === "PUBLISHED") {
			return "PUBLISHED";
		}

		return "DRAFT";
	};

	const currentStatus: PublishStatusType = getDisplayStatus();

	// Use change detection for published cases. `refreshKey: assuranceCase`
	// re-fetches whenever the case content changes (structural edits replace
	// this object; comment mutations live in separate store slices and never
	// touch it) — without it this only fetched once on mount and the canvas
	// badge's amber "changes pending" dot stayed stale until a page reload.
	const { hasChanges } = useChangeDetection({
		caseId: assuranceCase?.id ?? null,
		enabled: currentStatus === "PUBLISHED",
		refreshKey: assuranceCase,
	});

	const _handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setNewCaseName(e.target.value);
	};

	const _handleEditClick = () => {
		setEditName(!editName);
	};

	const _updateAssuranceCaseName = async () => {
		try {
			const newData = {
				name: newCaseName,
			};
			// Use internal API route - auth handled via NextAuth session cookies
			const url = `/api/cases/${assuranceCase?.id}`;
			const requestOptions: RequestInit = {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(newData),
			};

			const response = await fetch(url, requestOptions);
			if (!response.ok) {
				setEditName(false);
				return;
			}
			setEditName(false);
			if (assuranceCase) {
				setAssuranceCase({ ...assuranceCase, name: newCaseName });
			}
		} catch (_error) {
			toastError("Failed to update case name");
			setEditName(false);
		}
	};

	const unhideParents = (nodeId: string) => {
		const currentNode = nodes.find((node) => node.id === nodeId);

		if (currentNode && assuranceCase) {
			const updatedAssuranceCase = toggleHiddenForParent(
				currentNode as ReactFlowNode,
				assuranceCase
			);

			setAssuranceCase(updatedAssuranceCase);
		}
	};

	const focusNode = (value: string) => {
		const foundNode = nodes.find((n) => n.id === value);
		if (!foundNode) {
			return;
		}
		const nodeId = foundNode.id;

		unhideParents(nodeId);

		if (nodeId) {
			const node = nodes.find((n) => n.id === nodeId);

			if (node) {
				const _zoomLevel = 1.5;

				const nodeWidth = node.width || 0;
				const nodeHeight = node.height || 0;

				const centerX = node.position.x + nodeWidth / 2;
				const centerY = node.position.y + nodeHeight / 2;

				setCenter(centerX, centerY);
			}
		}
	};

	const canEditCase =
		assuranceCase?.permissions === "manage" ||
		assuranceCase?.permissions === "edit";

	// Opens the status/publish dialog immediately using state already known
	// (from `assuranceCase` and this header's own `useChangeDetection` call
	// above) rather than gating the open on a fetch. `GET /api/cases/[id]/
	// status` runs a full export + change-detection synchronously when a
	// published snapshot exists (`getFullPublishStatus`), which can take
	// several seconds — awaiting it before opening was the bug this issue's
	// hard requirement fixes. `StatusModalWrapper` loads any state that's
	// still asynchronous (divergence) after the dialog is already visible.
	const handleStatusButtonClick = () => {
		if (!(assuranceCase?.id && canEditCase)) {
			return;
		}

		statusModal.onOpen({
			caseId: assuranceCase.id,
			status: currentStatus,
			hasChanges,
			publishedAt: assuranceCase.publishedAt,
		});
	};

	const publishedAt = assuranceCase?.publishedAt;

	return (
		<div className="fixed top-0 left-0 z-50 w-full border-sidebar-border border-b bg-sidebar text-sidebar-foreground">
			<div className="container flex items-center justify-between py-3">
				<div className="flex items-center justify-start gap-2">
					<Button
						aria-label="Back to dashboard"
						className="hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
						data-tour="case-back"
						onClick={() => router.push("/dashboard")}
						size={"icon"}
						title="Back to dashboard"
						variant={"ghost"}
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<button
						className="border-none bg-transparent p-0 font-semibold text-sidebar-foreground hover:cursor-pointer"
						data-testid="case-title-button"
						data-tour="case-header"
						onClick={() => setOpen(true)}
						type="button"
					>
						{assuranceCase?.name || "Untitled Case"}
					</button>
				</div>

				<div className="flex items-center justify-start gap-2">
					<ActiveUsersList />
					<SearchNodes focusNode={focusNode} nodes={nodes} />
					<LogoutButton />
					<span data-tour="case-status">
						<StatusButton
							disabled={!canEditCase}
							hasChanges={hasChanges}
							onClick={handleStatusButtonClick}
							publishedAt={publishedAt}
							status={currentStatus}
						/>
					</span>
				</div>
			</div>
		</div>
	);
};

export default Header;
