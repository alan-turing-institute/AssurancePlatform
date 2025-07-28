"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock } from "lucide-react";
import { useSession } from "next-auth/react";
import type React from "react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

// import { useLoginToken } from '.*/use-auth'

const formSchema = z.object({
	name: z
		.string()
		.min(2, {
			message: "Name must be at least 2 characters.",
		})
		.optional(),
	description: z.string().min(2, {
		message: "Description must be atleast 2 characters",
	}),
});

interface CaseEditFormProps {
	onClose: () => void;
	setUnresolvedChanges: Dispatch<SetStateAction<boolean>>;
}

const CaseEditForm: React.FC<CaseEditFormProps> = ({
	onClose,
	setUnresolvedChanges,
}) => {
	const { assuranceCase, setAssuranceCase } = useStore();
	// const [token] = useLoginToken();
	const { data: session } = useSession();
	const [loading, setLoading] = useState(false);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: assuranceCase || {
			name: "",
			description: "",
		},
	});

	async function onSubmit(values: z.infer<typeof formSchema>) {
		if (!assuranceCase) {
			return;
		}

		setLoading(true);
		const updateItem = {
			name: values.name,
			description: values.description,
		};

		const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase.id}/`;
		const requestOptions: RequestInit = {
			method: "PUT",
			headers: {
				Authorization: `Token ${session?.key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(updateItem),
		};
		const response = await fetch(url, requestOptions);
		if (!response.ok) {
			// TODO: Handle error response
		}

		setLoading(false);
		setAssuranceCase({
			...assuranceCase,
			name: values.name ?? assuranceCase.name,
			description: updateItem.description,
		});
		onClose();
	}

	useEffect(() => {
		form.watch((_values, { name }) => {
			if (name === "description" || name === "name") {
				setUnresolvedChanges(true);
			}
		});
	}, [form, setUnresolvedChanges]);

	return (
		<Form {...form}>
			<form className="mt-6 space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="flex items-center justify-start gap-2">
								Name
								{assuranceCase?.permissions !== "manage" && (
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
									{...field}
									readOnly={assuranceCase?.permissions !== "manage"}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="flex items-center justify-start gap-2">
								Description
								{assuranceCase?.permissions !== "manage" && (
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
									rows={8}
									{...field}
									readOnly={assuranceCase?.permissions !== "manage"}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<div className="flex items-center justify-start gap-3">
					{assuranceCase?.permissions === "manage" && (
						<Button
							className="bg-indigo-500 hover:bg-indigo-600 dark:text-white"
							disabled={loading}
							type="submit"
						>
							{loading ? (
								<span className="flex items-center justify-center gap-2">
									<Loader2 className="h-4 w-4 animate-spin" />
									Updating...
								</span>
							) : (
								<span>Update</span>
							)}
						</Button>
					)}
				</div>
			</form>
		</Form>
	);
};

export default CaseEditForm;
