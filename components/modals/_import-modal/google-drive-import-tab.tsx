"use client";

import { signIn } from "next-auth/react";
import { DrivePicker } from "@/components/google/drive-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConnectionLoadingState } from "./github-import-tab";

type DriveFile = {
	id: string;
	name: string;
};

export type GoogleDriveImportTabProps = {
	importFromGoogleDrive: (fileId: string) => Promise<void>;
	loading: boolean;
	googleConnected: boolean | null;
	selectedDriveFile: DriveFile | null;
	setSelectedDriveFile: (file: DriveFile | null) => void;
	className?: string;
};

/**
 * Google icon SVG component.
 */
export function GoogleIcon({ className }: { className?: string }) {
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
 * Renders the Google Drive connection prompt when not connected.
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
 * Google Drive picker tab content for the import modal.
 * Shows a connection prompt when not connected, or the file picker when connected.
 */
export function GoogleDriveImportTab({
	importFromGoogleDrive,
	loading,
	googleConnected,
	selectedDriveFile,
	setSelectedDriveFile,
	className,
}: GoogleDriveImportTabProps) {
	const handleDriveImport = () => {
		if (selectedDriveFile) {
			importFromGoogleDrive(selectedDriveFile.id);
		}
	};

	return (
		<div className={cn(className)}>
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
		</div>
	);
}
