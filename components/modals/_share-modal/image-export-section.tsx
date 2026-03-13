"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import type { Edge, Node } from "reactflow";
import { DEPTH_OPTIONS } from "@/lib/case/export-constants";
import {
	exportDiagramImage,
	exportFilteredDiagramImage,
} from "@/lib/case/image-export";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import type { toast as ToastFn } from "@/lib/toast";
import { cn } from "@/lib/utils";
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

export interface ImageExportSectionProps {
	assuranceCase: AssuranceCaseResponse | null;
	className?: string;
	edges: Edge[];
	layoutDirection: "TB" | "LR";
	nodes: Node[];
	setEdges: (edges: Edge[]) => void;
	setLayoutDirection: (dir: "TB" | "LR") => void;
	setNodes: (nodes: Node[]) => void;
	toast: typeof ToastFn;
}

export function ImageExportSection({
	assuranceCase,
	nodes,
	edges,
	layoutDirection,
	setNodes,
	setEdges,
	setLayoutDirection,
	toast,
	className,
}: ImageExportSectionProps) {
	const [imageFormat, setImageFormat] = useState<"svg" | "png">("png");
	const [imageScale, setImageScale] = useState<"1" | "2" | "3">("2");
	const [diagramDepth, setDiagramDepth] = useState<string>("all");
	const [imageExportLoading, setImageExportLoading] = useState(false);

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

		// Capture original layout and direction for restoration
		const originalNodes = [...nodes];
		const originalEdges = [...edges];
		const originalDirection = layoutDirection;

		try {
			const scale =
				imageFormat === "png" ? (Number(imageScale) as 1 | 2 | 3) : undefined;
			const maxDepth =
				diagramDepth === "all" ? null : Number.parseInt(diagramDepth, 10);

			if (maxDepth != null) {
				await exportFilteredDiagramImage({
					format: imageFormat,
					scale,
					caseName: assuranceCase.name,
					nodes,
					edges,
					layoutDirection,
					applyLayout: (layoutNodes, layoutEdges, direction) => {
						setNodes(layoutNodes);
						setEdges(layoutEdges);
						if (direction === "TB" || direction === "LR") {
							setLayoutDirection(direction);
						}
					},
					restoreLayout: () => {
						setNodes(originalNodes);
						setEdges(originalEdges);
						setLayoutDirection(originalDirection);
					},
					maxDepth,
				});
			} else {
				await exportDiagramImage({
					format: imageFormat,
					scale,
					caseName: assuranceCase.name,
					nodes,
				});
			}

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
			// Always restore original layout in case of error during filtered export
			setNodes(originalNodes);
			setEdges(originalEdges);
			setLayoutDirection(originalDirection);
			setImageExportLoading(false);
		}
	};

	return (
		<div className={cn("my-4", className)}>
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
				<div className="flex items-center gap-4">
					<Label className="text-sm" htmlFor="image-depth-select">
						Depth
					</Label>
					<Select onValueChange={setDiagramDepth} value={diagramDepth}>
						<SelectTrigger className="w-44" id="image-depth-select">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{DEPTH_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
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
	);
}
