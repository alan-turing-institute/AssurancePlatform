"use client";

import { HelpCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import type { ReactFlowNode } from "@/lib/case";
import {
	caseItemDescription,
	deleteAssuranceCaseNode,
	detachCaseElement,
	extractGoalsClaimsStrategies,
	findParentNode,
	removeAssuranceCaseNode,
} from "@/lib/case";
import { createSnapshot } from "@/lib/services/history-service";
import useHistoryStore from "@/store/history-store";
import useStore from "@/store/store";
import type { AssuranceCase, Goal, PropertyClaim, Strategy } from "@/types";
import type { HistoryCommand } from "@/types/history";
import { AlertModal } from "../modals/alert-modal";
import { DeleteElementModal } from "../modals/delete-element-modal";
import EditSheet from "../ui/edit-sheet";
import { Separator } from "../ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "../ui/tooltip";
import EditForm from "./edit-form";
import { ActionButtons, DeleteButtons } from "./node-edit-actions";
import { ActionContent, ParentDescription } from "./node-edit-content";
import {
	handleEvidenceMove,
	handleGoalMove,
	handlePropertyClaimMove,
	handleStrategyMove,
} from "./node-edit-moves";
import type { AssuranceCaseNode, MoveElement } from "./node-edit-types";
import {
	collectElementsForHistory,
	collectOrphanElements,
	countDescendants,
	getValidMoveTargets,
	NODE_TYPE_MAP,
} from "./node-edit-utils";

export type { AssuranceCaseNode } from "./node-edit-types";

type NodeEditProps = {
	node: AssuranceCaseNode;
	isOpen: boolean;
	setEditOpen: Dispatch<SetStateAction<boolean>>;
};

const NodeEdit = ({ node, isOpen, setEditOpen }: NodeEditProps) => {
	const [isMounted, setIsMounted] = useState(false);
	const {
		assuranceCase,
		setAssuranceCase,
		nodes,
		orphanedElements,
		setOrphanedElements,
	} = useStore();
	const { recordOperation, isApplying: isUndoRedoApplying } = useHistoryStore();
	const [selectedLink, setSelectedLink] = useState(false);
	const [linkToCreate, setLinkToCreate] = useState("");
	const [unresolvedChanges, setUnresolvedChanges] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [alertOpen, setAlertOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [toggleParentDescription, setToggleParentDescription] = useState(true);
	const [action, setAction] = useState<string | null>(null);

	const [selectedClaimMove, setSelectedClaimMove] =
		useState<MoveElement | null>(null);
	const [selectedEvidenceMove, setSelectedEvidenceMove] =
		useState<MoveElement | null>(null);
	const [_moveElementType, _setMoveElementType] = useState<string | null>(null);
	const [skipDeleteConfirmation, setSkipDeleteConfirmation] = useState(false);

	const { data: _session } = useSession();

	let goal: Goal | undefined;
	let strategies: Strategy[] = [];
	let claims: PropertyClaim[] = [];

	const readOnly = !!(
		assuranceCase?.permissions === "view" ||
		assuranceCase?.permissions === "comment"
	);

	if (assuranceCase?.goals && assuranceCase.goals.length > 0) {
		goal = assuranceCase.goals[0];
		strategies = assuranceCase.goals[0].strategies;
		const lookups = extractGoalsClaimsStrategies(assuranceCase.goals);
		claims = lookups.claims;
	}

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) {
		return null;
	}

	if (!node) {
		return null;
	}

	const selectLink = (type: string) => {
		setSelectedLink(true);
		setLinkToCreate(type);
	};

	const childCount = countDescendants(node, assuranceCase);

	/** Function used to handle deletion of the current selected item */
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Pre-existing function with necessary branching logic
	const handleDelete = async () => {
		setLoading(true);

		const elementsToDelete = collectElementsForHistory(node, assuranceCase);

		const deleted = await deleteAssuranceCaseNode(node.type, node.data.id, "");

		if (deleted && assuranceCase) {
			if (!isUndoRedoApplying) {
				const commands: HistoryCommand[] = elementsToDelete.map((el) => ({
					type: "delete" as const,
					elementId: String(el.id),
					elementType: el.type,
					before: createSnapshot({
						...el.data,
						id: el.id,
						type: el.type,
					}),
					after: null,
				}));

				const elementName = node.data.name as string;
				const deleteChildCount = elementsToDelete.length - 1;
				const description =
					deleteChildCount > 0
						? `Deleted ${node.type} "${elementName}" and ${deleteChildCount} child element${deleteChildCount !== 1 ? "s" : ""}`
						: `Deleted ${node.type} "${elementName}"`;

				recordOperation({
					id: crypto.randomUUID(),
					timestamp: Date.now(),
					description,
					commands,
				});
			}

			const updatedAssuranceCase = await removeAssuranceCaseNode(
				assuranceCase,
				node.data.id,
				node.data.type
			);
			if (updatedAssuranceCase) {
				setAssuranceCase(updatedAssuranceCase);
				setLoading(false);
				setDeleteOpen(false);
				handleClose();
				return;
			}
		}
	};

	const handleClose = () => {
		setAction(null);
		setEditOpen(false);
		setAlertOpen(false);
		setSelectedLink(false);
		setToggleParentDescription(true);
		setUnresolvedChanges(false);
	};

	const onChange = (_open: boolean) => {
		if (unresolvedChanges) {
			setAlertOpen(true);
		} else {
			handleClose();
		}
	};

	const processMoveByType = async (
		type: string,
		sessionKey: string
	): Promise<void> => {
		if (!(assuranceCase && selectedClaimMove)) {
			return;
		}

		const baseArgs = {
			node,
			assuranceCase,
			setAssuranceCase,
			setLoading,
			handleClose,
			sessionKey,
		};

		switch (type) {
			case "G":
				await handleGoalMove({
					...baseArgs,
					goal,
					selectedClaimMove,
				});
				break;
			case "P":
				await handlePropertyClaimMove({
					...baseArgs,
					claims,
					selectedClaimMove,
				});
				break;
			case "S":
				await handleStrategyMove({
					...baseArgs,
					strategies,
					selectedClaimMove,
				});
				break;
			default:
				break;
		}
	};

	const handleMove = async (): Promise<void> => {
		setLoading(true);
		const sessionKey = "";

		if (selectedClaimMove) {
			const type = selectedClaimMove.name.substring(0, 1);
			await processMoveByType(type, sessionKey);
		}

		if (selectedEvidenceMove && assuranceCase) {
			await handleEvidenceMove({
				node,
				assuranceCase,
				setAssuranceCase,
				setLoading,
				handleClose,
				selectedEvidenceMove,
				sessionKey,
			});
		}
	};

	const parentNode = findParentNode(
		nodes as ReactFlowNode[],
		node as ReactFlowNode
	);

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Pre-existing function with necessary branching logic
	const handleDetach = async (): Promise<void> => {
		const result = await detachCaseElement(
			node as ReactFlowNode,
			node.type,
			node.data.id,
			""
		);

		if ("error" in result) {
			return;
		}

		if (result.detached && assuranceCase) {
			let newOrphanElements: Array<{
				id: number;
				type: string;
				name: string;
				short_description: string;
				long_description: string;
				property_claim_id?: number | null;
			}> = [];

			if (node.type === "property" && node.data) {
				const claimData = node.data as unknown as PropertyClaim;
				newOrphanElements = collectOrphanElements(claimData, NODE_TYPE_MAP);
			} else {
				newOrphanElements = [
					{
						id: node.data.id as number,
						type: (NODE_TYPE_MAP[node.type] ?? node.data.type) as string,
						name: node.data.name as string,
						short_description: (node.data.short_description ?? "") as string,
						long_description: (node.data.long_description ?? "") as string,
					},
				];
			}

			const updatedAssuranceCase = removeAssuranceCaseNode(
				assuranceCase,
				node.data.id,
				node.data.type
			);
			if (updatedAssuranceCase) {
				setAssuranceCase(updatedAssuranceCase);
				const existingIds = new Set(orphanedElements.map((el) => el.id));
				const uniqueNewOrphans = newOrphanElements.filter(
					(el) => !existingIds.has(el.id)
				);
				if (uniqueNewOrphans.length > 0) {
					setOrphanedElements([...orphanedElements, ...uniqueNewOrphans]);
				}
				setLoading(false);
				setDeleteOpen(false);
				handleClose();
			}
		}
	};

	return (
		<EditSheet
			description={
				<div className="flex items-center gap-2">
					<span>
						{readOnly
							? `You are viewing a ${node.type}.`
							: `Use this form to update your ${node.type}.`}
					</span>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<HelpCircle className="h-4 w-4 cursor-help text-muted-foreground" />
							</TooltipTrigger>
							<TooltipContent className="max-w-xs">
								<span>{caseItemDescription(node.type)}</span>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			}
			isOpen={isOpen}
			nodeId={node.id}
			onChange={onChange}
			onClose={handleClose}
			title={`${readOnly ? "Viewing" : "Editing"} ${node.data.name}`}
		>
			{!action && (
				<div>
					{node.type !== "goal" && parentNode && (
						<ParentDescription
							parentNode={parentNode}
							setToggleParentDescription={setToggleParentDescription}
							toggleParentDescription={toggleParentDescription}
						/>
					)}
					<EditForm
						node={node}
						onClose={handleClose}
						setUnresolvedChanges={setUnresolvedChanges}
					/>
					<Separator className="my-6" />
					<ActionButtons
						node={node}
						readOnly={readOnly}
						setAction={setAction}
					/>
					<Separator className="my-6" />

					<DeleteButtons
						handleDetach={handleDetach}
						node={node}
						onDeleteClick={() => {
							if (skipDeleteConfirmation) {
								handleDelete();
							} else {
								setDeleteOpen(true);
							}
						}}
						readOnly={readOnly}
					/>
				</div>
			)}
			<ActionContent
				action={action}
				assuranceCase={assuranceCase || ({} as AssuranceCase)}
				claims={
					node.type === "property"
						? getValidMoveTargets(claims, node.data.id as number)
						: claims
				}
				goal={goal}
				handleClose={handleClose}
				handleMove={handleMove}
				linkToCreate={linkToCreate}
				loading={loading}
				node={node}
				readOnly={readOnly}
				selectedLink={selectedLink}
				selectLink={selectLink}
				setAction={setAction}
				setLinkToCreate={setLinkToCreate}
				setLoading={setLoading}
				setSelectedClaimMove={setSelectedClaimMove}
				setSelectedEvidenceMove={setSelectedEvidenceMove}
				setSelectedLink={setSelectedLink}
				setUnresolvedChanges={setUnresolvedChanges}
				strategies={strategies}
			/>
			<DeleteElementModal
				childCount={childCount}
				hasChildren={childCount > 0}
				isOpen={deleteOpen}
				loading={loading}
				onClose={() => setDeleteOpen(false)}
				onDelete={handleDelete}
				onSkipPreferenceChange={(skip) => setSkipDeleteConfirmation(skip)}
			/>
			<AlertModal
				cancelButtonText={"No, keep editing"}
				confirmButtonText={"Yes, discard changes!"}
				isOpen={alertOpen}
				loading={loading}
				message={
					"You have changes that have not been updated. Would you like to discard these changes?"
				}
				onClose={() => setAlertOpen(false)}
				onConfirm={handleClose}
			/>
		</EditSheet>
	);
};

export default NodeEdit;
