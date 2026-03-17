"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Github } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { type GitHubFormInput, githubFormSchema } from "./use-case-import";

export interface GitHubImportTabProps {
	className?: string;
	githubConnected: boolean | null;
	importFromGitHub: (url: string) => Promise<void>;
	loading: boolean;
}

/**
 * Renders the loading state while checking a provider's connection.
 */
export function ConnectionLoadingState({ provider }: { provider: string }) {
	return (
		<div className="flex justify-center py-4">
			<p className="text-muted-foreground text-sm">
				Checking {provider} connection...
			</p>
		</div>
	);
}

/**
 * Renders the GitHub connection prompt when not connected.
 */
function GitHubConnectPrompt() {
	return (
		<div className="space-y-4 text-center">
			<p className="text-muted-foreground text-sm">
				Connect your GitHub account to import cases from repositories.
			</p>
			<Button
				onClick={() => {
					window.location.href = "/api/auth/signin?callbackUrl=/dashboard";
				}}
				variant="outline"
			>
				<Github className="mr-2 h-4 w-4" />
				Sign in with GitHub
			</Button>
		</div>
	);
}

/**
 * GitHub URL form tab content for the import modal.
 * Shows a connection prompt when not connected, or the URL form when connected.
 */
export function GitHubImportTab({
	importFromGitHub,
	loading,
	githubConnected,
	className,
}: GitHubImportTabProps) {
	const form = useForm<GitHubFormInput>({
		resolver: zodResolver(githubFormSchema),
		defaultValues: { url: "" },
	});

	const onSubmit = (values: GitHubFormInput) => {
		importFromGitHub(values.url);
	};

	return (
		<div className={cn(className)}>
			{githubConnected === null && <ConnectionLoadingState provider="GitHub" />}
			{githubConnected === false && <GitHubConnectPrompt />}
			{githubConnected === true && (
				<Form {...form}>
					<form
						className="w-full space-y-6"
						onSubmit={form.handleSubmit(onSubmit)}
					>
						<FormField
							control={form.control}
							name="url"
							render={({ field }) => (
								<FormItem>
									<FormLabel>GitHub URL</FormLabel>
									<FormControl>
										<Input
											{...field}
											disabled={loading}
											placeholder="https://github.com/owner/repo/blob/main/case.json"
										/>
									</FormControl>
									<FormDescription>
										Paste a GitHub URL to a JSON file, or use the shorthand
										format: owner/repo/path/to/file.json
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button disabled={loading} type="submit">
							{loading ? "Importing..." : "Import from GitHub"}
						</Button>
					</form>
				</Form>
			)}
		</div>
	);
}
