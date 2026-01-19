"use client";

import { json } from "@codemirror/lang-json";
import CodeMirror from "@uiw/react-codemirror";
import { Check, Copy } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import useStore from "@/data/store";
import { exportCase } from "@/lib/services/case-export-service";
import { useToast } from "@/lib/toast";

type JsonViewPanelProps = {
	isOpen: boolean;
	onClose: () => void;
	userId: string;
};

/**
 * Formats JSON with 2-space indentation for readability.
 */
function formatJson(data: unknown): string {
	return JSON.stringify(data, null, 2);
}

/**
 * Loading skeleton for the JSON content area.
 */
function JsonLoadingSkeleton() {
	return (
		<div className="space-y-2 p-4">
			<Skeleton className="h-4 w-3/4" />
			<Skeleton className="h-4 w-1/2" />
			<Skeleton className="h-4 w-5/6" />
			<Skeleton className="h-4 w-2/3" />
			<Skeleton className="h-4 w-3/4" />
			<Skeleton className="h-4 w-1/2" />
			<Skeleton className="h-4 w-5/6" />
			<Skeleton className="h-4 w-2/3" />
		</div>
	);
}

const JsonViewPanel = ({ isOpen, onClose, userId }: JsonViewPanelProps) => {
	const { assuranceCase } = useStore();
	const { resolvedTheme } = useTheme();
	const { toast } = useToast();

	const [jsonContent, setJsonContent] = useState<string>("");
	const [loading, setLoading] = useState(false);
	const [copied, setCopied] = useState(false);

	const fetchJson = useCallback(async () => {
		if (!assuranceCase?.id) {
			return;
		}

		setLoading(true);

		try {
			const result = await exportCase(userId, assuranceCase.id, {
				includeComments: true,
			});

			if (!result.success) {
				toast({
					variant: "destructive",
					title: "Failed to load JSON",
					description: result.error,
				});
				return;
			}

			const formatted = formatJson(result.data);
			setJsonContent(formatted);
		} catch (error) {
			toast({
				variant: "destructive",
				title: "Failed to load JSON",
				description:
					error instanceof Error ? error.message : "An error occurred",
			});
		} finally {
			setLoading(false);
		}
	}, [assuranceCase?.id, userId, toast]);

	// Fetch JSON when panel opens
	useEffect(() => {
		if (isOpen) {
			fetchJson();
		}
	}, [isOpen, fetchJson]);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(jsonContent);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast({
				variant: "destructive",
				title: "Copy failed",
				description: "Could not copy to clipboard",
			});
		}
	}, [jsonContent, toast]);

	const editorTheme = resolvedTheme === "dark" ? "dark" : "light";

	return (
		<Sheet onOpenChange={(open) => !open && onClose()} open={isOpen}>
			<SheetContent
				className="flex w-full flex-col sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
				side="left"
			>
				<SheetHeader>
					<SheetTitle>JSON View</SheetTitle>
					<SheetDescription>
						View the assurance case data as JSON. Use the copy button to copy
						the content.
					</SheetDescription>
				</SheetHeader>

				<div className="mt-4 flex items-center justify-end">
					<Button
						disabled={loading || !jsonContent}
						onClick={handleCopy}
						size="sm"
						variant="outline"
					>
						{copied ? (
							<>
								<Check className="mr-2 h-4 w-4" />
								Copied
							</>
						) : (
							<>
								<Copy className="mr-2 h-4 w-4" />
								Copy
							</>
						)}
					</Button>
				</div>

				<div className="mt-4 flex-1 overflow-auto rounded-md border bg-muted/30">
					{loading ? (
						<JsonLoadingSkeleton />
					) : (
						<CodeMirror
							basicSetup={{
								lineNumbers: true,
								foldGutter: true,
								highlightActiveLine: false,
							}}
							editable={false}
							extensions={[json()]}
							height="100%"
							readOnly
							theme={editorTheme}
							value={jsonContent || "No data available"}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
};

export default JsonViewPanel;
