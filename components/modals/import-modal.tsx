"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Github, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useImportModal } from "@/hooks/use-import-modal";

const ACCEPTED_FILE_TYPES = ["application/json"];

// Top-level regex patterns for GitHub URL validation
// Shorthand: owner/repo/path (no spaces in owner/repo, must end with .json)
const GITHUB_SHORTHAND_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/.+\.json$/;
// Full GitHub blob URL
const GITHUB_BLOB_URL_REGEX =
	/^https?:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\/.+$/;
// Raw GitHub URL (simple or refs/heads format)
const GITHUB_RAW_URL_REGEX =
	/^https?:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/.+$/;

/**
 * Validates if a string is a valid GitHub URL or shorthand path
 */
function isValidGitHubUrl(url: string): boolean {
	const trimmed = url.trim();
	return (
		GITHUB_BLOB_URL_REGEX.test(trimmed) ||
		GITHUB_RAW_URL_REGEX.test(trimmed) ||
		GITHUB_SHORTHAND_REGEX.test(trimmed)
	);
}

const fileFormSchema = z.object({
	file: z.any().refine((files) => {
		if (!files) {
			return "Please select a file.";
		}
		if (!(files instanceof FileList)) {
			return "Expected a file.";
		}
		const filesArray = Array.from(files);
		if (!filesArray.every((file) => ACCEPTED_FILE_TYPES.includes(file.type))) {
			return "Only JSON files are allowed.";
		}
		return true;
	}),
});

const githubFormSchema = z.object({
	url: z.string().min(1, "GitHub URL is required").refine(isValidGitHubUrl, {
		message:
			"Invalid format. Use a GitHub URL (github.com/owner/repo/blob/...) or shorthand (owner/repo/file.json)",
	}),
});

type ImportResponse = {
	id?: string | number;
	name?: string;
	elementCount?: number;
	warnings?: string[];
	error?: string;
	validationErrors?: Array<{ path: string; message: string } | string>;
	code?: string;
	message?: string;
};

/**
 * Extracts error message from import response
 */
function extractErrorMessage(data: ImportResponse): string {
	if (data.code === "NO_TOKEN") {
		return (
			data.message ?? "Please sign in with GitHub to import from repositories."
		);
	}
	if (data.validationErrors && data.validationErrors.length > 0) {
		const errors = data.validationErrors.map((e) =>
			typeof e === "string" ? e : `${e.path}: ${e.message}`
		);
		return `Validation failed: ${errors.join(", ")}`;
	}
	return data.message ?? data.error ?? "Failed to import";
}

/**
 * Renders the GitHub connection prompt when not connected
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
 * Renders the loading state while checking GitHub connection
 */
function GitHubLoadingState() {
	return (
		<div className="flex justify-center py-4">
			<p className="text-muted-foreground text-sm">
				Checking GitHub connection...
			</p>
		</div>
	);
}

export const ImportModal = () => {
	const importModal = useImportModal();

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string>("");
	const [warnings, setWarnings] = useState<string[]>([]);
	const [activeTab, setActiveTab] = useState<"file" | "github">("file");
	const [githubConnected, setGithubConnected] = useState<boolean | null>(null);

	const router = useRouter();

	const fileForm = useForm({
		resolver: zodResolver(fileFormSchema),
	});

	const githubForm = useForm({
		resolver: zodResolver(githubFormSchema),
		defaultValues: { url: "" },
	});

	// Check GitHub connection status when modal opens
	useEffect(() => {
		if (importModal.isOpen && githubConnected === null) {
			fetch("/api/cases/import/github")
				.then((res) => res.json())
				.then((data) => setGithubConnected(data.connected ?? false))
				.catch(() => setGithubConnected(false));
		}
	}, [importModal.isOpen, githubConnected]);

	/**
	 * Import using Prisma-based API (v1 and v2 format support).
	 */
	const importCase = useCallback(
		async (json: unknown) => {
			setLoading(true);
			setError("");
			setWarnings([]);

			try {
				const response = await fetch("/api/cases/import", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(json),
				});

				const data: ImportResponse = await response.json();

				if (!response.ok) {
					setError(extractErrorMessage(data));
					setLoading(false);
					return;
				}

				if (data.warnings && data.warnings.length > 0) {
					setWarnings(data.warnings);
				}

				if (data.id) {
					importModal.onClose();
					router.push(`/case/${data.id}`);
				}
			} catch {
				setError("An error occurred, please try again later");
			} finally {
				setLoading(false);
			}
		},
		[importModal, router]
	);

	/**
	 * Import from GitHub repository
	 */
	const importFromGitHub = useCallback(
		async (url: string) => {
			setLoading(true);
			setError("");
			setWarnings([]);

			try {
				const response = await fetch("/api/cases/import/github", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ url }),
				});

				const data: ImportResponse = await response.json();

				if (!response.ok) {
					setError(extractErrorMessage(data));
					setLoading(false);
					return;
				}

				if (data.warnings && data.warnings.length > 0) {
					setWarnings(data.warnings);
				}

				if (data.id) {
					importModal.onClose();
					router.push(`/case/${data.id}`);
				}
			} catch {
				setError("An error occurred, please try again later");
			} finally {
				setLoading(false);
			}
		},
		[importModal, router]
	);

	const onFileSubmit = (values: z.infer<typeof fileFormSchema>) => {
		const { file } = values;

		try {
			if (file) {
				const fileReader = new FileReader();

				fileReader.onload = async (event: ProgressEvent<FileReader>) => {
					try {
						const json = JSON.parse(event.target?.result as string);
						await importCase(json);
					} catch (_error) {
						setError("Error parsing JSON file, bad format.");
					}
				};

				fileReader.readAsText(file);
			}
		} catch (_error) {
			setError("Error reading file");
		}
	};

	const onGitHubSubmit = (values: z.infer<typeof githubFormSchema>) => {
		importFromGitHub(values.url);
	};

	const handleModalClose = () => {
		setError("");
		setWarnings([]);
		importModal.onClose();
	};

	return (
		<Modal
			description="Import an assurance case from a file or GitHub repository."
			isOpen={importModal.isOpen}
			onClose={handleModalClose}
			title="Import Case"
		>
			{error && (
				<div className="pb-2 font-semibold text-rose-500 text-sm">{error}</div>
			)}
			{warnings.length > 0 && (
				<div className="mb-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-800 text-sm">
					<p className="font-semibold">Import warnings:</p>
					<ul className="list-inside list-disc">
						{warnings.map((w) => (
							<li key={w}>{w}</li>
						))}
					</ul>
				</div>
			)}

			<Tabs
				className="w-full"
				onValueChange={(v) => setActiveTab(v as "file" | "github")}
				value={activeTab}
			>
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger className="flex items-center gap-2" value="file">
						<Upload className="h-4 w-4" />
						File
					</TabsTrigger>
					<TabsTrigger className="flex items-center gap-2" value="github">
						<Github className="h-4 w-4" />
						GitHub
					</TabsTrigger>
				</TabsList>

				<TabsContent className="mt-4" value="file">
					<Form {...fileForm}>
						<form
							className="w-full space-y-6"
							onSubmit={fileForm.handleSubmit(onFileSubmit)}
						>
							<FormField
								control={fileForm.control}
								name="file"
								render={({
									field: { onChange, value: _value, ...fieldProps },
								}) => (
									<FormItem>
										<FormLabel>JSON File</FormLabel>
										<FormControl>
											<Input
												{...fieldProps}
												accept=".json,application/json"
												disabled={loading}
												onChange={(event) => onChange(event.target.files?.[0])}
												type="file"
											/>
										</FormControl>
										<FormDescription>
											Upload a JSON file exported from this platform or
											compatible tools.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button disabled={loading} type="submit">
								{loading ? "Importing..." : "Import File"}
							</Button>
						</form>
					</Form>
				</TabsContent>

				<TabsContent className="mt-4" value="github">
					{githubConnected === null && <GitHubLoadingState />}
					{githubConnected === false && <GitHubConnectPrompt />}
					{githubConnected === true && (
						<Form {...githubForm}>
							<form
								className="w-full space-y-6"
								onSubmit={githubForm.handleSubmit(onGitHubSubmit)}
							>
								<FormField
									control={githubForm.control}
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
				</TabsContent>
			</Tabs>
		</Modal>
	);
};
