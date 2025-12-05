"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MinusIcon, PlusIcon, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import type React from "react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useForm } from "react-hook-form";
import type { Node } from "reactflow";
import { z } from "zod";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import useStore from "@/data/store";
import {
	type ReactFlowNode,
	updateAssuranceCase,
	updateAssuranceCaseNode,
} from "@/lib/case";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

const formSchema = z.object({
	assumption: z.string().optional(),
	justification: z.string().optional(),
});

// Define the structure of node.data
type NodeWithData = Node & {
	data: {
		id: number;
		assumption?: string;
		justification?: string;
	};
};

// Define the structure of actions prop
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

	const reset = () => {
		setSelectedLink(false);
		setAction("");
	};

	const handleCancel = () => {
		form.reset(); // Reset the form state
		reset(); // Perform additional reset actions
	};

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: node.data || {
			assumption: "",
			justification: "",
		},
	});

	async function onSubmit(values: z.infer<typeof formSchema>) {
		if (!(assuranceCase && session?.key && node.type)) {
			return;
		}

		setLoading(true);
		// Update item via api
		const updateItem = {
			assumption: values.assumption || "",
			justification: values.justification || "",
		};

		const updated = await updateAssuranceCaseNode(
			node.type,
			node.data.id,
			session.key,
			updateItem
		);

		if (updated) {
			// Assurance Case Update
			const updatedAssuranceCase = await updateAssuranceCase(
				node.type || "",
				assuranceCase,
				updateItem as Record<string, string>,
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

	// useEffect(() => {
	//   form.watch((values, { name }) => {
	//     if (name === 'assumption') {
	//       setUnresolvedChanges(true);
	//     }
	//   });
	// }, [form.watch, setUnresolvedChanges]);

	return (
		<div className="my-4 border-t">
			<div className="mt-4 font-medium text-muted-foreground text-sm">
				Please use this section to manage attributes for this element.
			</div>

			{!readOnly && (
				<div className="mt-4 flex items-center justify-start gap-2">
					{!node.data.assumption && (
						<Button
							onClick={() => setNewAssumption(!newAssumption)}
							size={"sm"}
							variant={"outline"}
						>
							{newAssumption ? (
								<MinusIcon className="mr-2 size-3" />
							) : (
								<PlusIcon className="mr-2 size-3" />
							)}
							Assumption
						</Button>
					)}
					{!node.data.justification && node.type === "strategy" && (
						<Button
							onClick={() => setNewJustification(!newJustification)}
							size={"sm"}
							variant={"outline"}
						>
							{newJustification ? (
								<MinusIcon className="mr-2 size-3" />
							) : (
								<PlusIcon className="mr-2 size-3" />
							)}
							Justification
						</Button>
					)}
				</div>
			)}

			<Form {...form}>
				<form className="my-4 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
					{(node.data.assumption || newAssumption) && (
						<FormField
							control={form.control}
							name="assumption"
							render={({ field }) => (
								<FormItem>
									<div className="flex items-center justify-between">
										<FormLabel>Assumption</FormLabel>
										{!readOnly && (
											<button
												className="rounded p-1 text-rose-500 hover:bg-rose-500/10"
												onClick={() => {
													form.setValue("assumption", "");
													setNewAssumption(false);
												}}
												title="Remove assumption"
												type="button"
											>
												<Trash2 className="h-4 w-4" />
											</button>
										)}
									</div>
									<FormControl>
										<Textarea
											placeholder="Type your assumption here."
											rows={5}
											{...field}
											readOnly={readOnly}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					)}
					{node.type === "strategy" &&
						(node.data.justification || newJustification) && (
							<FormField
								control={form.control}
								name="justification"
								render={({ field }) => (
									<FormItem>
										<div className="flex items-center justify-between">
											<FormLabel>Justification</FormLabel>
											{!readOnly && (
												<button
													className="rounded p-1 text-rose-500 hover:bg-rose-500/10"
													onClick={() => {
														form.setValue("justification", "");
														setNewJustification(false);
													}}
													title="Remove justification"
													type="button"
												>
													<Trash2 className="h-4 w-4" />
												</button>
											)}
										</div>
										<FormControl>
											<Textarea
												placeholder="Type your justification here."
												rows={5}
												{...field}
												readOnly={readOnly}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
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
