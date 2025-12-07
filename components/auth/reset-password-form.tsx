"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";

const formSchema = z
	.object({
		password: z
			.string()
			.min(8, "Password must be at least 8 characters")
			.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
			.regex(/\d/, "Password must contain at least one number")
			.regex(
				/[!@#$%^&*()_,.?":{}|<>]/,
				"Password must contain at least one special character"
			),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type FormValues = z.infer<typeof formSchema>;

type TokenState = "loading" | "valid" | "invalid" | "expired";

const ResetPasswordForm = () => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	const [tokenState, setTokenState] = useState<TokenState>("loading");
	const [email, setEmail] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			password: "",
			confirmPassword: "",
		},
	});

	// Validate token on mount
	useEffect(() => {
		async function validateToken() {
			if (!token) {
				setTokenState("invalid");
				return;
			}

			try {
				const response = await fetch(
					`/api/auth/reset-password?token=${encodeURIComponent(token)}`
				);
				const data = await response.json();

				if (response.ok && data.valid) {
					setTokenState("valid");
					setEmail(data.email);
				} else if (data.error?.includes("expired")) {
					setTokenState("expired");
				} else {
					setTokenState("invalid");
				}
			} catch (_error) {
				setTokenState("invalid");
			}
		}

		validateToken();
	}, [token]);

	async function onSubmit(values: FormValues) {
		if (!token) {
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/auth/reset-password", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					token,
					password: values.password,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				setError(data.error || "Failed to reset password. Please try again.");
				setLoading(false);
				return;
			}

			setSuccess(true);
			// Redirect to login after a short delay
			setTimeout(() => {
				router.push("/login?reset=true");
			}, 3000);
		} catch (_error) {
			setError("Connection error. Please check your internet and try again.");
		} finally {
			setLoading(false);
		}
	}

	// Loading state
	if (tokenState === "loading") {
		return (
			<div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center lg:w-96">
				<Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
				<p className="mt-4 text-foreground text-sm">Validating reset link...</p>
			</div>
		);
	}

	// Invalid token state
	if (tokenState === "invalid") {
		return (
			<div className="mx-auto w-full max-w-sm lg:w-96">
				<div className="rounded-md border border-rose-700 bg-rose-500/20 px-4 py-6">
					<h3 className="font-semibold text-rose-800 dark:text-rose-400">
						Invalid reset link
					</h3>
					<p className="mt-2 text-rose-700 text-sm dark:text-rose-300">
						This password reset link is invalid. Please request a new one.
					</p>
				</div>
				<div className="mt-6 text-center">
					<Link
						className="font-semibold text-indigo-600 text-sm hover:text-indigo-500"
						href="/forgot-password"
					>
						Request new reset link
					</Link>
				</div>
			</div>
		);
	}

	// Expired token state
	if (tokenState === "expired") {
		return (
			<div className="mx-auto w-full max-w-sm lg:w-96">
				<div className="rounded-md border border-amber-700 bg-amber-500/20 px-4 py-6">
					<h3 className="font-semibold text-amber-800 dark:text-amber-400">
						Link expired
					</h3>
					<p className="mt-2 text-amber-700 text-sm dark:text-amber-300">
						This password reset link has expired. Please request a new one.
					</p>
				</div>
				<div className="mt-6 text-center">
					<Link
						className="font-semibold text-indigo-600 text-sm hover:text-indigo-500"
						href="/forgot-password"
					>
						Request new reset link
					</Link>
				</div>
			</div>
		);
	}

	// Success state
	if (success) {
		return (
			<div className="mx-auto w-full max-w-sm lg:w-96">
				<div className="rounded-md border border-green-700 bg-green-500/20 px-4 py-6">
					<h3 className="font-semibold text-green-800 dark:text-green-400">
						Password reset successful
					</h3>
					<p className="mt-2 text-green-700 text-sm dark:text-green-300">
						Your password has been reset. Redirecting you to login...
					</p>
				</div>
			</div>
		);
	}

	// Valid token - show reset form
	return (
		<div className="mx-auto w-full max-w-sm lg:w-96">
			<div>
				<h2 className="mt-8 font-bold text-2xl text-foreground leading-9 tracking-tight">
					Reset your password
				</h2>
				{email && (
					<p className="mt-2 text-foreground text-sm leading-6">
						Enter a new password for <strong>{email}</strong>
					</p>
				)}
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
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel>New password</FormLabel>
									<FormControl>
										<div className="relative">
											<Input
												autoComplete="new-password"
												type={showPassword ? "text" : "password"}
												{...field}
											/>
											<button
												aria-label={
													showPassword ? "Hide password" : "Show password"
												}
												className="-translate-y-1/2 absolute top-1/2 right-3 text-gray-500 hover:text-gray-700"
												onClick={() => setShowPassword(!showPassword)}
												type="button"
											>
												{showPassword ? (
													<EyeOff className="h-4 w-4" />
												) : (
													<Eye className="h-4 w-4" />
												)}
											</button>
										</div>
									</FormControl>
									<FormDescription>
										Must be at least 8 characters with one uppercase letter, one
										number, and one special character.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="confirmPassword"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Confirm new password</FormLabel>
									<FormControl>
										<div className="relative">
											<Input
												autoComplete="new-password"
												type={showConfirmPassword ? "text" : "password"}
												{...field}
											/>
											<button
												aria-label={
													showConfirmPassword
														? "Hide password"
														: "Show password"
												}
												className="-translate-y-1/2 absolute top-1/2 right-3 text-gray-500 hover:text-gray-700"
												onClick={() =>
													setShowConfirmPassword(!showConfirmPassword)
												}
												type="button"
											>
												{showConfirmPassword ? (
													<EyeOff className="h-4 w-4" />
												) : (
													<Eye className="h-4 w-4" />
												)}
											</button>
										</div>
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
							{loading ? "Resetting..." : "Reset password"}
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

export default ResetPasswordForm;
