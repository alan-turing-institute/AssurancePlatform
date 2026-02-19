"use client";

import { Cloud, FileIcon, FileText, ImageIcon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import useStore from "@/data/store";
import { useExportModal } from "@/hooks/use-export-modal";
import { toast } from "@/lib/toast";
import { Separator } from "../ui/separator";
import { DocumentExportSection } from "./_share-modal/document-export-section";
import { GoogleBackupSection } from "./_share-modal/google-backup-section";
import { ImageExportSection } from "./_share-modal/image-export-section";
import { JsonExportSection } from "./_share-modal/json-export-section";

export const ShareModal = () => {
	const { assuranceCase, nodes } = useStore();
	const exportModal = useExportModal();

	return (
		<Modal
			description="Download your assurance case in various formats."
			isOpen={exportModal.isOpen}
			onClose={exportModal.onClose}
			title="Export Case"
		>
			<h2 className="mb-2 flex items-center justify-start gap-2">
				<FileIcon className="h-4 w-4" />
				Export Raw JSON
			</h2>
			<JsonExportSection assuranceCase={assuranceCase} toast={toast} />
			<Separator />
			<h2 className="mb-2 flex items-center justify-start gap-2">
				<ImageIcon className="h-4 w-4" />
				Export as Image
			</h2>
			<ImageExportSection
				assuranceCase={assuranceCase}
				nodes={nodes}
				toast={toast}
			/>
			<Separator />
			<h2 className="mb-2 flex items-center justify-start gap-2">
				<FileText className="h-4 w-4" />
				Export Report
			</h2>
			<DocumentExportSection
				assuranceCase={assuranceCase}
				nodes={nodes}
				toast={toast}
			/>
			<Separator />
			<h2 className="mb-2 flex items-center justify-start gap-2">
				<Cloud className="h-4 w-4" />
				Backup to Google Drive
			</h2>
			<GoogleBackupSection
				assuranceCase={assuranceCase}
				exportModal={exportModal}
				toast={toast}
			/>
		</Modal>
	);
};
