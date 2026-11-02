"use client";

import { MoreHorizontal, Shapes } from "lucide-react";
import { useEffect, useState } from "react";
import {
	convertCaseKind,
	fetchConversionConsequences,
} from "@/actions/case-kind";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CaseKind } from "@/lib/schemas/case-export";
import type { ConversionConsequences } from "@/lib/services/case-kind-service";
import { toastSuccess } from "@/lib/toast";
import useStore from "@/store/store";
import ActionTooltip from "../ui/action-tooltip";
import { ConvertCaseKindDialog } from "./convert-case-kind-dialog";

const SUCCESS_MESSAGE: Record<CaseKind, string> = {
	PATTERN: "Converted to a pattern",
	CASE: "Converted to a case",
};

/**
 * The toolbar's menu of case-level actions. It holds one item: convert a
 * case to a pattern, or a pattern back to a case. The item opens a
 * confirmation that states what the conversion affects, and the conversion
 * runs only when it is confirmed. Rendered for people who manage the case.
 */
export function CaseKindMenu() {
	const assuranceCase = useStore((state) => state.assuranceCase);
	const setAssuranceCase = useStore((state) => state.setAssuranceCase);
	const [open, setOpen] = useState(false);
	const [consequences, setConsequences] =
		useState<ConversionConsequences | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const caseId = assuranceCase?.id;
	const targetKind: CaseKind =
		assuranceCase?.kind === "PATTERN" ? "CASE" : "PATTERN";

	// Read what the conversion affects each time the dialog opens.
	useEffect(() => {
		if (!(open && caseId)) {
			return;
		}
		let current = true;
		setConsequences(null);
		setError(null);
		fetchConversionConsequences(caseId)
			.then((result) => {
				if (!current) {
					return;
				}
				if (result.success) {
					setConsequences(result.data);
				} else {
					setError(result.error);
				}
			})
			.catch(() => {
				if (current) {
					setError("Failed to read what converting would affect");
				}
			});
		return () => {
			current = false;
		};
	}, [open, caseId]);

	if (!caseId) {
		return null;
	}

	const onConfirm = async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await convertCaseKind(caseId, targetKind);
			if (!result.success) {
				setError(result.error);
				return;
			}
			const latest = useStore.getState().assuranceCase;
			if (latest) {
				setAssuranceCase({ ...latest, kind: result.data.kind });
			}
			toastSuccess(SUCCESS_MESSAGE[result.data.kind]);
			setOpen(false);
		} catch {
			setError("Failed to convert the case");
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			<DropdownMenu>
				<ActionTooltip label="More actions">
					<DropdownMenuTrigger asChild>
						<Button
							className="rounded-full p-3"
							data-testid="toolbar-more-actions"
							size="icon"
							type="button"
						>
							<MoreHorizontal className="h-5 w-5" />
							<span className="sr-only">More actions</span>
						</Button>
					</DropdownMenuTrigger>
				</ActionTooltip>
				<DropdownMenuContent align="end" side="top">
					<DropdownMenuItem
						data-testid="convert-case-kind"
						onSelect={() => setOpen(true)}
					>
						<Shapes aria-hidden="true" className="mr-2 h-4 w-4" />
						{targetKind === "PATTERN"
							? "Convert to pattern"
							: "Convert to case"}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<ConvertCaseKindDialog
				consequences={consequences}
				error={error}
				isOpen={open}
				loading={loading}
				onCancel={() => setOpen(false)}
				onConfirm={onConfirm}
				targetKind={targetKind}
			/>
		</>
	);
}
