"use client";

import { CloudDownload, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaseStudyResponse } from "@/lib/services/case-response-types";
import { cn } from "@/lib/utils";
import DeleteCaseButton from "../delete-button";

export type FormActionsProps = {
	caseStudy: CaseStudyResponse | undefined;
	loading: boolean;
	handlePublish: () => Promise<void>;
	className?: string;
};

export function FormActions({
	caseStudy,
	loading,
	handlePublish,
	className,
}: FormActionsProps) {
	return (
		<div
			className={cn(
				"flex w-full items-center justify-between gap-4",
				className
			)}
		>
			<div className="flex items-center justify-start gap-2">
				{caseStudy && (
					<Button disabled={loading} type="submit" variant="default">
						Save Changes
					</Button>
				)}
				{!caseStudy && (
					<Button disabled={loading} type="submit" variant="default">
						Save
					</Button>
				)}
				{caseStudy && (
					<Button onClick={handlePublish} type="button" variant="default">
						{caseStudy.published ? (
							<>
								<CloudDownload className="mr-2 size-4" />
								<span>Remove from Public</span>
							</>
						) : (
							<>
								<Share className="mr-2 size-4" />
								<span>Make Public</span>
							</>
						)}
					</Button>
				)}
			</div>
			{caseStudy && (
				<DeleteCaseButton
					caseStudyId={caseStudy.id}
					redirect
					variant="destructive"
				/>
			)}
			{/* <Button variant="destructive" onClick={handleDelete} type="button"><Trash2Icon className="size-4 mr-2"/>Delete</Button> */}
		</div>
	);
}
