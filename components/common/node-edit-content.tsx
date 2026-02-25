"use client";

import { Eye, EyeOff } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ReactFlowNode } from "@/lib/case";
import type { AssuranceCase, Goal, PropertyClaim, Strategy } from "@/types";
import NodeAttributes from "../cases/node-attributes";
import NodeComment from "../cases/node-comments";
import OrphanElements from "../cases/orphan-elements";
import NewLinkForm from "./new-link-form";
import { NewElementSection } from "./node-edit-actions";
import { MoveSection } from "./node-edit-move-section";
import type { AssuranceCaseNode, MoveElement } from "./node-edit-types";

export type ParentDescriptionProps = {
	parentNode: ReactFlowNode;
	toggleParentDescription: boolean;
	setToggleParentDescription: (toggle: boolean) => void;
};

export const ParentDescription = ({
	parentNode,
	toggleParentDescription,
	setToggleParentDescription,
}: ParentDescriptionProps) => (
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

export type ActionContentProps = {
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
};

export const ActionContent = ({
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
}: ActionContentProps) => (
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
