"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, Minus, Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import type React from "react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import useStore from "@/data/store";
import {
	type ReactFlowNode,
	updateAssuranceCase,
	updateAssuranceCaseNode,
} from "@/lib/case";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

const formSchema = z.object({
	urls: z.array(
		z.object({
			value: z.string(),
		})
	),
	description: z.string().min(2, {
		message: "Description must be at least 2 characters",
	}),
});

type EditFormProps = {
	node: Node;
	onClose: () => void;
	setUnresolvedChanges: Dispatch<SetStateAction<boolean>>;
};

/**
 * Converts node data URLs to field array format.
 * Handles both legacy single URL and new urls array.
 */
function getInitialUrls(
	nodeData: Record<string, unknown>
): Array<{ value: string }> {
	const urls = nodeData?.urls as string[] | undefined;
	const legacyUrl = nodeData?.URL as string | undefined;

	if (urls && urls.length > 0) {
		return urls.map((url) => ({ value: url }));
	}
	if (legacyUrl) {
		return [{ value: legacyUrl }];
	}
	return [{ value: "" }];
}

const EditForm: React.FC<EditFormProps> = ({
	node,
	onClose,
	setUnresolvedChanges,
}) => {
	const { assuranceCase, setAssuranceCase } = useStore();
	const { data: session } = useSession();
	const [loading, setLoading] = useState(false);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			urls: getInitialUrls(node.data as Record<string, unknown>),
			description: (node.data?.short_description as string) ?? "",
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "urls",
	});

	async function onSubmit(values: z.infer<typeof formSchema>) {
		setLoading(true);

		const updateItem: Record<string, unknown> = {
			short_description: values.description,
		};

		if (node.type === "evidence") {
			// Filter out empty URLs and extract values
			const urlValues = values.urls
				.map((u) => u.value.trim())
				.filter((url) => url.length > 0);
			updateItem.urls = urlValues;
			// Maintain backward compatibility
			updateItem.URL = urlValues[0] || "";
		}

		const updated = await updateAssuranceCaseNode(
			node.type || "unknown",
			node.data.id,
			session?.key ?? "",
			updateItem
		);

		if (updated && assuranceCase) {
			const updatedAssuranceCase = await updateAssuranceCase(
				node.type || "unknown",
				assuranceCase,
				updateItem,
				node.data.id,
				{ ...node, type: node.type || "" } as ReactFlowNode
			);
			if (updatedAssuranceCase) {
				setAssuranceCase(updatedAssuranceCase);
				setLoading(false);
				setUnresolvedChanges(false);
				onClose();
			}
		}
	}

	useEffect(() => {
		const subscription = form.watch((_values, { name }) => {
			if (name?.startsWith("urls") || name === "description") {
				setUnresolvedChanges(true);
			}
		});
		return () => subscription.unsubscribe();
	}, [form, setUnresolvedChanges]);

	const readOnly = !!(
		assuranceCase?.permissions === "view" ||
		assuranceCase?.permissions === "comment"
	);

	return (
		<Form {...form}>
			<form className="mt-6 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="flex items-center justify-start gap-2">
								Description
								{readOnly && (
									<span
										className="flex items-center justify-start gap-2 py-2 text-muted-foreground text-xs"
										title="Read Only"
									>
										<Lock className="h-3 w-3" />
									</span>
								)}
							</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Type your message here."
									{...field}
									readOnly={readOnly}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				{node.type === "evidence" && (
					<div className="space-y-3">
						<FormLabel className="flex items-center justify-start gap-2">
							Evidence URLs
							{readOnly && (
								<span
									className="flex items-center justify-start gap-2 py-2 text-muted-foreground text-xs"
									title="Read Only"
								>
									<Lock className="h-3 w-3" />
								</span>
							)}
						</FormLabel>
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
													placeholder="https://example.com/evidence"
													{...inputField}
													readOnly={readOnly}
												/>
											</FormControl>
											{!readOnly && fields.length > 1 && (
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
						{!readOnly && (
							<Button
								className="w-full"
								onClick={() => append({ value: "" })}
								type="button"
								variant="outline"
							>
								<Plus className="mr-2 h-4 w-4" />
								Add URL
							</Button>
						)}
					</div>
				)}
				<div className="flex items-center justify-start gap-3">
					{!readOnly && (
						<Button
							className="bg-indigo-500 hover:bg-indigo-600 dark:text-white"
							disabled={loading}
							type="submit"
						>
							{loading ? (
								<span
									className="flex items-center justify-center gap-2"
									title="Read Only"
								>
									<Loader2 className="h-4 w-4 animate-spin" />
									Updating...
								</span>
							) : (
								<span>
									Update&nbsp;
									<span className="capitalize">{node.type || "unknown"}</span>
								</span>
							)}
						</Button>
					)}
				</div>
			</form>
		</Form>
	);
};

export default EditForm;
