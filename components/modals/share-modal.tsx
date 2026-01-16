"use client";

import { saveAs } from "file-saver";
import {
	ChevronDown,
	Cloud,
	Download,
	FileIcon,
	FileText,
	ImageIcon,
	Loader2,
} from "lucide-react";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { getDocumentExportData } from "@/actions/export-document";
import { Modal } from "@/components/ui/modal";
import useStore from "@/data/store";
import { useExportModal } from "@/hooks/use-export-modal";
import { exportDocument } from "@/lib/case/document-export";
import { exportDiagramImage } from "@/lib/case/image-export";
import type { ExportFormat, TemplatePreset } from "@/lib/export";
import { useToast } from "@/lib/toast";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { Separator } from "../ui/separator";

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
 * Section labels for display in the customisation panel
 */
const SECTION_LABELS: Record<string, string> = {
	titlePage: "Title page",
	tableOfContents: "Table of contents",
	diagram: "Diagram",
	executiveSummary: "Executive summary",
	assuranceCaseStructure: "Assurance case structure",
	comments: "Comments",
	metadata: "Metadata",
};

type DocSections = {
	titlePage: boolean;
	tableOfContents: boolean;
	diagram: boolean;
	executiveSummary: boolean;
	assuranceCaseStructure: boolean;
	comments: boolean;
	metadata: boolean;
};

/**
 * Collapsible section customisation component
 */
function SectionCustomisation({
	sections,
	onToggle,
}: {
	sections: DocSections;
	onToggle: (key: keyof DocSections) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div className="rounded-md border border-muted">
			<button
				className="flex w-full items-center justify-between p-3 text-left text-sm hover:bg-muted/50"
				onClick={() => setIsOpen(!isOpen)}
				type="button"
			>
				<span>Customise sections</span>
				<ChevronDown
					className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>
			{isOpen && (
				<div className="space-y-2 border-t px-3 pt-2 pb-3">
					{Object.entries(SECTION_LABELS).map(([key, label]) => (
						<div className="flex items-center space-x-2" key={key}>
							<input
								checked={sections[key as keyof DocSections]}
								className="h-4 w-4 rounded border-gray-300"
								id={`section-${key}`}
								onChange={() => onToggle(key as keyof DocSections)}
								type="checkbox"
							/>
							<label className="text-sm" htmlFor={`section-${key}`}>
								{label}
							</label>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * Template description component
 */
function TemplateDescription({ template }: { template: TemplatePreset }) {
	const descriptions: Record<TemplatePreset, string> = {
		"full-report":
			"Comprehensive report with all case elements, comments, and diagram",
		summary: "Condensed overview with goals and key evidence only",
		"evidence-list":
			"Focused list of all evidence items with URLs and descriptions",
	};

	return (
		<p className="text-muted-foreground text-xs">{descriptions[template]}</p>
	);
}

export const ShareModal = () => {
	const { assuranceCase, nodes } = useStore();
	const exportModal = useExportModal();

	const [loading, setLoading] = useState(false);
	const [exportWithComments, setExportWithComments] = useState(true);

	// Google Drive backup state
	const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
	const [backupLoading, setBackupLoading] = useState(false);

	// Image export state
	const [imageFormat, setImageFormat] = useState<"svg" | "png">("png");
	const [imageScale, setImageScale] = useState<"1" | "2" | "3">("2");
	const [imageExportLoading, setImageExportLoading] = useState(false);

	// Document export state
	const [docFormat, setDocFormat] = useState<ExportFormat>("pdf");
	const [docTemplate, setDocTemplate] = useState<TemplatePreset>("full-report");
	const [docExportLoading, setDocExportLoading] = useState(false);
	const [docSections, setDocSections] = useState<DocSections>({
		titlePage: true,
		tableOfContents: true,
		diagram: true,
		executiveSummary: true,
		assuranceCaseStructure: true,
		comments: true,
		metadata: true,
	});

	const { toast } = useToast();

	// Check Google connection status when modal opens
	useEffect(() => {
		if (exportModal.isOpen && googleConnected === null) {
			fetch("/api/cases/backup/gdrive")
				.then((res) => res.json())
				.then((data) => setGoogleConnected(data.connected ?? false))
				.catch(() => setGoogleConnected(false));
		}
	}, [exportModal.isOpen, googleConnected]);

	const handleExport = async (includeComments = true) => {
		setLoading(true);

		if (assuranceCase?.id) {
			try {
				const params = new URLSearchParams({
					id: String(assuranceCase.id),
					includeComments: String(includeComments),
				});
				const response = await fetch(`/api/cases/export?${params}`);

				if (!response.ok) {
					toast({
						variant: "destructive",
						title: "Export failed",
						description: "Unable to export case",
					});
					setLoading(false);
					return;
				}

				// Get the blob and download
				const blob = await response.blob();
				const name = assuranceCase.name || "assurance-case";
				const now = new Date();
				const datestr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}T${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
				const filename = `${name}-${datestr}.json`;
				saveAs(blob, filename);
			} catch {
				toast({
					variant: "destructive",
					title: "Export failed",
					description: "An error occurred while exporting",
				});
			} finally {
				setLoading(false);
			}
		}
	};

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
					includeComments: exportWithComments,
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

	const handleImageExport = async () => {
		if (!assuranceCase?.name) {
			toast({
				variant: "destructive",
				title: "Export failed",
				description: "No assurance case loaded",
			});
			return;
		}

		setImageExportLoading(true);

		try {
			await exportDiagramImage({
				format: imageFormat,
				scale:
					imageFormat === "png" ? (Number(imageScale) as 1 | 2 | 3) : undefined,
				caseName: assuranceCase.name,
				nodes,
			});

			toast({
				variant: "success",
				title: "Export complete",
				description: `Diagram exported as ${imageFormat.toUpperCase()}`,
			});
		} catch (exportError) {
			toast({
				variant: "destructive",
				title: "Export failed",
				description:
					exportError instanceof Error
						? exportError.message
						: "An error occurred",
			});
		} finally {
			setImageExportLoading(false);
		}
	};

	const handleDocumentExport = async () => {
		if (!(assuranceCase?.id && assuranceCase?.name)) {
			toast({
				variant: "destructive",
				title: "Export failed",
				description: "No assurance case loaded",
			});
			return;
		}

		setDocExportLoading(true);

		try {
			// Fetch case data from server (include comments if comments section is enabled)
			const result = await getDocumentExportData(assuranceCase.id, {
				includeComments: docSections.comments,
			});

			if (!result.success) {
				toast({
					variant: "destructive",
					title: "Export failed",
					description: result.error,
				});
				return;
			}

			// Export document using client-side function with section overrides
			await exportDocument({
				caseData: result.data,
				caseName: assuranceCase.name,
				format: docFormat,
				template: docTemplate,
				includeDiagram: docSections.diagram,
				nodes,
				sectionOverrides: docSections,
			});

			const formatLabels: Record<ExportFormat, string> = {
				pdf: "PDF",
				markdown: "Markdown",
				docx: "Word",
			};
			toast({
				variant: "success",
				title: "Export complete",
				description: `Document exported as ${formatLabels[docFormat]}`,
			});
		} catch (exportError) {
			toast({
				variant: "destructive",
				title: "Export failed",
				description:
					exportError instanceof Error
						? exportError.message
						: "An error occurred",
			});
		} finally {
			setDocExportLoading(false);
		}
	};

	const handleSectionToggle = (key: keyof DocSections) => {
		setDocSections((prev) => ({
			...prev,
			[key]: !prev[key],
		}));
	};

	return (
		<Modal
			description="Download your assurance case in various formats."
			isOpen={exportModal.isOpen}
			onClose={exportModal.onClose}
			title="Export Case"
		>
			<div className="my-4">
				<h2 className="mb-2 flex items-center justify-start gap-2">
					<FileIcon className="h-4 w-4" />
					Export Raw JSON
				</h2>
				<p className="text-muted-foreground text-sm">
					Download a JSON file for backup or importing into another TEA Platform
					instance.
				</p>
				<div className="my-2 flex items-center space-x-2">
					<input
						checked={exportWithComments}
						className="h-4 w-4 rounded border-gray-300"
						id="export-comments"
						onChange={(e) => setExportWithComments(e.target.checked)}
						type="checkbox"
					/>
					<label className="text-sm" htmlFor="export-comments">
						Include comments
					</label>
				</div>
				<Button
					className="my-2"
					disabled={loading}
					onClick={() => handleExport(exportWithComments)}
				>
					<Download className="mr-2 h-4 w-4" />
					Download File
				</Button>
			</div>
			<Separator />
			<div className="my-4">
				<h2 className="mb-2 flex items-center justify-start gap-2">
					<ImageIcon className="h-4 w-4" />
					Export as Image
				</h2>
				<p className="text-muted-foreground text-sm">
					Download the diagram as an image file.
				</p>
				<div className="my-3 space-y-3">
					<div className="flex items-center gap-4">
						<Label className="text-sm">Format</Label>
						<RadioGroup
							className="flex items-center gap-4"
							onValueChange={(value) => setImageFormat(value as "svg" | "png")}
							value={imageFormat}
						>
							<div className="flex items-center space-x-2">
								<RadioGroupItem id="format-png" value="png" />
								<Label className="font-normal" htmlFor="format-png">
									PNG
								</Label>
							</div>
							<div className="flex items-center space-x-2">
								<RadioGroupItem id="format-svg" value="svg" />
								<Label className="font-normal" htmlFor="format-svg">
									SVG
								</Label>
							</div>
						</RadioGroup>
					</div>
					{imageFormat === "png" && (
						<div className="flex items-center gap-4">
							<Label className="text-sm" htmlFor="scale-select">
								Resolution
							</Label>
							<Select
								onValueChange={(v) => setImageScale(v as "1" | "2" | "3")}
								value={imageScale}
							>
								<SelectTrigger className="w-24" id="scale-select">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="1">1x</SelectItem>
									<SelectItem value="2">2x</SelectItem>
									<SelectItem value="3">3x</SelectItem>
								</SelectContent>
							</Select>
						</div>
					)}
				</div>
				<Button
					className="my-2"
					disabled={imageExportLoading}
					onClick={handleImageExport}
					variant="outline"
				>
					{imageExportLoading ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<Download className="mr-2 h-4 w-4" />
					)}
					{imageExportLoading
						? "Exporting..."
						: `Download ${imageFormat.toUpperCase()}`}
				</Button>
			</div>
			<Separator />
			<div className="my-4">
				<h2 className="mb-2 flex items-center justify-start gap-2">
					<FileText className="h-4 w-4" />
					Export Report
				</h2>
				<p className="text-muted-foreground text-sm">
					Download a formatted report of your assurance case.
				</p>
				<div className="my-3 space-y-3">
					<div className="flex items-center gap-4">
						<Label className="text-sm">Format</Label>
						<RadioGroup
							className="flex items-center gap-4"
							onValueChange={(value) => setDocFormat(value as ExportFormat)}
							value={docFormat}
						>
							<div className="flex items-center space-x-2">
								<RadioGroupItem id="doc-format-pdf" value="pdf" />
								<Label className="font-normal" htmlFor="doc-format-pdf">
									PDF
								</Label>
							</div>
							<div className="flex items-center space-x-2">
								<RadioGroupItem id="doc-format-markdown" value="markdown" />
								<Label className="font-normal" htmlFor="doc-format-markdown">
									Markdown
								</Label>
							</div>
							<div className="flex items-center space-x-2">
								<RadioGroupItem id="doc-format-docx" value="docx" />
								<Label className="font-normal" htmlFor="doc-format-docx">
									Word
								</Label>
							</div>
						</RadioGroup>
					</div>
					<div className="space-y-2">
						<div className="flex items-center gap-4">
							<Label className="text-sm" htmlFor="doc-template-select">
								Template
							</Label>
							<Select
								onValueChange={(v) => setDocTemplate(v as TemplatePreset)}
								value={docTemplate}
							>
								<SelectTrigger className="w-40" id="doc-template-select">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="full-report">Full Report</SelectItem>
									<SelectItem value="summary">Summary</SelectItem>
									<SelectItem value="evidence-list">Evidence List</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<TemplateDescription template={docTemplate} />
					</div>
					<SectionCustomisation
						onToggle={handleSectionToggle}
						sections={docSections}
					/>
				</div>
				<Button
					className="my-2"
					disabled={docExportLoading}
					onClick={handleDocumentExport}
					variant="outline"
				>
					{docExportLoading ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<Download className="mr-2 h-4 w-4" />
					)}
					{docExportLoading
						? "Exporting..."
						: `Download ${({ pdf: "PDF", markdown: "Markdown", docx: "Word" } as const)[docFormat]}`}
				</Button>
			</div>
			<Separator />
			<div className="my-4">
				<h2 className="mb-2 flex items-center justify-start gap-2">
					<Cloud className="h-4 w-4" />
					Backup to Google Drive
				</h2>
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
							Save this case to your TEA Platform Backups folder in Google
							Drive.
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
		</Modal>
	);
};
