"use client";

import { FileIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type DriveFile = {
	id: string;
	name: string;
	modifiedTime: string;
	size?: string;
};

type DrivePickerProps = {
	onFileSelect: (fileId: string, fileName: string) => void;
	disabled?: boolean;
};

type DriveState = {
	files: DriveFile[];
	loading: boolean;
};

/**
 * Component to display and select files from Google Drive backup folder.
 */
export function DrivePicker({ onFileSelect, disabled }: DrivePickerProps) {
	const [state, setState] = useState<DriveState>({ files: [], loading: true });
	const [selectedFile, setSelectedFile] = useState<string | null>(null);

	useEffect(() => {
		import("@/actions/integrations")
			.then(({ fetchGoogleDriveFiles }) => fetchGoogleDriveFiles())
			.then((result) => {
				setState({ files: result.files ?? [], loading: false });
			})
			.catch(() => setState({ files: [], loading: false }));
	}, []);

	const handleSelect = (file: DriveFile) => {
		setSelectedFile(file.id);
		onFileSelect(file.id, file.name);
	};

	if (state.loading) {
		return (
			<div className="flex items-center justify-center py-8">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (state.files.length === 0) {
		return (
			<div className="py-8 text-center text-muted-foreground">
				<p>No backup files found in your Google Drive.</p>
				<p className="text-sm">Back up a case first to see it here.</p>
			</div>
		);
	}

	return (
		<div className="max-h-64 space-y-2 overflow-y-auto">
			{state.files.map((file) => (
				<button
					className={cn(
						"flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors",
						selectedFile === file.id
							? "border-primary bg-primary/5"
							: "border-border hover:bg-muted"
					)}
					disabled={disabled}
					key={file.id}
					onClick={() => handleSelect(file)}
					type="button"
				>
					<FileIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
					<div className="min-w-0 flex-1">
						<p className="truncate font-medium text-sm">{file.name}</p>
						<p className="text-muted-foreground text-xs">
							{new Date(file.modifiedTime).toLocaleDateString()}
						</p>
					</div>
				</button>
			))}
		</div>
	);
}
