"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock } from "lucide-react";
import { useSession } from "next-auth/react";
import type React from "react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import useStore from "@/data/store";
// import { useLoginToken } from '.*/use-auth'
import {
	type ReactFlowNode,
	updateAssuranceCase,
	updateAssuranceCaseNode,
} from "@/lib/case";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

const formSchema = z.object({
	URL: z
		.string()
		.min(2, {
			message: "url must be at least 2 characters.",
		})
		.optional(),
	description: z.string().min(2, {
		message: "Description must be atleast 2 characters",
	}),
});

type EditFormProps = {
	node: Node;
	onClose: () => void;
	setUnresolvedChanges: Dispatch<SetStateAction<boolean>>;
};

const EditForm: React.FC<EditFormProps> = ({
	node,
	onClose,
	setUnresolvedChanges,
}) => {
	const { assuranceCase, setAssuranceCase } = useStore();
	// const [token] = useLoginToken();
	const { data: session } = useSession();
	const [loading, setLoading] = useState(false);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			URL: (node.data?.URL as string) ?? "",
			description: (node.data?.short_description as string) ?? "",
		},
	});

	async function onSubmit(values: z.infer<typeof formSchema>) {
		setLoading(true);
		// Update item via api
		const updateItem = {
			short_description: values.description,
		};

		if (node.type === "evidence") {
			//@ts-expect-error
			updateItem.URL = values.URL;
		}

		const updated = await updateAssuranceCaseNode(
			node.type || "unknown",
			node.data.id,
			session?.key ?? "",
			updateItem
		);

		if (updated && assuranceCase) {
			// Assurance Case Update
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
				// window.location.reload()
				onClose();
			}
		}
	}

	useEffect(() => {
		form.watch((_values, { name }) => {
			if (name === "description" || name === "URL") {
				setUnresolvedChanges(true);
			}
		});
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
					<FormField
						control={form.control}
						name="URL"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="flex items-center justify-start gap-2">
									Evidence URL
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
									<Input
										placeholder="www.sample.com"
										{...field}
										readOnly={readOnly}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
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
