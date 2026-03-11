"use client";

import { Minus, Plus } from "lucide-react";
import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Node } from "reactflow";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useNewLinkForm } from "@/hooks/use-new-link-form";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

type NodeActions = {
	setSelectedLink: (value: boolean) => void;
	setLinkToCreate: (value: string) => void;
	handleClose: () => void;
};

type NewLinkFormProps = {
	node: Node;
	linkType: string;
	actions: NodeActions;
	setUnresolvedChanges: Dispatch<SetStateAction<boolean>>;
	className?: string;
};

const NewLinkForm: React.FC<NewLinkFormProps> = ({
	node,
	linkType,
	actions,
	setUnresolvedChanges,
}) => {
	const { form, fields, append, remove, loading, onSubmit } = useNewLinkForm({
		node,
		linkType,
		actions,
		setUnresolvedChanges,
	});

	return (
		<div className="my-4 border-t">
			<div className="mt-4">
				Create new <span className="font-bold">{linkType}</span>.
			</div>
			<Form {...form}>
				<form className="mt-6 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Description</FormLabel>
								<FormControl>
									<Textarea
										placeholder="Type your description here."
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					{linkType === "evidence" && (
						<div className="space-y-3">
							<FormLabel>Evidence Link(s) (Optional)</FormLabel>
							{fields.map((field, index) => (
								<FormField
									control={form.control}
									key={field.id}
									name={`urls.${index}.value`}
									render={({ field: inputField }) => (
										<FormItem>
											<div className="flex gap-2">
												<FormControl>
													<Input
														placeholder="URL, DOI, or reference"
														{...inputField}
													/>
												</FormControl>
												{fields.length > 1 && (
													<Button
														onClick={() => remove(index)}
														size="icon"
														type="button"
														variant="outline"
													>
														<Minus className="h-4 w-4" />
													</Button>
												)}
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>
							))}
							<Button
								className="w-full"
								onClick={() => append({ value: "" })}
								type="button"
								variant="outline"
							>
								<Plus className="mr-2 h-4 w-4" />
								Add URL
							</Button>
						</div>
					)}
					<div className="flex items-center justify-start gap-3 pt-4">
						<Button
							className="bg-primary text-primary-foreground hover:bg-primary/90"
							disabled={loading}
							type="submit"
						>
							Add
						</Button>
						<Button
							onClick={() => {
								actions.setLinkToCreate("");
								actions.setSelectedLink(false);
								actions.handleClose();
							}}
							type="button"
							variant={"outline"}
						>
							Cancel
						</Button>
					</div>
				</form>
			</Form>
		</div>
	);
};

export default NewLinkForm;
