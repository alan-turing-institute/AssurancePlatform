import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react";
import type { Node } from "reactflow";
import {
	attachCaseElement,
	deleteAssuranceCaseNode,
	fetchAndRefreshCase,
} from "@/lib/case";
import useStore from "@/store/store";
import type { Evidence, PropertyClaim, Strategy } from "@/types";

export type OrphanElement = Evidence | PropertyClaim | Strategy;

type UseOrphanActionsParams = {
	node: Node;
	handleClose: () => void;
	loadingState: {
		loading: boolean;
		setLoading: Dispatch<SetStateAction<boolean>>;
	};
	setAction: Dispatch<SetStateAction<string | null>>;
};

type UseOrphanActionsResult = {
	filteredOrphanElements: OrphanElement[];
	loading: boolean;
	deleteOpen: boolean;
	setDeleteOpen: Dispatch<SetStateAction<boolean>>;
	setAction: Dispatch<SetStateAction<string | null>>;
	handleOrphanSelection: (orphan: OrphanElement) => Promise<void>;
	handleDelete: () => Promise<void>;
	handleDeleteSingle: (orphan: OrphanElement) => Promise<void>;
};

export function useOrphanActions({
	node,
	handleClose,
	loadingState,
	setAction,
}: UseOrphanActionsParams): UseOrphanActionsResult {
	const { loading, setLoading } = loadingState;
	const {
		orphanedElements,
		setOrphanedElements,
		assuranceCase,
		setAssuranceCase,
	} = useStore();

	const [filteredOrphanElements, setFilteredOrphanElements] = useState<
		OrphanElement[]
	>([]);
	const [deleteOpen, setDeleteOpen] = useState(false);

	// Refetch case and orphaned elements from server to get fresh data with children
	const refetchCaseData = async () => {
		if (!assuranceCase?.id) {
			return;
		}

		try {
			const freshCase = await fetchAndRefreshCase(assuranceCase.id);
			if (freshCase) {
				setAssuranceCase(freshCase);
			}

			const orphanResponse = await fetch(
				`/api/cases/${assuranceCase.id}/sandbox`
			);
			if (orphanResponse.ok) {
				const freshOrphans = await orphanResponse.json();
				setOrphanedElements(freshOrphans || []);
			}
		} catch {
			// Silently fail — SSE will eventually sync the data
		}
	};

	const filterOrphanElements = useCallback(
		(currentNodeType: string): OrphanElement[] => {
			const convertedElements = orphanedElements
				.map((item): OrphanElement | null => {
					switch (item.type?.toLowerCase()) {
						case "context":
							return null;
						case "evidence":
							return item as unknown as Evidence;
						case "propertyclaim":
							return item as unknown as PropertyClaim;
						case "strategy":
							return item as unknown as Strategy;
						default:
							return null;
					}
				})
				.filter((item): item is OrphanElement => item !== null);

			switch (currentNodeType.toLowerCase()) {
				case "goal":
					return convertedElements;
				case "strategy":
					return convertedElements.filter(
						(item) => item.type?.toLowerCase() === "propertyclaim"
					);
				case "property":
					return convertedElements.filter(
						(item) =>
							item.type?.toLowerCase() === "evidence" ||
							item.type?.toLowerCase() === "propertyclaim"
					);
				default:
					return convertedElements;
			}
		},
		[orphanedElements]
	);

	const convertToReactFlowNode = (orphan: OrphanElement) => ({
		id: orphan.id.toString(),
		type: orphan.type || "",
		position: { x: 0, y: 0 },
		data: {
			id: orphan.id,
			name: orphan.name,
			type: orphan.type || "",
			description: "description" in orphan ? orphan.description : "",
			goalId: "goalId" in orphan ? orphan.goalId : null,
			strategyId: "strategyId" in orphan ? orphan.strategyId : null,
			propertyClaimId:
				"propertyClaimId" in orphan ? orphan.propertyClaimId : null,
		},
	});

	const handleOrphanSelection = async (orphan: OrphanElement) => {
		setLoading(true);

		const orphanAsReactFlowNode = convertToReactFlowNode(orphan);

		const result = await attachCaseElement(
			orphanAsReactFlowNode,
			orphan.id,
			"",
			{
				id: node.id,
				type: node.type || "",
				position: { x: 0, y: 0 },
				data: node.data,
			}
		);

		if ("error" in result && result.error) {
			setLoading(false);
			return;
		}

		if ("attached" in result && !result.attached) {
			setLoading(false);
			return;
		}

		await refetchCaseData();
		setLoading(false);
		handleClose();
	};

	const handleDelete = async () => {
		setLoading(true);

		try {
			const deletionPromises = filteredOrphanElements.map(async (orphan) => {
				const deleted = await deleteAssuranceCaseNode(
					orphan.type ?? "",
					orphan.id,
					""
				);
				return { deleted, orphanId: orphan.id };
			});

			const deletedResults = await Promise.all(deletionPromises);

			const deletedIds = deletedResults
				.filter((result) => result.deleted)
				.map((result) => result.orphanId);

			const updatedOrphanedElements = orphanedElements.filter(
				(item) => !deletedIds.includes(item.id)
			);

			setOrphanedElements(updatedOrphanedElements);
			setDeleteOpen(false);
			handleClose();
		} catch {
			// Handle error silently
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteSingle = async (orphan: OrphanElement) => {
		setLoading(true);

		try {
			const deleted = await deleteAssuranceCaseNode(
				orphan.type ?? "",
				orphan.id,
				""
			);

			if (deleted) {
				const updatedOrphanedElements = orphanedElements.filter(
					(item) => item.id !== orphan.id
				);
				setOrphanedElements(updatedOrphanedElements);
				setFilteredOrphanElements((prev) =>
					prev.filter((item) => item.id !== orphan.id)
				);
			}
		} catch {
			// Handle error silently
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const result = filterOrphanElements(node.type || "");
		setFilteredOrphanElements(result);
	}, [node.type, filterOrphanElements]);

	return {
		filteredOrphanElements,
		loading,
		deleteOpen,
		setDeleteOpen,
		setAction,
		handleOrphanSelection,
		handleDelete,
		handleDeleteSingle,
	};
}
