"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTeamModal } from "@/hooks/use-create-team-modal";
import {
	type CreateTeamSchemaInput,
	createTeamSchema,
} from "@/lib/schemas/team";

export function CreateTeamDialog() {
	const createTeamModal = useCreateTeamModal();
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const form = useForm<CreateTeamSchemaInput>({
		resolver: zodResolver(createTeamSchema),
		defaultValues: {
			name: "",
			description: "",
		},
	});

	const onSubmit = async (values: CreateTeamSchemaInput) => {
		setLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/teams", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(values),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to create team");
			}

			const team = await response.json();
			form.reset();
			createTeamModal.onClose();
			router.push(`/dashboard/teams/${team.id}`);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setLoading(false);
		}
	};

	const handleCancel = (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		form.reset();
		setError(null);
		createTeamModal.onClose();
	};

	return (
		<Modal
			description="Create a new team to collaborate with others on assurance cases."
			isOpen={createTeamModal.isOpen}
			onClose={createTeamModal.onClose}
			title="Create New Team"
		>
			{loading ? (
				<div className="flex items-center justify-center p-16">
					<Loader className="h-10 w-10 animate-spin" />
				</div>
			) : (
				<div className="space-y-4 py-2 pb-4">
					{error && (
						<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
							{error}
						</div>
					)}
					<Form {...form}>
						<form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Team Name</FormLabel>
										<FormControl>
											<Input
												disabled={loading}
												placeholder="My Team"
												{...field}
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
										<FormLabel>Description (optional)</FormLabel>
										<FormControl>
											<Textarea
												disabled={loading}
												placeholder="What is this team for?"
												rows={3}
												{...field}
												value={field.value ?? ""}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<div className="flex w-full items-center justify-end space-x-2 pt-6">
								<Button
									disabled={loading}
									onClick={handleCancel}
									variant="outline"
								>
									Cancel
								</Button>
								<Button disabled={loading} type="submit">
									Create Team
								</Button>
							</div>
						</form>
					</Form>
				</div>
			)}
		</Modal>
	);
}
