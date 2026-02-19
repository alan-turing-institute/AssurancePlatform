"use client";

import { saveAs } from "file-saver";
import { Download } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import type { toast as ToastFn } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { AssuranceCase } from "@/types";
import { Button } from "../../ui/button";

export type JsonExportSectionProps = {
	assuranceCase: AssuranceCase | null;
	toast: typeof ToastFn;
	className?: string;
};

export function JsonExportSection({
	assuranceCase,
	toast,
	className,
}: JsonExportSectionProps) {
	const [loading, setLoading] = useState(false);
	const [exportWithComments, setExportWithComments] = useState(true);

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

	return (
		<div className={cn("my-4", className)}>
			<p className="text-muted-foreground text-sm">
				Download a JSON file for backup or importing into another TEA Platform
				instance.
			</p>
			<div className="my-2 flex items-center space-x-2">
				<Checkbox
					checked={exportWithComments}
					id="export-comments"
					onCheckedChange={(checked) => setExportWithComments(checked === true)}
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
	);
}
