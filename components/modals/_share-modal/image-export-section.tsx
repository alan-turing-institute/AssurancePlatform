"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import type { Node } from "reactflow";
import { exportDiagramImage } from "@/lib/case/image-export";
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

export type ImageExportSectionProps = {
	assuranceCase: AssuranceCaseResponse | null;
	nodes: Node[];
	toast: typeof ToastFn;
	className?: string;
};

export function ImageExportSection({
	assuranceCase,
	nodes,
	toast,
	className,
}: ImageExportSectionProps) {
	const [imageFormat, setImageFormat] = useState<"svg" | "png">("png");
	const [imageScale, setImageScale] = useState<"1" | "2" | "3">("2");
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
