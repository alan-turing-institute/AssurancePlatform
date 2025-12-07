"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import type React from "react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useForm } from "react-hook-form";
import type { Node } from "reactflow";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import useStore from "@/data/store";
import {
	type ReactFlowNode,
	updateAssuranceCase,
	updateAssuranceCaseNode,
} from "@/lib/case";
import { Button } from "../ui/button";
import AddAttributeButtons from "./add-attribute-buttons";
import AttributeTextField from "./attribute-text-field";
import ContextEditor from "./context-editor";

const formSchema = z.object({
	assumption: z.string().optional(),
	justification: z.string().optional(),
	context: z.array(z.string()).optional(),
});

type NodeWithData = Node & {
	data: {
		id: number;
		assumption?: string;
		justification?: string;
		context?: string[];
	};
};

type NodeActions = {
	setSelectedLink: (value: boolean) => void;
	setAction: (value: string) => void;
};

type NodeAttributesProps = {
	node: NodeWithData;
	actions: NodeActions;
	onClose: () => void;
	setUnresolvedChanges: Dispatch<SetStateAction<boolean>>;
};

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

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
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

	async function onSubmit(values: z.infer<typeof formSchema>) {
		if (!(assuranceCase && session?.key && node.type)) {
			return;
		}

		setLoading(true);
		const updateItem = {
			assumption: values.assumption || "",
			justification: values.justification || "",
			context: values.context || [],
		};

		const updated = await updateAssuranceCaseNode(
			node.type,
			node.data.id,
			session.key,
			updateItem
		);

		if (updated) {
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
								className="bg-indigo-500 hover:bg-indigo-600 dark:text-white"
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
