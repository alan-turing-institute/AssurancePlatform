"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Cloud, Github, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DrivePicker } from "@/components/google/drive-picker";
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
		return data.message ?? "Please sign in to import from this source.";
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
 * Renders the Google Drive connection prompt when not connected
 */
function GoogleConnectPrompt() {
	return (
		<div className="space-y-4 text-center">
			<p className="text-muted-foreground text-sm">
				Connect your Google account to import cases from Google Drive.
			</p>
			<Button onClick={() => signIn("google")} variant="outline">
				<GoogleIcon className="mr-2 h-4 w-4" />
				Sign in with Google
			</Button>
		</div>
	);
}

/**
 * Google icon SVG component
 */
function GoogleIcon({ className }: { className?: string }) {
	return (
		<svg aria-hidden="true" className={className} viewBox="0 0 24 24">
			<path
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
				fill="#4285F4"
			/>
			<path
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				fill="#34A853"
			/>
			<path
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
				fill="#FBBC05"
			/>
			<path
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				fill="#EA4335"
			/>
		</svg>
	);
}

/**
 * Renders the loading state while checking connection
 */
function ConnectionLoadingState({ provider }: { provider: string }) {
	return (
		<div className="flex justify-center py-4">
			<p className="text-muted-foreground text-sm">
				Checking {provider} connection...
			</p>
		</div>
	);
}

type TabValue = "file" | "github" | "gdrive";

export const ImportModal = () => {
	const importModal = useImportModal();

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string>("");
	const [warnings, setWarnings] = useState<string[]>([]);
	const [activeTab, setActiveTab] = useState<TabValue>("file");
	const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
	const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
	const [selectedDriveFile, setSelectedDriveFile] = useState<{
		id: string;
		name: string;
	} | null>(null);

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

	// Check Google connection status when modal opens
	useEffect(() => {
		if (importModal.isOpen && googleConnected === null) {
			fetch("/api/cases/import/gdrive")
				.then((res) => res.json())
				.then((data) => setGoogleConnected(data.connected ?? false))
				.catch(() => setGoogleConnected(false));
		}
	}, [importModal.isOpen, googleConnected]);

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

	/**
	 * Import from Google Drive
	 */
	const importFromGoogleDrive = useCallback(
		async (fileId: string) => {
			setLoading(true);
			setError("");
			setWarnings([]);

			try {
				const response = await fetch("/api/cases/import/gdrive", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ fileId }),
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

	const handleDriveImport = () => {
		if (selectedDriveFile) {
			importFromGoogleDrive(selectedDriveFile.id);
		}
	};

	const handleModalClose = () => {
		setError("");
		setWarnings([]);
		setSelectedDriveFile(null);
		importModal.onClose();
	};

	return (
		<Modal
			description="Import an assurance case from a file, GitHub, or Google Drive."
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
				onValueChange={(v) => setActiveTab(v as TabValue)}
				value={activeTab}
			>
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger className="flex items-center gap-2" value="file">
						<Upload className="h-4 w-4" />
						File
					</TabsTrigger>
					<TabsTrigger className="flex items-center gap-2" value="github">
						<Github className="h-4 w-4" />
						GitHub
					</TabsTrigger>
					<TabsTrigger className="flex items-center gap-2" value="gdrive">
						<Cloud className="h-4 w-4" />
						Drive
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
					{githubConnected === null && (
						<ConnectionLoadingState provider="GitHub" />
					)}
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

				<TabsContent className="mt-4" value="gdrive">
					{googleConnected === null && (
						<ConnectionLoadingState provider="Google Drive" />
					)}
					{googleConnected === false && <GoogleConnectPrompt />}
					{googleConnected === true && (
						<div className="space-y-4">
							<p className="text-muted-foreground text-sm">
								Select a backup file from your TEA Platform Backups folder.
							</p>
							<DrivePicker
								disabled={loading}
								onFileSelect={(id, name) => setSelectedDriveFile({ id, name })}
							/>
							<Button
								disabled={loading || !selectedDriveFile}
								onClick={handleDriveImport}
							>
								{loading ? "Importing..." : "Import from Google Drive"}
							</Button>
						</div>
					)}
				</TabsContent>
			</Tabs>
		</Modal>
	);
};
