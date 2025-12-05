"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertModal } from "@/components/modals/alert-modal";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
	name: z
		.string()
		.min(1, "Name is required")
		.max(100, "Name must be 100 characters or less"),
	description: z
		.string()
		.max(500, "Description must be 500 characters or less")
		.optional(),
});

type FormValues = z.infer<typeof formSchema>;

type Team = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
};

export default function TeamSettingsPage() {
	const params = useParams();
	const router = useRouter();
	const teamId = params.id as string;

	const [team, setTeam] = useState<Team | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
		},
	});

	useEffect(() => {
		async function fetchTeam() {
			try {
				const response = await fetch(`/api/teams/${teamId}`);

				if (response.status === 404) {
					router.push("/dashboard/teams");
					return;
				}

				if (!response.ok) {
					throw new Error("Failed to fetch team");
				}

				const data = await response.json();
				setTeam(data);
				form.reset({
					name: data.name,
					description: data.description || "",
				});
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "An error occurred";
				setError(message);
			} finally {
				setLoading(false);
			}
		}

		fetchTeam();
	}, [teamId, router, form]);

	const onSubmit = async (values: FormValues) => {
		setSaving(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await fetch(`/api/teams/${teamId}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(values),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to update team");
			}

			const updatedTeam = await response.json();
			setTeam(updatedTeam);
			setSuccess("Team updated successfully");
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		setDeleting(true);

		try {
			const response = await fetch(`/api/teams/${teamId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to delete team");
			}

			router.push("/dashboard/teams");
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
			setDeleting(false);
			setDeleteModalOpen(false);
		}
	};

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader className="h-10 w-10 animate-spin" />
			</div>
		);
	}

	if (!team) {
		return null;
	}

	return (
		<div className="flex min-h-screen flex-col items-start justify-start px-4 pb-16 sm:px-6 lg:px-8">
			<div className="flex w-full items-center gap-4 py-6">
				<Link href={`/dashboard/teams/${teamId}`}>
					<Button size="icon" title="Back to team" variant="ghost">
						<ArrowLeft className="h-5 w-5" />
					</Button>
				</Link>
				<div>
					<h1 className="font-semibold text-2xl">Team Settings</h1>
					<p className="text-muted-foreground">Manage your team settings</p>
				</div>
			</div>

			<div className="w-full max-w-2xl space-y-6">
				{error && (
					<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
						{error}
					</div>
				)}
				{success && (
					<div className="rounded-md bg-emerald-100 p-3 text-emerald-800 text-sm dark:bg-emerald-900/30 dark:text-emerald-200">
						{success}
					</div>
				)}

				<Card>
					<CardHeader>
						<CardTitle>General</CardTitle>
						<CardDescription>
							Update your team&apos;s name and description
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Form {...form}>
							<form
								className="space-y-6"
								onSubmit={form.handleSubmit(onSubmit)}
							>
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Team Name</FormLabel>
											<FormControl>
												<Input disabled={saving} {...field} />
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
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea disabled={saving} rows={3} {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<div className="flex justify-end">
									<Button disabled={saving} type="submit">
										{saving ? (
											<>
												<Loader className="mr-2 h-4 w-4 animate-spin" />
												Saving...
											</>
										) : (
											"Save Changes"
										)}
									</Button>
								</div>
							</form>
						</Form>
					</CardContent>
				</Card>

				<Card className="border-destructive/50">
					<CardHeader>
						<CardTitle className="text-destructive">Danger Zone</CardTitle>
						<CardDescription>
							Permanently delete this team and all its data
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="mb-4 text-muted-foreground text-sm">
							Once you delete a team, there is no going back. This will remove
							all team members and revoke all team-based case permissions.
						</p>
						<Button
							onClick={() => setDeleteModalOpen(true)}
							variant="destructive"
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete Team
						</Button>
					</CardContent>
				</Card>
			</div>

			<AlertModal
				confirmButtonText="Delete Team"
				isOpen={deleteModalOpen}
				loading={deleting}
				onClose={() => setDeleteModalOpen(false)}
				onConfirm={handleDelete}
			/>
		</div>
	);
}
