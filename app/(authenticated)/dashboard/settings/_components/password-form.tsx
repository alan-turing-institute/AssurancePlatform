"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	type ChangePasswordFormInput,
	changePasswordFormSchema,
} from "@/lib/schemas/user";
import { toast } from "@/lib/toast";

// Minimal user data needed for this form
interface UserData {
	id: number | string;
}

const _ACCEPTED_FILE_TYPES = ["jpg"];

interface PasswordFormProps {
	data: UserData | null | undefined;
}

export function PasswordForm({ data }: PasswordFormProps) {
	const [error, setError] = useState<string>("");
	const [loading, setLoading] = useState<boolean>(false);
	const { data: session } = useSession();

	const notify = (message: string) => {
		toast({
			description: message,
		});
	};

	const form = useForm<ChangePasswordFormInput>({
		resolver: zodResolver(changePasswordFormSchema),
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	async function onSubmit(values: ChangePasswordFormInput) {
		if (!data) {
			return;
		}
		setError("");
		setLoading(true);

		const newDetails = {
			currentPassword: values.currentPassword,
			newPassword: values.newPassword,
		};

		try {
			// Use internal Prisma API route
			const response = await fetch("/api/users/me/password", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(newDetails),
			});

			if (!response.ok) {
				const { error: serverError } = await response.json();
				if (serverError) {
					setError(serverError);
					return;
				}
			}
			notify("Password Updated Successfully!");
			form.reset();
		} catch (_error) {
			setError("Failed to change password");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
			<div>
				<h2 className="font-semibold text-base text-foreground leading-7">
					Change password
				</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-6">
					Update your password associated with your account.
				</p>
			</div>

			<div className="md:col-span-2">
				{session?.provider === "credentials" ? (
					<Form {...form}>
						<form
							className="w-full space-y-6"
							onSubmit={form.handleSubmit(onSubmit)}
						>
							<div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
								<FormField
									control={form.control}
									name="currentPassword"
									render={({ field }) => (
										<FormItem className="col-span-full">
											{error && (
												<p className="mb-2 text-destructive">{`${error}, Please try again.`}</p>
											)}
											<FormLabel>Current Password</FormLabel>
											<FormControl>
												<Input type="password" {...field} />
											</FormControl>
											<FormDescription>
												Please enter your existing password.
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="newPassword"
									render={({ field }) => (
										<FormItem className="col-span-full">
											<FormLabel>New Password</FormLabel>
											<FormControl>
												<Input type="password" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="confirmPassword"
									render={({ field }) => (
										<FormItem className="col-span-full">
											<FormLabel>Confirm Password</FormLabel>
											<FormControl>
												<Input type="password" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
							<Button
								className="bg-primary text-primary-foreground hover:bg-primary/80"
								disabled={loading}
								type="submit"
							>
								{loading ? "Updating" : "Update"}
							</Button>
						</form>
					</Form>
				) : (
					<p className="w-1/2 text-muted-foreground text-sm">
						You are logged in with a{" "}
						<span className="text-primary">{session?.provider}</span> account,
						therefore you cannot change your password here.
					</p>
				)}
			</div>
		</div>
	);
}
