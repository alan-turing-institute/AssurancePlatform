"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useInviteMemberModal } from "@/hooks/use-invite-member-modal";

const formSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	role: z.enum(["MEMBER", "ADMIN"]),
});

type FormValues = z.infer<typeof formSchema>;

export function InviteMemberDialog() {
	const inviteMemberModal = useInviteMemberModal();
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
			role: "MEMBER",
		},
	});

	const onSubmit = async (values: FormValues) => {
		if (!inviteMemberModal.teamId) {
			return;
		}

		setLoading(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await fetch(
				`/api/teams/${inviteMemberModal.teamId}/members`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(values),
				}
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to add member");
			}

			if (data.user_not_found) {
				setSuccess(
					"User not found. They will need to register first, then you can add them to the team."
				);
			} else {
				form.reset();
				inviteMemberModal.onClose();
				router.refresh();
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setLoading(false);
		}
	};

	const handleClose = () => {
		form.reset();
		setError(null);
		setSuccess(null);
		inviteMemberModal.onClose();
	};

	return (
		<Modal
			description="Add a team member by their email address."
			isOpen={inviteMemberModal.isOpen}
			onClose={handleClose}
			title="Add Team Member"
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
					{success && (
						<div className="rounded-md bg-amber-100 p-3 text-amber-800 text-sm dark:bg-amber-900/30 dark:text-amber-200">
							{success}
						</div>
					)}
					<Form {...form}>
						<form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Email Address</FormLabel>
										<FormControl>
											<Input
												disabled={loading}
												placeholder="colleague@example.com"
												type="email"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="role"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Role</FormLabel>
										<Select
											defaultValue={field.value}
											disabled={loading}
											onValueChange={field.onChange}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select a role" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="MEMBER">Member</SelectItem>
												<SelectItem value="ADMIN">Admin</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
							<div className="flex w-full items-center justify-end space-x-2 pt-6">
								<Button
									disabled={loading}
									onClick={(e) => {
										e.preventDefault();
										handleClose();
									}}
									variant="outline"
								>
									Cancel
								</Button>
								<Button disabled={loading} type="submit">
									Add Member
								</Button>
							</div>
						</form>
					</Form>
				</div>
			)}
		</Modal>
	);
}
