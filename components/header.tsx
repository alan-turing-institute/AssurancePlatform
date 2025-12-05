import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type React from "react";
import { type Dispatch, type SetStateAction, useRef, useState } from "react";
import { useReactFlow, useUpdateNodeInternals } from "reactflow";
import SearchNodes from "@/components/common/search-nodes";
import useStore from "@/data/store";
import { useChangeDetection } from "@/hooks/use-change-detection";
import { useStatusModal } from "@/hooks/use-status-modal";
import { type ReactFlowNode, toggleHiddenForParent } from "@/lib/case";
import LogoutButton from "./auth/logout-button";
import ActiveUsersList from "./cases/active-users-list";
import type { PublishStatusType } from "./publishing/status-badge";
import { StatusButton } from "./publishing/status-button";
import { Button } from "./ui/button";
import { ModeToggle } from "./ui/theme-toggle";

type HeaderProps = {
	setOpen: Dispatch<SetStateAction<boolean>>;
};

const Header = ({ setOpen }: HeaderProps) => {
	const { nodes, assuranceCase, setAssuranceCase } = useStore();
	const router = useRouter();
	const _updateNodeInternals = useUpdateNodeInternals();
	const statusModal = useStatusModal();

	const [editName, setEditName] = useState<boolean>(false);
	const [newCaseName, setNewCaseName] = useState<string>(
		assuranceCase?.name || ""
	);
	const [statusLoading, setStatusLoading] = useState(false);
	const _inputRef = useRef<HTMLInputElement>(null);

	const { setCenter } = useReactFlow();

	const { data: session } = useSession();

	// Get the current publish status
	const currentStatus: PublishStatusType =
		assuranceCase?.publishStatus ??
		(assuranceCase?.published ? "PUBLISHED" : "DRAFT");

	// Use change detection for published cases
	const { hasChanges } = useChangeDetection({
		caseId: assuranceCase?.id ?? null,
		enabled: currentStatus === "PUBLISHED",
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
			const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase?.id}/`;
			const requestOptions: RequestInit = {
				method: "PUT",
				headers: {
					Authorization: `Token ${session?.key}`,
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

	const handleStatusButtonClick = async () => {
		if (!(assuranceCase?.id && canEditCase)) {
			return;
		}

		setStatusLoading(true);

		try {
			// Fetch the full status info from the API
			const response = await fetch(`/api/cases/${assuranceCase.id}/status`);
			const data = await response.json();

			if (response.ok) {
				statusModal.onOpen({
					caseId: assuranceCase.id,
					status: data.publishStatus ?? currentStatus,
					hasChanges: data.hasChanges ?? hasChanges,
					publishedAt: data.publishedAt ?? assuranceCase.publishedAt,
					linkedCaseStudyCount: data.linkedCaseStudyCount ?? 0,
				});
			}
		} catch {
			// Silently fail - user can try clicking again
		} finally {
			setStatusLoading(false);
		}
	};

	const publishedAt =
		assuranceCase?.publishedAt ?? assuranceCase?.published_date;

	return (
		<div className="fixed top-0 left-0 z-50 w-full bg-indigo-600 text-white dark:bg-slate-900">
			<div className="container flex items-center justify-between py-3">
				<div className="flex items-center justify-start gap-2">
					<Button
						aria-label="Back to dashboard"
						className="hover:bg-indigo-900/20 hover:text-white hover:dark:bg-gray-100/10"
						onClick={() => router.push("/dashboard")}
						size={"icon"}
						title="Back to dashboard"
						variant={"ghost"}
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<button
						className="border-none bg-transparent p-0 font-semibold text-white hover:cursor-pointer"
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
					<ModeToggle className="border-none bg-indigo-500 hover:bg-indigo-900/20 hover:text-white dark:bg-slate-900 hover:dark:bg-gray-100/10" />
					<StatusButton
						disabled={!canEditCase}
						hasChanges={hasChanges}
						loading={statusLoading}
						onClick={handleStatusButtonClick}
						publishedAt={publishedAt}
						status={currentStatus}
					/>
				</div>
			</div>
		</div>
	);
};

export default Header;
