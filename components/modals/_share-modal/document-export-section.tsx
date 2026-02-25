"use client";

import { ChevronDown, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import type { Node } from "reactflow";
import { getDocumentExportData } from "@/actions/export-document";
import { Checkbox } from "@/components/ui/checkbox";
import { exportDocument } from "@/lib/case/document-export";
import type { ExportFormat, TemplatePreset } from "@/lib/export";
import type { toast as ToastFn } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { AssuranceCase } from "@/types";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../ui/select";

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

/**
 * Default section states for each template preset.
 * These match the DEFAULT_SECTIONS_* configs in lib/export/schemas/section-config.ts
 */
const TEMPLATE_SECTION_DEFAULTS: Record<TemplatePreset, DocSections> = {
	"full-report": {
		titlePage: true,
		tableOfContents: true,
		diagram: true,
		executiveSummary: true,
		assuranceCaseStructure: true,
		comments: true,
		metadata: true,
	},
	summary: {
		titlePage: true,
		tableOfContents: false,
		diagram: true,
		executiveSummary: true,
		assuranceCaseStructure: false,
		comments: false,
		metadata: false,
	},
	"evidence-list": {
		titlePage: true,
		tableOfContents: false,
		diagram: false,
		executiveSummary: false,
		assuranceCaseStructure: false,
		comments: false,
		metadata: true,
	},
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

type SectionCustomisationProps = {
	sections: DocSections;
	onToggle: (key: keyof DocSections) => void;
};

/**
 * Collapsible section customisation component
 */
function SectionCustomisation({
	sections,
	onToggle,
}: SectionCustomisationProps) {
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
					className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
				/>
			</button>
			{isOpen && (
				<div className="space-y-2 border-t px-3 pt-2 pb-3">
					{Object.entries(SECTION_LABELS).map(([key, label]) => (
						<div className="flex items-center space-x-2" key={key}>
							<Checkbox
								checked={sections[key as keyof DocSections]}
								id={`section-${key}`}
								onCheckedChange={() => onToggle(key as keyof DocSections)}
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

type TemplateDescriptionProps = {
	template: TemplatePreset;
};

/**
 * Template description component
 */
function TemplateDescription({ template }: TemplateDescriptionProps) {
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

export type DocumentExportSectionProps = {
	assuranceCase: AssuranceCase | null;
	nodes: Node[];
	toast: typeof ToastFn;
	className?: string;
};

export function DocumentExportSection({
	assuranceCase,
	nodes,
	toast,
	className,
}: DocumentExportSectionProps) {
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

	const handleSectionToggle = (key: keyof DocSections) => {
		setDocSections((prev) => ({
			...prev,
			[key]: !prev[key],
		}));
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
			const result = await getDocumentExportData(assuranceCase.id, {
				includeComments: docSections.comments,
			});

			if ("error" in result) {
				toast({
					variant: "destructive",
					title: "Export failed",
					description: result.error,
				});
				return;
			}

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

	return (
		<div className={cn("my-4", className)}>
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
							onValueChange={(v) => {
								const template = v as TemplatePreset;
								setDocTemplate(template);
								setDocSections(TEMPLATE_SECTION_DEFAULTS[template]);
							}}
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
	);
}
