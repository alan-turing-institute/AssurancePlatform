"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";

const formSchema = z.object({
	email: z
		.string()
		.min(1, "Email is required")
		.email("Please enter a valid email address"),
});

type FormValues = z.infer<typeof formSchema>;

const ForgotPasswordForm = () => {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
		},
	});

	async function onSubmit(values: FormValues) {
		setLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/auth/forgot-password", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email: values.email }),
			});

			const data = await response.json();

			if (!response.ok) {
				if (response.status === 429) {
					setError("Too many requests. Please try again later.");
				} else if (response.status === 501) {
					setError("Password reset is not currently available.");
				} else {
					setError(data.error || "An error occurred. Please try again.");
				}
				setLoading(false);
				return;
			}

			setSuccess(true);
		} catch (_error) {
			setError("Connection error. Please check your internet and try again.");
		} finally {
			setLoading(false);
		}
	}

	if (success) {
		return (
			<div className="mx-auto w-full max-w-sm lg:w-96">
				<div className="rounded-md border border-green-700 bg-green-500/20 px-4 py-6">
					<h3 className="font-semibold text-green-800 dark:text-green-400">
						Check your email
					</h3>
					<p className="mt-2 text-green-700 text-sm dark:text-green-300">
						If an account with that email exists, you will receive a password
						reset link shortly. Please check your inbox and spam folder.
					</p>
				</div>
				<div className="mt-6 text-center">
					<Link
						className="font-semibold text-indigo-600 text-sm hover:text-indigo-500"
						href="/login"
					>
						Back to login
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-sm lg:w-96">
			<div>
				<h2 className="mt-8 font-bold text-2xl text-foreground leading-9 tracking-tight">
					Forgot your password?
				</h2>
				<p className="mt-2 text-foreground text-sm leading-6">
					Enter your email address and we&apos;ll send you a link to reset your
					password.
				</p>
			</div>

			{error && (
				<div className="mt-4 rounded-md border border-rose-700 bg-rose-500/20 px-4 py-2 text-rose-700">
					<p>{error}</p>
				</div>
			)}

			<div className="mt-10">
				<Form {...form}>
					<form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email address</FormLabel>
									<FormControl>
										<Input
											autoComplete="email"
											placeholder="alan.turing@example.com"
											type="email"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button
							className="w-full bg-indigo-600 text-white hover:bg-indigo-500"
							disabled={loading}
							type="submit"
						>
							{loading ? "Sending..." : "Send reset link"}
						</Button>
					</form>
				</Form>

				<div className="mt-6 text-center">
					<Link
						className="font-semibold text-indigo-600 text-sm hover:text-indigo-500"
						href="/login"
					>
						Back to login
					</Link>
				</div>
			</div>
		</div>
	);
};

export default ForgotPasswordForm;
