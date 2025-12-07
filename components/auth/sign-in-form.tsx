"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
// import { useLoginToken } from '.*/use-auth';
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
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
	identifier: z.string().min(2, "Please enter your email or username"),
	password: z.string().min(8),
});

const SignInForm = () => {
	const [_usernameError, _setUsernameError] = useState<string>("");
	const [_passwordError, _setPasswordError] = useState<string>("");
	const [errors, setErrors] = useState<string[]>([]);
	const [_dirty, _setDirty] = useState(false);
	const [loading, setLoading] = useState(false);
	const [loadingProvider, setLoadingProvider] = useState(false);
	const [successMessage, setSuccessMessage] = useState<string>("");
	const [showPassword, setShowPassword] = useState(false);

	const router = useRouter();
	const searchParams = useSearchParams();

	// const [token, setToken] = useLoginToken();
	const { data: session } = useSession();

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			identifier: "",
			password: "",
		},
	});

	// async function onSubmit(values: z.infer<typeof formSchema>) {
	//   setLoading(true);

	//   const user = {
	//     username: values.username,
	//     password: values.password,
	//   };

	//   const requestOptions: RequestInit = {
	//     method: "POST",
	//     headers: {
	//       "Content-Type": "application/json",
	//     },
	//     body: JSON.stringify(user),
	//   }

	//   const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/auth/login/`, requestOptions)
	//   const result = await response.json()

	//   if (result.key) {
	//     setToken(result.key);
	//     router.push('/dashboard')
	//     return
	//   } else {
	//     setLoading(false);
	//     setToken(null);
	//     setErrors(["Cannot log in with provided credentials"]);
	//   }
	// }

	async function onSubmit(values: z.infer<typeof formSchema>) {
		setLoading(true);
		setErrors([]); // Clear any previous errors

		const { identifier, password } = values;

		try {
			// Use next-auth's signIn method with "credentials" provider
			// The identifier can be either email or username - backend handles both
			const result = await signIn("credentials", {
				redirect: false, // Prevent automatic navigation
				username: identifier,
				password,
			});

			if (result?.ok) {
				// Redirect to original page or dashboard on successful sign-in
				const redirectTo = searchParams.get("redirect") || "/dashboard";
				// Use router.refresh() to update server state, then redirect
				// This ensures the session is properly recognised before navigation
				router.refresh();
				router.push(redirectTo);
			} else {
				setLoading(false);
				// Provide user-friendly error messages
				const errorMessage =
					result?.error === "CredentialsSignin"
						? "Invalid credentials. Please check your email/username and password."
						: result?.error || "Unable to log in. Please try again.";
				setErrors([errorMessage]);
			}
		} catch (_error) {
			setLoading(false);
			setErrors([
				"Connection error. Please check your internet and try again.",
			]);
		}
	}

	const handleProviderLogin = (provider: string) => {
		setLoadingProvider(true);
		if (provider === "github") {
			signIn("github");
		}
	};

	useEffect(() => {
		// Check for registration success message
		if (searchParams.get("registered") === "true") {
			setSuccessMessage(
				"Account created successfully! Please log in with your credentials."
			);
		}

		// Check for password reset success message
		if (searchParams.get("reset") === "true") {
			setSuccessMessage(
				"Password reset successful! Please log in with your new password."
			);
		}

		// Only redirect if we have a valid session with a key
		// This prevents redirect loops during the authentication process
		if (session?.key) {
			const redirectTo = searchParams.get("redirect") || "/dashboard";
			router.push(redirectTo);
		}
		// Note: Stale sessions (session without key) are handled by middleware
		// which clears cookies and redirects to /login
	}, [session, router, searchParams]);

	return (
		<div className="mx-auto w-full max-w-sm lg:w-96">
			<div>
				<h2 className="mt-8 font-bold text-2xl text-foreground leading-9 tracking-tight">
					Sign in to your account
				</h2>
				<p className="mt-2 text-foreground text-sm leading-6">
					Not a member?{" "}
					<a
						className="font-semibold text-indigo-600 hover:text-indigo-600/80"
						href="/register"
					>
						Sign up today!
					</a>
				</p>
			</div>

			{successMessage && (
				<div className="mt-4 rounded-md border border-green-700 bg-green-500/20 px-4 py-2 text-green-700">
					<p>{successMessage}</p>
				</div>
			)}

			{errors?.map((error) => (
				<div
					className="-mb-4 mt-4 rounded-md border border-rose-700 bg-rose-500/20 px-4 py-2 text-rose-700"
					key={crypto.randomUUID()}
				>
					<p>{error}</p>
				</div>
			))}

			<div className="mt-10">
				<Form {...form}>
					<form
						className="space-y-8"
						method="post"
						onSubmit={form.handleSubmit(onSubmit)}
					>
						<FormField
							control={form.control}
							name="identifier"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email or Username</FormLabel>
									<FormControl>
										<Input
											placeholder="alan.turing@example.com or aturing"
											type="text"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Password</FormLabel>
									<FormControl>
										<div className="relative">
											<Input
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
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="flex items-center justify-end">
							<a
								className="font-semibold text-indigo-600 text-sm hover:text-indigo-500"
								href="/forgot-password"
							>
								Forgot password?
							</a>
						</div>
						<Button
							className="w-full bg-indigo-600 text-white hover:bg-indigo-500"
							disabled={loading}
							type="submit"
						>
							{loading ? "Logging in" : "Login"}
						</Button>
					</form>
				</Form>

				<div className="mt-10">
					<div className="relative">
						<div
							aria-hidden="true"
							className="absolute inset-0 flex items-center"
						>
							<div className="w-full border-gray-200 border-t" />
						</div>
						<div className="relative flex justify-center font-medium text-sm leading-6">
							<span className="bg-background px-6 text-foreground">
								Or continue with
							</span>
						</div>
					</div>

					<div className="mt-6 grid grid-cols-1 gap-4">
						<button
							className="flex w-full items-center justify-center gap-3 rounded-md bg-background px-3 py-2 font-semibold text-foreground text-sm shadow-sm ring-1 ring-gray-200 ring-inset hover:bg-foreground/10 focus-visible:ring-transparent dark:ring-slate-800"
							disabled={loadingProvider}
							onClick={() => handleProviderLogin("github")}
							type="button"
						>
							{loadingProvider ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<>
									<svg
										aria-hidden="true"
										className="h-5 w-5 fill-[#24292F] dark:fill-[#FFFFFF]"
										fill="currentColor"
										viewBox="0 0 20 20"
									>
										<path
											clipRule="evenodd"
											d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
											fillRule="evenodd"
										/>
									</svg>
									<span className="font-semibold text-sm leading-6">
										GitHub
									</span>
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default SignInForm;
