"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
	username: z
		.string()
		.min(2)
		.max(250)
		.regex(/^\S*$/, "Username cannot contain spaces"),
	email: z.string().min(2).email(),
	password1: z
		.string()
		.min(8)
		.regex(
			/(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/,
			"Password must contain at least one uppercase letter, one number, and one special character"
		),
	password2: z
		.string()
		.min(8)
		.regex(
			/(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/,
			"Password must contain at least one uppercase letter, one number, and one special character"
		),
});

const RegisterForm = () => {
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<string[]>([]);
	const [showPassword1, setShowPassword1] = useState(false);
	const [showPassword2, setShowPassword2] = useState(false);
	const { data: session } = useSession();

	const router = useRouter();

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			username: "",
			email: "",
			password1: "",
			password2: "",
		},
	});

	function validatePasswords(values: z.infer<typeof formSchema>) {
		if (values.password1 !== values.password2) {
			setErrors(["Your passwords must match, please try again."]);
			return false;
		}
		return true;
	}

	function extractValidationErrors(result: Record<string, string[]>) {
		const currentErrors: string[] = [];

		if (result.username) {
			currentErrors.push(...result.username);
		}
		if (result.email) {
			currentErrors.push(...result.email);
		}
		if (result.password1) {
			currentErrors.push(...result.password1);
		}
		if (result.password2) {
			currentErrors.push(...result.password2);
		}
		if (result.non_field_errors) {
			currentErrors.push(...result.non_field_errors);
		}

		return currentErrors.length > 0
			? currentErrors
			: ["Registration failed. Please try again."];
	}

	async function handleRegistrationError(response: Response) {
		setLoading(false);
		if (response.status === 400) {
			try {
				const result = await response.json();
				setErrors(extractValidationErrors(result));
			} catch (_jsonError) {
				setErrors(["Registration failed. Please try again."]);
			}
		} else {
			setErrors(["Registration failed. Please try again."]);
		}
	}

	function redirectToLoginWithSuccess() {
		// Redirect to login page with success message
		router.push("/login?registered=true");
	}

	function handleSuccessfulRegistration(
		_response: Response,
		_values: z.infer<typeof formSchema>
	) {
		// Registration successful - redirect to login
		setLoading(false);
		redirectToLoginWithSuccess();
	}

	function registerUser(values: z.infer<typeof formSchema>) {
		const user = {
			username: values.username,
			email: values.email,
			password1: values.password1,
			password2: values.password2,
		};

		const requestOptions: RequestInit = {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(user),
		};

		// Use Prisma API
		const apiUrl = "/api/users/register";

		return fetch(apiUrl, requestOptions);
	}

	async function onSubmit(values: z.infer<typeof formSchema>) {
		if (!validatePasswords(values)) {
			return;
		}

		setErrors([]);
		setLoading(true);

		try {
			const response = await registerUser(values);

			if (!response.ok) {
				await handleRegistrationError(response);
				return;
			}

			handleSuccessfulRegistration(response, values);
		} catch (_error) {
			setLoading(false);
			setErrors(["Registration failed. Please try again."]);
		}
	}

	useEffect(() => {
		const token = session?.key;
		if (token) {
			router.push("/dashboard");
		}
	}, [session?.key, router]);

	return (
		<div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
			<div className="bg-white px-6 py-12 shadow-sm sm:rounded-lg sm:px-12 dark:bg-slate-900">
				{errors?.map((error: string) => (
					<div
						className="mb-6 rounded-md border border-rose-700 bg-rose-500/20 px-4 py-2 text-rose-700"
						key={crypto.randomUUID()}
					>
						<p>{error}</p>
					</div>
				))}

				<Form {...form}>
					<form
						className="space-y-8"
						method="post"
						onSubmit={form.handleSubmit(onSubmit)}
					>
						<FormField
							control={form.control}
							name="username"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Username</FormLabel>
									<FormControl>
										<Input placeholder="Alan Turing" {...field} />
									</FormControl>
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
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="password1"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Password</FormLabel>
									<FormControl>
										<div className="relative">
											<Input
												type={showPassword1 ? "text" : "password"}
												{...field}
											/>
											<button
												aria-label={
													showPassword1 ? "Hide password" : "Show password"
												}
												className="-translate-y-1/2 absolute top-1/2 right-3 text-gray-500 hover:text-gray-700"
												onClick={() => setShowPassword1(!showPassword1)}
												type="button"
											>
												{showPassword1 ? (
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
						<FormField
							control={form.control}
							name="password2"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Confirm Password</FormLabel>
									<FormControl>
										<div className="relative">
											<Input
												type={showPassword2 ? "text" : "password"}
												{...field}
											/>
											<button
												aria-label={
													showPassword2 ? "Hide password" : "Show password"
												}
												className="-translate-y-1/2 absolute top-1/2 right-3 text-gray-500 hover:text-gray-700"
												onClick={() => setShowPassword2(!showPassword2)}
												type="button"
											>
												{showPassword2 ? (
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
							className="inline-flex w-full bg-indigo-600 text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={loading}
							type="submit"
						>
							{loading ? "Creating Account..." : "Submit"}
						</Button>
					</form>
				</Form>
			</div>

			<p className="mt-10 text-center text-foreground text-sm">
				Already a member?{" "}
				<a
					className="font-semibold text-indigo-600 leading-6 hover:text-indigo-500"
					href={"/login"}
				>
					Login here
				</a>
			</p>
		</div>
	);
};

export default RegisterForm;
