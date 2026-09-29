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

export interface ImportResponse {
	code?: string;
	elementCount?: number;
	error?: string;
	id?: string | number;
	message?: string;
	name?: string;
	validationErrors?: Array<{ path: string; message: string } | string>;
	warnings?: string[];
}

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

interface DriveFile {
	id: string;
	name: string;
}

interface UseCaseImportParams {
	isOpen: boolean;
	onClose: () => void;
}

export interface UseCaseImportReturn {
	/** Navigates to the case a warnings-carrying import produced, once the
	 * user has seen the warnings banner and chosen to continue. */
	continueToCase: () => void;
	error: string;
	githubConnected: boolean | null;
	googleConnected: boolean | null;
	importCase: (json: unknown) => Promise<void>;
	importFromGitHub: (url: string) => Promise<void>;
	importFromGoogleDrive: (fileId: string) => Promise<void>;
	loading: boolean;
	/** Set once a successful import also carried warnings — the modal stays
	 * open (rather than navigating straight away) so the warnings are
	 * actually seen; non-null means "ready to continue to this case". */
	pendingCaseId: string | number | null;
	selectedDriveFile: DriveFile | null;
	setError: (error: string) => void;
	setSelectedDriveFile: (file: DriveFile | null) => void;
	warnings: string[];
}

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
	const [pendingCaseId, setPendingCaseId] = useState<string | number | null>(
		null
	);
	const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
	const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
	const [selectedDriveFile, setSelectedDriveFile] = useState<DriveFile | null>(
		null
	);

	const router = useRouter();

	/**
	 * Shared by all three import strategies below: decides whether to
	 * navigate straight to the new case or keep the modal open first.
	 * Closing and navigating in the same tick as setting `warnings` (the
	 * old behaviour) meant the "Import warnings" banner never rendered —
	 * `setWarnings` and `onClose`/`router.push` landed in the same commit,
	 * so the component never painted the intermediate state (QA finding,
	 * 2026-09-15). A warnings-carrying success now waits for
	 * `continueToCase` instead.
	 */
	const applyImportResult = useCallback(
		(data: ImportResponse) => {
			const hasWarnings = !!(data.warnings && data.warnings.length > 0);
			if (hasWarnings) {
				setWarnings(data.warnings ?? []);
			}
			if (!data.id) {
				return;
			}
			if (hasWarnings) {
				setPendingCaseId(data.id);
				return;
			}
			onClose();
			router.push(`/case/${data.id}`);
		},
		[onClose, router]
	);

	const continueToCase = useCallback(() => {
		if (pendingCaseId === null) {
			return;
		}
		onClose();
		router.push(`/case/${pendingCaseId}`);
		setPendingCaseId(null);
		setWarnings([]);
	}, [pendingCaseId, onClose, router]);

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
			setPendingCaseId(null);

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

				applyImportResult(data);
			} catch {
				setError("An error occurred, please try again later");
			} finally {
				setLoading(false);
			}
		},
		[applyImportResult]
	);

	/**
	 * Import from a GitHub repository.
	 */
	const importFromGitHub = useCallback(
		async (url: string) => {
			setLoading(true);
			setError("");
			setWarnings([]);
			setPendingCaseId(null);

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

				applyImportResult(data);
			} catch {
				setError("An error occurred, please try again later");
			} finally {
				setLoading(false);
			}
		},
		[applyImportResult]
	);

	/**
	 * Import from Google Drive.
	 */
	const importFromGoogleDrive = useCallback(
		async (fileId: string) => {
			setLoading(true);
			setError("");
			setWarnings([]);
			setPendingCaseId(null);

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

				applyImportResult(data);
			} catch {
				setError("An error occurred, please try again later");
			} finally {
				setLoading(false);
			}
		},
		[applyImportResult]
	);

	return {
		loading,
		error,
		warnings,
		pendingCaseId,
		continueToCase,
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
