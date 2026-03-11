import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

// ─── Constants ────────────────────────────────────────────────────────────────

export const ACCEPTED_FILE_TYPES = ["application/json"];

// Top-level regex patterns for GitHub URL validation.
// Shorthand: owner/repo/path (no spaces in owner/repo, must end with .json)
const GITHUB_SHORTHAND_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/.+\.json$/;
// Full GitHub blob URL
const GITHUB_BLOB_URL_REGEX =
	/^https?:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\/.+$/;
// Raw GitHub URL (simple or refs/heads format)
const GITHUB_RAW_URL_REGEX =
	/^https?:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/.+$/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates if a string is a valid GitHub URL or shorthand path.
 */
export function isValidGitHubUrl(url: string): boolean {
	const trimmed = url.trim();
	return (
		GITHUB_BLOB_URL_REGEX.test(trimmed) ||
		GITHUB_RAW_URL_REGEX.test(trimmed) ||
		GITHUB_SHORTHAND_REGEX.test(trimmed)
	);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportResponse = {
	id?: string | number;
	name?: string;
	elementCount?: number;
	warnings?: string[];
	error?: string;
	validationErrors?: Array<{ path: string; message: string } | string>;
	code?: string;
	message?: string;
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const fileFormSchema = z.object({
	file: z.any().refine((files) => {
		if (!files) {
			return "Please select a file.";
		}
		if (!(files instanceof FileList)) {
			return "Expected a file.";
		}
		const filesArray = Array.from(files);
		if (
			!filesArray.every((file) =>
				ACCEPTED_FILE_TYPES.includes((file as File).type)
			)
		) {
			return "Only JSON files are allowed.";
		}
		return true;
	}),
});

export const githubFormSchema = z.object({
	url: z.string().min(1, "GitHub URL is required").refine(isValidGitHubUrl, {
		message:
			"Invalid format. Use a GitHub URL (github.com/owner/repo/blob/...) or shorthand (owner/repo/file.json)",
	}),
});

export type FileFormInput = z.infer<typeof fileFormSchema>;
export type GitHubFormInput = z.infer<typeof githubFormSchema>;

// ─── Error extraction ─────────────────────────────────────────────────────────

/**
 * Extracts an error message from an import response.
 */
export function extractErrorMessage(data: ImportResponse): string {
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

// ─── Hook ─────────────────────────────────────────────────────────────────────

type DriveFile = {
	id: string;
	name: string;
};

type UseCaseImportParams = {
	isOpen: boolean;
	onClose: () => void;
};

export type UseCaseImportReturn = {
	loading: boolean;
	error: string;
	warnings: string[];
	setError: (error: string) => void;
	githubConnected: boolean | null;
	googleConnected: boolean | null;
	selectedDriveFile: DriveFile | null;
	setSelectedDriveFile: (file: DriveFile | null) => void;
	importCase: (json: unknown) => Promise<void>;
	importFromGitHub: (url: string) => Promise<void>;
	importFromGoogleDrive: (fileId: string) => Promise<void>;
};

/**
 * Centralises all import logic for the ImportModal.
 * Manages loading state, error/warning state, connection checks,
 * and the three import strategies (file, GitHub, Google Drive).
 */
export function useCaseImport({
	isOpen,
	onClose,
}: UseCaseImportParams): UseCaseImportReturn {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string>("");
	const [warnings, setWarnings] = useState<string[]>([]);
	const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
	const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
	const [selectedDriveFile, setSelectedDriveFile] = useState<DriveFile | null>(
		null
	);

	const router = useRouter();

	// Check GitHub connection status when modal opens.
	useEffect(() => {
		if (isOpen && githubConnected === null) {
			import("@/actions/integrations")
				.then(({ checkGitHubAccess }) => checkGitHubAccess())
				.then((result) => setGithubConnected(result.connected))
				.catch(() => setGithubConnected(false));
		}
	}, [isOpen, githubConnected]);

	// Check Google connection status when modal opens.
	useEffect(() => {
		if (isOpen && googleConnected === null) {
			import("@/actions/integrations")
				.then(({ checkGoogleDriveAccess }) => checkGoogleDriveAccess())
				.then((result) => setGoogleConnected(result.connected))
				.catch(() => setGoogleConnected(false));
		}
	}, [isOpen, googleConnected]);

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
					onClose();
					router.push(`/case/${data.id}`);
				}
			} catch {
				setError("An error occurred, please try again later");
			} finally {
				setLoading(false);
			}
		},
		[onClose, router]
	);

	/**
	 * Import from a GitHub repository.
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
					onClose();
					router.push(`/case/${data.id}`);
				}
			} catch {
				setError("An error occurred, please try again later");
			} finally {
				setLoading(false);
			}
		},
		[onClose, router]
	);

	/**
	 * Import from Google Drive.
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
					onClose();
					router.push(`/case/${data.id}`);
				}
			} catch {
				setError("An error occurred, please try again later");
			} finally {
				setLoading(false);
			}
		},
		[onClose, router]
	);

	return {
		loading,
		error,
		warnings,
		setError,
		githubConnected,
		googleConnected,
		selectedDriveFile,
		setSelectedDriveFile,
		importCase,
		importFromGitHub,
		importFromGoogleDrive,
	};
}
