"use client";

import {
	BookOpenText,
	Eye,
	EyeOff,
	HelpCircle,
	LibraryIcon,
	MessageCirclePlus,
	Move,
	Plus,
	PlusCircle,
	Trash2,
	Unplug,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import type { Node } from "reactflow";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import useStore from "@/data/store";
import type { ReactFlowNode } from "@/lib/case-helper";
import {
	caseItemDescription,
	deleteAssuranceCaseNode,
	detachCaseElement,
	extractGoalsClaimsStrategies,
	findParentNode,
	findSiblingHiddenState,
	removeAssuranceCaseNode,
	updateAssuranceCase,
	updateAssuranceCaseNode,
} from "@/lib/case-helper";
import type { AssuranceCase, Goal, PropertyClaim, Strategy } from "@/types";
import NodeAttributes from "../cases/node-attributes";
import NodeComment from "../cases/node-comments";
import NodeContext from "../cases/node-context";
import OrphanElements from "../cases/orphan-elements";
import { AlertModal } from "../modals/alert-modal";
import EditSheet from "../ui/edit-sheet";
import { Separator } from "../ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "../ui/tooltip";
import EditForm from "./edit-form";
// import { useLoginToken } from ".*/use-auth";
import NewLinkForm from "./new-link-form";

type NodeData = {
	id: number;
	name: string;
	type: string;
	goal_id?: number | null;
	strategy_id?: number | null;
	property_claim_id?: number | number[] | null;
	short_description?: string;
	[key: string]: unknown;
};

export interface AssuranceCaseNode extends Node {
	data: NodeData;
	type: string;
}

type MoveElement = {
	id: number;
	name: string;
};

type UpdateItem = {
	goal_id?: number | null;
	strategy_id?: number | null;
	property_claim_id?: number | number[] | null;
	hidden?: boolean;
};

type NodeEditProps = {
	node: AssuranceCaseNode;
	isOpen: boolean;
	setEditOpen: Dispatch<SetStateAction<boolean>>;
};

// Helper function to handle goal move
// biome-ignore lint/nursery/useMaxParams: Pre-existing helper function, refactoring deferred
const handleGoalMove = async (
	node: AssuranceCaseNode,
	goal: Goal | undefined,
	assuranceCase: AssuranceCase,
	setAssuranceCase: (ac: AssuranceCase) => void,
	setLoading: (loading: boolean) => void,
	handleClose: () => void,
	selectedClaimMove: MoveElement,
	sessionKey: string
): Promise<void> => {
	const updateItem: UpdateItem = {
		goal_id: goal ? goal.id : null,
		strategy_id: null,
		property_claim_id: null,
		hidden: false,
	};

	const updated = await updateAssuranceCaseNode(
		"property",
		node.data.id,
		sessionKey,
		updateItem
	);

	if (updated) {
		updateItem.hidden = findSiblingHiddenState(
			assuranceCase,
			selectedClaimMove.id
		);
		const updatedAssuranceCase = await updateAssuranceCase(
			"property",
			assuranceCase,
			updateItem,
			node.data.id,
			node as ReactFlowNode,
			true
		);
		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase);
			setLoading(false);
			handleClose();
		}
	}
};

// Helper function to handle property claim move
// biome-ignore lint/nursery/useMaxParams: Pre-existing helper function, refactoring deferred
const handlePropertyClaimMove = async (
	node: AssuranceCaseNode,
	claims: PropertyClaim[],
	assuranceCase: AssuranceCase,
	setAssuranceCase: (ac: AssuranceCase) => void,
	setLoading: (loading: boolean) => void,
	handleClose: () => void,
	selectedClaimMove: MoveElement,
	sessionKey: string
): Promise<void> => {
	const elementId = claims?.find(
		(claim) => claim.id === selectedClaimMove.id
	)?.id;

	const updateItem: UpdateItem = {
		goal_id: null,
		strategy_id: null,
		property_claim_id: elementId,
		hidden: false,
	};

	const updated = await updateAssuranceCaseNode(
		"property",
		node.data.id,
		sessionKey,
		updateItem
	);

	if (updated) {
		updateItem.hidden = findSiblingHiddenState(
			assuranceCase,
			selectedClaimMove.id
		);
		const updatedAssuranceCase = await updateAssuranceCase(
			"property",
			assuranceCase,
			updateItem,
			node.data.id,
			node as ReactFlowNode,
			true
		);
		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase);
			setLoading(false);
			handleClose();
		}
	}
};

// Helper function to handle strategy move
// biome-ignore lint/nursery/useMaxParams: Pre-existing helper function, refactoring deferred
const handleStrategyMove = async (
	node: AssuranceCaseNode,
	strategies: Strategy[],
	assuranceCase: AssuranceCase,
	setAssuranceCase: (ac: AssuranceCase) => void,
	setLoading: (loading: boolean) => void,
	handleClose: () => void,
	selectedClaimMove: MoveElement,
	sessionKey: string
): Promise<void> => {
	const elementId = strategies?.find(
		(strategy) => strategy.id === selectedClaimMove.id
	)?.id;

	const updateItem: UpdateItem = {
		goal_id: null,
		strategy_id: elementId,
		property_claim_id: null,
		hidden: false,
	};

	const updated = await updateAssuranceCaseNode(
		"property",
		node.data.id,
		sessionKey,
		updateItem
	);

	if (updated) {
		updateItem.hidden = findSiblingHiddenState(
			assuranceCase,
			selectedClaimMove.id
		);
		const updatedAssuranceCase = await updateAssuranceCase(
			"property",
			assuranceCase,
			updateItem,
			node.data.id,
			node as ReactFlowNode,
			true
		);
		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase);
			setLoading(false);
			handleClose();
		}
	}
};

// Helper function to handle evidence move
// biome-ignore lint/nursery/useMaxParams: Pre-existing helper function, refactoring deferred
const handleEvidenceMove = async (
	node: AssuranceCaseNode,
	assuranceCase: AssuranceCase,
	setAssuranceCase: (ac: AssuranceCase) => void,
	setLoading: (loading: boolean) => void,
	handleClose: () => void,
	selectedEvidenceMove: MoveElement,
	sessionKey: string
): Promise<void> => {
	const updateItem: UpdateItem = {
		property_claim_id: [selectedEvidenceMove.id],
		hidden: false,
	};

	const updated = await updateAssuranceCaseNode(
		"evidence",
		node.data.id,
		sessionKey,
		updateItem
	);

	if (updated) {
		updateItem.hidden = findSiblingHiddenState(
			assuranceCase,
			selectedEvidenceMove.id
		);
		const updatedAssuranceCase = await updateAssuranceCase(
			"evidence",
			assuranceCase,
			updateItem,
			node.data.id,
			node as ReactFlowNode,
			true
		);
		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase);
			setLoading(false);
			handleClose();
		}
	}
};

// Helper component for action buttons
const ActionButtons = ({
	node,
	readOnly,
	setAction,
}: {
	node: AssuranceCaseNode;
	readOnly: boolean;
	setAction: (action: string) => void;
}) => (
	<div className="">
		<h3 className="mb-2 font-semibold text-lg">Actions</h3>
		<div className="flex flex-col items-center justify-around gap-2">
			{node.type === "goal" && !readOnly && (
				<Button
					className="w-full"
					onClick={() => setAction("context")}
					variant={"outline"}
				>
					<BookOpenText className="mr-2 h-4 w-4" />
					Manage Context
				</Button>
			)}
			{node.type !== "evidence" && !readOnly && (
				<Button
					className="w-full"
					onClick={() => setAction("attributes")}
					variant={"outline"}
				>
					<LibraryIcon className="mr-2 h-4 w-4" />
					Manage Attributes
				</Button>
			)}
			{node.type !== "context" && node.type !== "evidence" && !readOnly && (
				<Button
					className="w-full"
					onClick={() => setAction("new")}
					variant={"outline"}
				>
					<PlusCircle className="mr-2 h-4 w-4" />
					Add New Element
				</Button>
			)}
			{node.type !== "context" && node.type !== "evidence" && !readOnly && (
				<Button
					className="w-full"
					onClick={() => setAction("existing")}
					variant={"outline"}
				>
					<Unplug className="mr-2 h-4 w-4" />
					Reattach Element(s)
				</Button>
			)}
			{node.type !== "context" &&
				node.type !== "goal" &&
				node.type !== "strategy" &&
				!readOnly && (
					<Button
						className="w-full"
						onClick={() => setAction("move")}
						variant={"outline"}
					>
						<Move className="mr-2 h-4 w-4" />
						Move Item
					</Button>
				)}
			<Button
				className="w-full"
				onClick={() => setAction("comment")}
				variant={"outline"}
			>
				<MessageCirclePlus className="mr-2 h-4 w-4" />
				Comments
			</Button>
		</div>
	</div>
);

// Helper component for parent description section
const ParentDescription = ({
	parentNode,
	toggleParentDescription,
	setToggleParentDescription,
}: {
	parentNode: ReactFlowNode;
	toggleParentDescription: boolean;
	setToggleParentDescription: (toggle: boolean) => void;
}) => (
	<div className="mt-6 flex flex-col text-sm">
		<div className="mb-2 flex items-center justify-start gap-2">
			<p>Parent Description</p>
			{toggleParentDescription ? (
				<Eye
					className="h-4 w-4"
					onClick={() => setToggleParentDescription(!toggleParentDescription)}
				/>
			) : (
				<EyeOff
					className="h-4 w-4"
					onClick={() => setToggleParentDescription(!toggleParentDescription)}
				/>
			)}
		</div>
		{toggleParentDescription && (
			<>
				<span className="mb-2 font-medium text-muted-foreground text-xs uppercase group-hover:text-white">
					Identifier: {parentNode.data.name}
				</span>
				<p className="text-muted-foreground">
					{parentNode.data.short_description as string}
				</p>
			</>
		)}
	</div>
);

// Helper component for new element selection
const NewElementSection = ({
	node,
	selectLink,
	setAction,
}: {
	node: AssuranceCaseNode;
	selectLink: (type: string) => void;
	setAction: Dispatch<SetStateAction<string | null>>;
}) => (
	<div className="mt-8 flex flex-col items-start justify-start">
		<h3 className="mb-2 font-semibold text-lg">Add New</h3>
		<div className="flex w-full flex-col items-center justify-start gap-4">
			{node.type === "goal" && (
				<>
					<Button
						className="w-full"
						onClick={() => selectLink("strategy")}
						variant="outline"
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Strategy
					</Button>
					<Button
						className="w-full"
						onClick={() => selectLink("claim")}
						variant="outline"
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Property Claim
					</Button>
				</>
			)}
			{node.type === "strategy" && (
				<Button
					className="w-full"
					onClick={() => selectLink("claim")}
					variant="outline"
				>
					<Plus className="mr-2 h-4 w-4" />
					Add Property Claim
				</Button>
			)}
			{node.type === "property" && (
				<>
					<Button
						className="w-full"
						onClick={() => selectLink("claim")}
						variant="outline"
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Property Claim
					</Button>
					<Button
						className="w-full"
						onClick={() => selectLink("evidence")}
						variant="outline"
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Evidence
					</Button>
				</>
			)}
		</div>
		<Button
			className="my-6"
			onClick={() => setAction(null)}
			variant={"outline"}
		>
			Cancel
		</Button>
	</div>
);

// Helper component for move section
const MoveSection = ({
	node,
	goal,
	strategies,
	claims,
	setSelectedClaimMove,
	setSelectedEvidenceMove,
	handleMove,
	setAction,
}: {
	node: AssuranceCaseNode;
	goal: Goal | undefined;
	strategies: Strategy[];
	claims: PropertyClaim[];
	setSelectedClaimMove: (element: MoveElement | null) => void;
	setSelectedEvidenceMove: (element: MoveElement | null) => void;
	handleMove: () => Promise<void>;
	setAction: Dispatch<SetStateAction<string | null>>;
}) => (
	<>
		{node.type === "property" || node.type === "evidence" ? (
			<div className="w-full pt-4">
				<h3 className="mt-6 mb-2 font-semibold text-lg capitalize">
					Move {node.type}
				</h3>
				<div className="items-left flex flex-col justify-start gap-2">
					{node.type === "property" && (
						<Select
							onValueChange={(value) => {
								const parsedValue = JSON.parse(value);
								setSelectedClaimMove(parsedValue);
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select an option" />
							</SelectTrigger>
							<SelectContent>
								{goal && (
									<SelectItem
										key={crypto.randomUUID()}
										value={JSON.stringify({ id: goal.id, name: goal.name })}
									>
										<div className="flex flex-col items-start justify-start gap-1">
											<div className="flex items-center">
												<span className="font-medium">{goal.name}</span>
												<svg
													aria-hidden="true"
													className="mx-2 inline h-0.5 w-0.5 fill-current"
													viewBox="0 0 2 2"
												>
													<circle cx={1} cy={1} r={1} />
												</svg>
												<span className="max-w-[200px] truncate">
													{goal.short_description}
												</span>
											</div>
										</div>
									</SelectItem>
								)}
								{strategies?.map((strategy) => (
									<SelectItem
										key={crypto.randomUUID()}
										value={JSON.stringify({
											id: strategy.id,
											name: strategy.name,
										})}
									>
										<div className="flex items-start justify-start gap-1">
											<div className="flex items-center">
												<span className="font-medium">{strategy.name}</span>
												<svg
													aria-hidden="true"
													className="mx-2 inline h-0.5 w-0.5 fill-current"
													viewBox="0 0 2 2"
												>
													<circle cx={1} cy={1} r={1} />
												</svg>
												<span className="max-w-[200px] truncate">
													{strategy.short_description}
												</span>
											</div>
										</div>
									</SelectItem>
								))}
								{claims?.map((claim) => (
									<SelectItem
										key={crypto.randomUUID()}
										value={JSON.stringify({ id: claim.id, name: claim.name })}
									>
										<div className="flex flex-col items-start justify-start gap-1">
											<div className="flex items-center">
												<span className="font-medium">{claim.name}</span>
												<svg
													aria-hidden="true"
													className="mx-2 inline h-0.5 w-0.5 fill-current"
													viewBox="0 0 2 2"
												>
													<circle cx={1} cy={1} r={1} />
												</svg>
												<span className="max-w-[200px] truncate">
													{claim.short_description}
												</span>
											</div>
										</div>
									</SelectItem>
								))}
								{strategies?.length === 0 && (
									<SelectItem disabled={true} value="{strategy.id}">
										No strategies found.
									</SelectItem>
								)}
							</SelectContent>
						</Select>
					)}
					{node.type === "evidence" && (
						<Select
							onValueChange={(value) => {
								const parsedValue = JSON.parse(value);
								setSelectedEvidenceMove(parsedValue);
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select an option" />
							</SelectTrigger>
							<SelectContent>
								{claims?.map((claim) => (
									<SelectItem
										key={crypto.randomUUID()}
										value={JSON.stringify({ id: claim.id, name: claim.name })}
									>
										<div className="flex flex-col items-start justify-start gap-1">
											<div className="flex items-center">
												<span className="font-medium">{claim.name}</span>
												<svg
													aria-hidden="true"
													className="mx-2 inline h-0.5 w-0.5 fill-current"
													viewBox="0 0 2 2"
												>
													<circle cx={1} cy={1} r={1} />
												</svg>
												<span className="max-w-[200px] truncate">
													{claim.short_description}
												</span>
											</div>
										</div>
									</SelectItem>
								))}
								{claims && claims.length === 0 && (
									<SelectItem disabled={true} value="{strategy.id}">
										No property claims found.
									</SelectItem>
								)}
							</SelectContent>
						</Select>
					)}
				</div>
			</div>
		) : null}
		<div className="flex items-center justify-start gap-2">
			<Button
				className="bg-indigo-500 hover:bg-indigo-600 dark:text-white"
				onClick={handleMove}
			>
				Move
			</Button>
			<Button
				className="my-6"
				onClick={() => setAction(null)}
				variant={"outline"}
			>
				Cancel
			</Button>
		</div>
	</>
);

// Helper component for delete buttons
const DeleteButtons = ({
	node,
	readOnly,
	handleDetach,
	setDeleteOpen,
}: {
	node: AssuranceCaseNode;
	readOnly: boolean;
	handleDetach: () => Promise<void>;
	setDeleteOpen: (open: boolean) => void;
}) => (
	<>
		{!readOnly && (
			<div className="mt-12 flex items-center justify-start gap-4">
				{node.type !== "goal" && (
					<Button
						className="my-8 w-full"
						onClick={handleDetach}
						variant={"outline"}
					>
						<Unplug className="mr-2 h-4 w-4" />
						Detach
					</Button>
				)}
				<Button
					className="flex w-full items-center justify-center"
					onClick={() => setDeleteOpen(true)}
					variant={"destructive"}
				>
					<Trash2 className="mr-2" />
					Delete&nbsp;
					<span className="capitalize">{node.type}</span>
				</Button>
			</div>
		)}
	</>
);

// Helper component for action content
const ActionContent = ({
	action,
	node,
	readOnly,
	selectedLink,
	linkToCreate,
	setLinkToCreate,
	setSelectedLink,
	handleClose,
	setUnresolvedChanges,
	selectLink,
	setAction,
	goal,
	strategies,
	claims,
	setSelectedClaimMove,
	setSelectedEvidenceMove,
	handleMove,
	loading,
	setLoading,
	assuranceCase,
}: {
	action: string | null;
	node: AssuranceCaseNode;
	readOnly: boolean;
	selectedLink: boolean;
	linkToCreate: string;
	setLinkToCreate: Dispatch<SetStateAction<string>>;
	setSelectedLink: Dispatch<SetStateAction<boolean>>;
	handleClose: () => void;
	setUnresolvedChanges: Dispatch<SetStateAction<boolean>>;
	selectLink: (type: string) => void;
	setAction: Dispatch<SetStateAction<string | null>>;
	goal: Goal | undefined;
	strategies: Strategy[];
	claims: PropertyClaim[];
	setSelectedClaimMove: (element: MoveElement | null) => void;
	setSelectedEvidenceMove: (element: MoveElement | null) => void;
	handleMove: () => Promise<void>;
	loading: boolean;
	setLoading: Dispatch<SetStateAction<boolean>>;
	assuranceCase: AssuranceCase;
}) => (
	<>
		{action === "new" &&
			!readOnly &&
			(selectedLink ? (
				<NewLinkForm
					actions={{ setLinkToCreate, setSelectedLink, handleClose }}
					linkType={linkToCreate}
					node={node}
					setUnresolvedChanges={setUnresolvedChanges}
				/>
			) : (
				node.type !== "context" &&
				node.type !== "evidence" && (
					<NewElementSection
						node={node}
						selectLink={selectLink}
						setAction={setAction}
					/>
				)
			))}
		{action === "existing" &&
			!readOnly &&
			node.type !== "evidence" &&
			node.type !== "context" && (
				<OrphanElements
					handleClose={handleClose}
					loadingState={{ loading, setLoading }}
					node={node}
					setAction={setAction}
				/>
			)}
		{action === "move" && !readOnly && (
			<MoveSection
				claims={claims}
				goal={goal}
				handleMove={handleMove}
				node={node}
				setAction={setAction}
				setSelectedClaimMove={setSelectedClaimMove}
				setSelectedEvidenceMove={setSelectedEvidenceMove}
				strategies={strategies}
			/>
		)}
		{action === "comment" && (
			<NodeComment
				handleClose={handleClose}
				loadingState={{ loading, setLoading }}
				node={node}
				readOnly={assuranceCase?.permissions === "view"}
				setAction={setAction}
			/>
		)}
		{action === "context" && (
			<NodeContext
				actions={{ setSelectedLink, handleClose, setAction }}
				node={node}
				setUnresolvedChanges={setUnresolvedChanges}
			/>
		)}
		{action === "attributes" && (
			<NodeAttributes
				actions={{ setSelectedLink, setAction }}
				node={node}
				onClose={handleClose}
				setUnresolvedChanges={setUnresolvedChanges}
			/>
		)}
	</>
);

const NodeEdit = ({ node, isOpen, setEditOpen }: NodeEditProps) => {
	const [isMounted, setIsMounted] = useState(false);
	const {
		assuranceCase,
		setAssuranceCase,
		nodes,
		orphanedElements,
		setOrphanedElements,
	} = useStore();
	const [selectedLink, setSelectedLink] = useState(false);
	const [linkToCreate, setLinkToCreate] = useState("");
	const [unresolvedChanges, setUnresolvedChanges] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [alertOpen, setAlertOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [toggleParentDescription, setToggleParentDescription] = useState(true);
	const [action, setAction] = useState<string | null>(null);
	// const [parentNode, setParentNode] = useState(nodes.filter(n => n.data.id === node.data.goal_id)[0])

	const [selectedClaimMove, setSelectedClaimMove] =
		useState<MoveElement | null>(null);
	const [selectedEvidenceMove, setSelectedEvidenceMove] =
		useState<MoveElement | null>(null);
	const [_moveElementType, _setMoveElementType] = useState<string | null>(null);

	// const [token] = useLoginToken();
	const { data: session } = useSession();

	let goal: Goal | undefined;
	let strategies: Strategy[] = [];
	let claims: PropertyClaim[] = [];

	const readOnly = !!(
		assuranceCase?.permissions === "view" ||
		assuranceCase?.permissions === "review"
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

	/** Function used to handle deletion of the current selected item */
	const handleDelete = async () => {
		setLoading(true);
		const deleted = await deleteAssuranceCaseNode(
			node.type,
			node.data.id,
			session?.key ?? ""
		);

		if (deleted && assuranceCase) {
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

		switch (type) {
			case "G":
				await handleGoalMove(
					node,
					goal,
					assuranceCase,
					setAssuranceCase,
					setLoading,
					handleClose,
					selectedClaimMove,
					sessionKey
				);
				break;
			case "P":
				await handlePropertyClaimMove(
					node,
					claims,
					assuranceCase,
					setAssuranceCase,
					setLoading,
					handleClose,
					selectedClaimMove,
					sessionKey
				);
				break;
			case "S":
				await handleStrategyMove(
					node,
					strategies,
					assuranceCase,
					setAssuranceCase,
					setLoading,
					handleClose,
					selectedClaimMove,
					sessionKey
				);
				break;
			default:
				// No action needed for other types
				break;
		}
	};

	const handleMove = async (): Promise<void> => {
		setLoading(true);
		const sessionKey = session?.key ?? "";

		if (selectedClaimMove) {
			const type = selectedClaimMove.name.substring(0, 1);
			await processMoveByType(type, sessionKey);
		}

		if (selectedEvidenceMove && assuranceCase) {
			await handleEvidenceMove(
				node,
				assuranceCase,
				setAssuranceCase,
				setLoading,
				handleClose,
				selectedEvidenceMove,
				sessionKey
			);
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
			session?.key ?? ""
		);

		if ("error" in result) {
			// TODO: Handle error properly
			return;
		}

		if (result.detached && assuranceCase) {
			// Map React Flow node type to orphan element type
			const typeMap: Record<string, string> = {
				property: "PropertyClaim",
				strategy: "Strategy",
				evidence: "Evidence",
				context: "Context",
				goal: "Goal",
			};
			// Create orphan element from node data to add to orphanedElements
			const orphanElement = {
				id: node.data.id,
				type: typeMap[node.type] ?? node.data.type,
				name: node.data.name,
				short_description: node.data.short_description ?? "",
				long_description: node.data.long_description ?? "",
			};

			const updatedAssuranceCase = removeAssuranceCaseNode(
				assuranceCase,
				node.data.id,
				node.data.type
			);
			if (updatedAssuranceCase) {
				setAssuranceCase(updatedAssuranceCase);
				// Add detached element to orphanedElements so it appears immediately
				// Check for duplicates to avoid React key warnings
				if (!orphanedElements.some((el) => el.id === orphanElement.id)) {
					setOrphanedElements([...orphanedElements, orphanElement]);
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
						readOnly={readOnly}
						setDeleteOpen={setDeleteOpen}
					/>
				</div>
			)}
			<ActionContent
				action={action}
				assuranceCase={assuranceCase || ({} as AssuranceCase)}
				claims={claims}
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
			<AlertModal
				cancelButtonText={"No, keep the element"}
				confirmButtonText={"Yes, delete this element!"}
				isOpen={deleteOpen}
				loading={loading}
				message={
					"Deleting this element will also remove all of the connected child elements. Please detach any child elements that you wish to keep before deleting, as the current action cannot be undone."
				}
				onClose={() => setDeleteOpen(false)}
				onConfirm={handleDelete}
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
