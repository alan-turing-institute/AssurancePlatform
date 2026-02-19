"use client";

import { Cloud, Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import type { toast as ToastFn } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { AssuranceCase } from "@/types";
import { Button } from "../../ui/button";

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

type ExportModal = {
	isOpen: boolean;
};

export type GoogleBackupSectionProps = {
	assuranceCase: AssuranceCase | null;
	exportModal: ExportModal;
	toast: typeof ToastFn;
	className?: string;
};

export function GoogleBackupSection({
	assuranceCase,
	exportModal,
	toast,
	className,
}: GoogleBackupSectionProps) {
	const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
	const [backupLoading, setBackupLoading] = useState(false);

	// Check Google connection status when modal opens
	useEffect(() => {
		if (exportModal.isOpen && googleConnected === null) {
			import("@/actions/integrations")
				.then(({ checkGoogleDriveAccess }) => checkGoogleDriveAccess())
				.then((result) => setGoogleConnected(result.connected))
				.catch(() => setGoogleConnected(false));
		}
	}, [exportModal.isOpen, googleConnected]);

	const handleBackupToDrive = async () => {
		if (!assuranceCase?.id) {
			return;
		}

		setBackupLoading(true);

		try {
			const response = await fetch("/api/cases/backup/gdrive", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					caseId: assuranceCase.id,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				toast({
					variant: "destructive",
					title: "Backup failed",
					description:
						data.message || data.error || "Unable to backup to Google Drive",
				});
				return;
			}

			toast({
				variant: "success",
				title: "Backup successful",
				description: `Saved as ${data.fileName} to Google Drive`,
			});
		} catch {
			toast({
				variant: "destructive",
				title: "Backup failed",
				description: "An error occurred while backing up to Google Drive",
			});
		} finally {
			setBackupLoading(false);
		}
	};

	return (
		<div className={cn("my-4", className)}>
			{googleConnected === null && (
				<p className="text-muted-foreground text-sm">
					Checking Google connection...
				</p>
			)}
			{googleConnected === false && (
				<div className="space-y-2">
					<p className="text-muted-foreground text-sm">
						Connect your Google account to backup cases to Google Drive.
					</p>
					<Button onClick={() => signIn("google")} variant="outline">
						<GoogleIcon className="mr-2 h-4 w-4" />
						Sign in with Google
					</Button>
				</div>
			)}
			{googleConnected === true && (
				<div className="space-y-2">
					<p className="text-muted-foreground text-sm">
						Save this case to your TEA Platform Backups folder in Google Drive.
					</p>
					<Button
						disabled={backupLoading}
						onClick={handleBackupToDrive}
						variant="outline"
					>
						{backupLoading ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Cloud className="mr-2 h-4 w-4" />
						)}
						{backupLoading ? "Backing up..." : "Backup to Google Drive"}
					</Button>
				</div>
			)}
		</div>
	);
}
