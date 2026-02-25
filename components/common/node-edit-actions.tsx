"use client";

import {
	LibraryIcon,
	MessageCirclePlus,
	Move,
	Plus,
	PlusCircle,
	Trash2,
	Unplug,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import type { AssuranceCaseNode } from "./node-edit-types";

export type ActionButtonsProps = {
	node: AssuranceCaseNode;
	readOnly: boolean;
	setAction: (action: string) => void;
	className?: string;
};

export const ActionButtons = ({
	node,
	readOnly,
	setAction,
}: ActionButtonsProps) => (
	<div className="">
		<h3 className="mb-2 font-semibold text-lg">Actions</h3>
		<div className="flex flex-col items-center justify-around gap-2">
			{node.type !== "evidence" && (
				<Button
					className="w-full"
					onClick={() => setAction("attributes")}
					variant={"outline"}
				>
					<LibraryIcon className="mr-2 h-4 w-4" />
					{readOnly ? "View Attributes" : "Manage Attributes"}
				</Button>
			)}
			{node.type !== "evidence" && !readOnly && (
				<Button
					className="w-full"
					onClick={() => setAction("new")}
					variant={"outline"}
				>
					<PlusCircle className="mr-2 h-4 w-4" />
					Add New Element
				</Button>
			)}
			{node.type !== "evidence" && !readOnly && (
				<Button
					className="w-full"
					onClick={() => setAction("existing")}
					variant={"outline"}
				>
					<Unplug className="mr-2 h-4 w-4" />
					Reattach Element(s)
				</Button>
			)}
			{node.type !== "goal" && node.type !== "strategy" && !readOnly && (
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

export type NewElementSectionProps = {
	node: AssuranceCaseNode;
	selectLink: (type: string) => void;
	setAction: Dispatch<SetStateAction<string | null>>;
	className?: string;
};

export const NewElementSection = ({
	node,
	selectLink,
	setAction,
}: NewElementSectionProps) => (
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

export type DeleteButtonsProps = {
	node: AssuranceCaseNode;
	readOnly: boolean;
	handleDetach: () => Promise<void>;
	onDeleteClick: () => void;
	className?: string;
};

export const DeleteButtons = ({
	node,
	readOnly,
	handleDetach,
	onDeleteClick,
}: DeleteButtonsProps) => (
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
					onClick={onDeleteClick}
					variant={"destructive"}
				>
					<Trash2 className="mr-2" />
					<span>
						Delete <span className="capitalize">{node.type}</span>
					</span>
				</Button>
			</div>
		)}
	</>
);
