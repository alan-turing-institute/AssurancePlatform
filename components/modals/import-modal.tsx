"use client";

import { Cloud, Github, Upload } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useImportModal } from "@/hooks/use-import-modal";
import { FileImportTab } from "./_import-modal/file-import-tab";
import { GitHubImportTab } from "./_import-modal/github-import-tab";
import { GoogleDriveImportTab } from "./_import-modal/google-drive-import-tab";
import { useCaseImport } from "./_import-modal/use-case-import";

type TabValue = "file" | "github" | "gdrive";

export const ImportModal = () => {
	const importModal = useImportModal();
	const [activeTab, setActiveTab] = useState<TabValue>("file");

	const {
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
	} = useCaseImport({
		isOpen: importModal.isOpen,
		onClose: importModal.onClose,
	});

	const handleModalClose = () => {
		setError("");
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
				<div className="pb-2 font-semibold text-destructive text-sm">{error}</div>
			)}
			{warnings.length > 0 && (
				<div className="mb-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-warning-foreground text-sm">
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
					<FileImportTab
						importCase={importCase}
						loading={loading}
						setError={setError}
					/>
				</TabsContent>

				<TabsContent className="mt-4" value="github">
					<GitHubImportTab
						githubConnected={githubConnected}
						importFromGitHub={importFromGitHub}
						loading={loading}
					/>
				</TabsContent>

				<TabsContent className="mt-4" value="gdrive">
					<GoogleDriveImportTab
						googleConnected={googleConnected}
						importFromGoogleDrive={importFromGoogleDrive}
						loading={loading}
						selectedDriveFile={selectedDriveFile}
						setSelectedDriveFile={setSelectedDriveFile}
					/>
				</TabsContent>
			</Tabs>
		</Modal>
	);
};
