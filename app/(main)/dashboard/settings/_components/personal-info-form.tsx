"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { useToast } from "@/components/ui/use-toast";

// Minimal user data needed for this form
type UserData = {
	id: number | string;
	email?: string;
	username?: string;
	firstName?: string | null;
	lastName?: string | null;
};

const FormSchema = z.object({
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	username: z
		.string()
		.min(3, {
			message: "Username must be at least 3 characters.",
		})
		.regex(/^[a-zA-Z0-9_]+$/, {
			message: "Username can only contain letters, numbers, and underscores.",
		}),
	email: z.string().email({
		message: "Please enter a valid email address.",
	}),
});

type PersonalInfoFormProps = {
	data: UserData | null | undefined;
};

export function PersonalInfoForm({ data }: PersonalInfoFormProps) {
	const [loading, setLoading] = useState<boolean>(false);

	const { data: session } = useSession();
	const { toast } = useToast();

	const notify = (message: string) => {
		toast({
			description: message,
		});
	};

	const notifyError = (message: string) => {
		toast({
			variant: "destructive",
			title: "Uh oh! Something went wrong.",
			description: message,
		});
	};

	const form = useForm<z.infer<typeof FormSchema>>({
		resolver: zodResolver(FormSchema),
		defaultValues: {
			firstName: data?.firstName ?? "",
			lastName: data?.lastName ?? "",
			username: data?.username ?? "",
			email: data?.email ?? "",
		},
	});

	async function onSubmit(values: z.infer<typeof FormSchema>) {
		if (!data) {
			return;
		}
		setLoading(true);

		const updatePayload = {
			username: values.username,
			firstName: values.firstName || null,
			lastName: values.lastName || null,
			email: values.email,
		};

		try {
			// Use internal Prisma API route
			const response = await fetch("/api/users/me", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(updatePayload),
			});

			if (!response.ok) {
				const errorData = await response.json();
				notifyError(errorData.error || "Something went wrong");
				return;
			}

			notify("Profile updated successfully!");
		} catch (_error) {
			notifyError("Failed to update profile");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
			<div>
				<h2 className="font-semibold text-base text-foreground leading-7">
					Personal Information
				</h2>
				<p className="mt-1 text-gray-400 text-sm leading-6">
					Update your personal details here.
				</p>
			</div>

			<div className="md:col-span-2">
				<Form {...form}>
					<form
						className="w-full space-y-6"
						onSubmit={form.handleSubmit(onSubmit)}
					>
						<div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
							<FormField
								control={form.control}
								name="firstName"
								render={({ field }) => (
									<FormItem className="sm:col-span-3">
										<FormLabel>First name</FormLabel>
										<FormControl>
											<Input placeholder="John" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="lastName"
								render={({ field }) => (
									<FormItem className="sm:col-span-3">
										<FormLabel>Last name</FormLabel>
										<FormControl>
											<Input placeholder="Doe" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="username"
								render={({ field }) => (
									<FormItem className="col-span-full">
										<FormLabel>Username</FormLabel>
										<FormControl>
											<Input placeholder="johndoe" {...field} />
										</FormControl>
										<FormDescription className="text-xs">
											Username can only contain letters, numbers, and
											underscores.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem className="col-span-full">
										<FormLabel>Email Address</FormLabel>
										<FormControl>
											<Input
												placeholder="example@gmail.com"
												type="email"
												{...field}
											/>
										</FormControl>
										<FormDescription className="text-xs">
											Your email address is used for notifications and account
											recovery.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						{session && (
							<Button
								className="bg-indigo-600 text-white hover:bg-indigo-700"
								disabled={loading}
								type="submit"
							>
								{loading ? "Saving..." : "Save Changes"}
							</Button>
						)}
					</form>
				</Form>
			</div>
		</div>
	);
}
