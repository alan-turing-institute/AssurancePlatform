"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import type React from "react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useForm } from "react-hook-form";
import type { Node } from "reactflow";
import { Form } from "@/components/ui/form";
import {
	type ReactFlowNode,
	updateAssuranceCase,
	updateAssuranceCaseNode,
} from "@/lib/case";
import {
	type ElementAttributesFormInput,
	elementAttributesFormSchema,
} from "@/lib/schemas/element";
import { recordUpdate } from "@/lib/services/history-service";
import useStore from "@/store/store";
import { Button } from "../ui/button";
import AddAttributeButtons from "./add-attribute-buttons";
import AttributeTextField from "./attribute-text-field";
import ContextEditor from "./context-editor";

type NodeWithData = Node & {
	data: {
		id: number;
		assumption?: string;
		justification?: string;
		context?: string[];
	};
};

interface NodeActions {
	setAction: (value: string) => void;
	setSelectedLink: (value: boolean) => void;
}

interface NodeAttributesProps {
	actions: NodeActions;
	node: NodeWithData;
	onClose: () => void;
	setUnresolvedChanges: Dispatch<SetStateAction<boolean>>;
}

// Helper to check if element type supports context
const supportsContext = (type: string | undefined): boolean =>
	["goal", "strategy", "property"].includes(type || "");

// Helper to check if element type supports justification
const supportsJustification = (type: string | undefined): boolean =>
	["goal", "strategy", "property"].includes(type || "");

const NodeAttributes: React.FC<NodeAttributesProps> = ({
	node,
	actions,
	onClose,
	setUnresolvedChanges: _setUnresolvedChanges,
}) => {
	const { assuranceCase, setAssuranceCase } = useStore();
	const { data: session } = useSession();
	const [loading, setLoading] = useState<boolean>(false);
	const [newAssumption, setNewAssumption] = useState<boolean>(false);
	const [newJustification, setNewJustification] = useState<boolean>(false);

	const { setSelectedLink, setAction } = actions;

	const form = useForm<ElementAttributesFormInput>({
		resolver: zodResolver(elementAttributesFormSchema),
		defaultValues: {
			assumption: node.data?.assumption || "",
			justification: node.data?.justification || "",
			context: node.data?.context || [],
		},
	});

	const handleCancel = () => {
		form.reset();
		setSelectedLink(false);
		setAction("");
	};

	async function onSubmit(values: ElementAttributesFormInput) {
		// Check user.id for JWT-only mode compatibility (key may not exist in JWT-only mode)
		if (!(assuranceCase && session?.user?.id && node.type)) {
			return;
		}

		// Capture before state for history
		const beforeData = { ...node.data } as Record<string, unknown>;

		setLoading(true);
		const updateItem = {
			assumption: values.assumption || "",
			justification: values.justification || "",
			context: values.context || [],
		};

		// Pass empty string - server action uses validateSession() internally
		const updated = await updateAssuranceCaseNode(
			node.type,
			node.data.id,
			"",
			updateItem
		);

		if (updated) {
			// Record update operation for undo/redo
			const afterData = { ...beforeData, ...updateItem };
			recordUpdate(node.data.id, node.type, beforeData, afterData);

			const updatedAssuranceCase = await updateAssuranceCase(
				node.type || "",
				assuranceCase,
				updateItem as Record<string, string | string[]>,
				node.data.id,
				node as unknown as ReactFlowNode
			);
			if (updatedAssuranceCase) {
				setAssuranceCase(updatedAssuranceCase);
				setLoading(false);
				onClose();
			}
		}
	}

	const readOnly = !!(
		assuranceCase?.permissions === "view" ||
		assuranceCase?.permissions === "comment"
	);

	const showAssumption = node.data.assumption || newAssumption;
	const showJustification =
		supportsJustification(node.type) &&
		(node.data.justification || newJustification);

	return (
		<div className="my-4 border-t">
			<div className="mt-4 font-medium text-muted-foreground text-sm">
				Please use this section to manage attributes for this element.
			</div>

			{!readOnly && (
				<AddAttributeButtons
					hasAssumption={!!node.data.assumption}
					hasJustification={!!node.data.justification}
					newAssumption={newAssumption}
					newJustification={newJustification}
					onToggleAssumption={() => setNewAssumption(!newAssumption)}
					onToggleJustification={() => setNewJustification(!newJustification)}
					supportsJustification={supportsJustification(node.type)}
				/>
			)}

			<Form {...form}>
				<form className="my-4 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
					{showAssumption && (
						<AttributeTextField
							form={form}
							label="Assumption"
							name="assumption"
							onClear={() => {
								form.setValue("assumption", "");
								setNewAssumption(false);
							}}
							placeholder="Type your assumption here."
							readOnly={readOnly}
						/>
					)}
					{showJustification && (
						<AttributeTextField
							form={form}
							label="Justification"
							name="justification"
							onClear={() => {
								form.setValue("justification", "");
								setNewJustification(false);
							}}
							placeholder="Type your justification here."
							readOnly={readOnly}
						/>
					)}

					{/* Context Section */}
					{supportsContext(node.type) && (
						<ContextEditor form={form} readOnly={readOnly} />
					)}

					<div className="flex items-center justify-start gap-3 pt-4">
						<Button onClick={handleCancel} variant={"outline"}>
							Cancel
						</Button>
						{!readOnly && (
							<Button
								className="bg-primary text-primary-foreground hover:bg-primary/90"
								disabled={loading}
								type="submit"
							>
								{loading ? "Saving..." : "Update Attributes"}
							</Button>
						)}
					</div>
				</form>
			</Form>
		</div>
	);
};

export default NodeAttributes;
