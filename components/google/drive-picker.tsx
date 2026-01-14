"use client";

import { FileIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

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

/**
 * Component to display and select files from Google Drive backup folder.
 */
export function DrivePicker({ onFileSelect, disabled }: DrivePickerProps) {
	const [files, setFiles] = useState<DriveFile[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedFile, setSelectedFile] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/cases/import/gdrive")
			.then((res) => res.json())
			.then((data) => {
				setFiles(data.files ?? []);
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, []);

	const handleSelect = (file: DriveFile) => {
		setSelectedFile(file.id);
		onFileSelect(file.id, file.name);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-8">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (files.length === 0) {
		return (
			<div className="py-8 text-center text-muted-foreground">
				<p>No backup files found in your Google Drive.</p>
				<p className="text-sm">Back up a case first to see it here.</p>
			</div>
		);
	}

	return (
		<div className="max-h-64 space-y-2 overflow-y-auto">
			{files.map((file) => (
				<button
					className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors ${
						selectedFile === file.id
							? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
							: "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
					}`}
					disabled={disabled}
					key={file.id}
					onClick={() => handleSelect(file)}
					type="button"
				>
					<FileIcon className="h-5 w-5 flex-shrink-0 text-gray-400" />
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
