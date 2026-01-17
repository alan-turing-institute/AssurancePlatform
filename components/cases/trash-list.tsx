"use client";

import { ArrowPathIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/date";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type TrashedCase = {
	id: string;
	name: string;
	description: string | null;
	createdAt: string;
	deletedAt: string;
	daysRemaining: number;
};

type TrashListProps = {
	cases: TrashedCase[];
};

function getDaysRemainingColour(days: number): string {
	if (days > 7) {
		return "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20";
	}
	if (days > 3) {
		return "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20";
	}
	return "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20";
}

function DaysRemainingBadge({ days }: { days: number }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2 py-1 font-medium text-xs ring-1 ring-inset",
				getDaysRemainingColour(days)
			)}
		>
			{days} {days === 1 ? "day" : "days"} left
		</span>
	);
}

export function TrashList({ cases }: TrashListProps) {
	const router = useRouter();
	const { toast } = useToast();
	const [isRestoring, setIsRestoring] = useState<string | null>(null);
	const [isPurging, setIsPurging] = useState<string | null>(null);
	const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
	const [caseToDelete, setCaseToDelete] = useState<TrashedCase | null>(null);

	async function handleRestore(caseId: string) {
		setIsRestoring(caseId);
		try {
			const response = await fetch(`/api/cases/${caseId}/restore`, {
				method: "POST",
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to restore case");
			}

			toast({
				title: "Case restored",
				description: "The case has been restored to your dashboard",
			});
			router.refresh();
		} catch (error) {
			console.error("Error restoring case:", error);
			toast({
				title: "Error",
				description:
					error instanceof Error ? error.message : "Failed to restore case",
				variant: "destructive",
			});
		} finally {
			setIsRestoring(null);
		}
	}

	async function handlePurge() {
		if (!caseToDelete) {
			return;
		}

		setIsPurging(caseToDelete.id);
		setPurgeDialogOpen(false);

		try {
			const response = await fetch(`/api/cases/${caseToDelete.id}/purge`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to delete case");
			}

			toast({
				title: "Case permanently deleted",
				description: "The case and all its elements have been removed",
			});
			router.refresh();
		} catch (error) {
			console.error("Error purging case:", error);
			toast({
				title: "Error",
				description:
					error instanceof Error ? error.message : "Failed to delete case",
				variant: "destructive",
			});
		} finally {
			setIsPurging(null);
			setCaseToDelete(null);
		}
	}

	function openPurgeDialog(caseItem: TrashedCase) {
		setCaseToDelete(caseItem);
		setPurgeDialogOpen(true);
	}

	if (cases.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<TrashIcon className="mb-4 h-12 w-12 text-muted-foreground/50" />
				<h3 className="mb-2 font-medium text-lg">Trash is empty</h3>
				<p className="text-muted-foreground text-sm">
					Deleted cases will appear here for 30 days before being permanently
					removed.
				</p>
			</div>
		);
	}

	return (
		<>
			<div className="-mx-4 sm:mx-0">
				<table className="min-w-full divide-y divide-foreground/10">
					<thead>
						<tr>
							<th
								className="py-3.5 pr-3 pl-4 text-left font-semibold text-foreground text-sm sm:pl-0"
								scope="col"
							>
								Name
							</th>
							<th
								className="hidden px-3 py-3.5 text-left font-semibold text-foreground text-sm sm:table-cell"
								scope="col"
							>
								Deleted
							</th>
							<th
								className="px-3 py-3.5 text-left font-semibold text-foreground text-sm"
								scope="col"
							>
								Time remaining
							</th>
							<th className="relative py-3.5 pr-4 pl-3 sm:pr-0" scope="col">
								<span className="sr-only">Actions</span>
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-foreground/10 bg-background">
						{cases.map((caseItem) => (
							<tr key={caseItem.id}>
								<td className="w-full max-w-0 py-4 pr-3 pl-4 font-medium text-foreground text-sm sm:w-auto sm:max-w-none sm:pl-0">
									<div>{caseItem.name}</div>
									<div className="mt-1 text-muted-foreground text-xs sm:hidden">
										Deleted {formatShortDate(caseItem.deletedAt)}
									</div>
								</td>
								<td className="hidden px-3 py-4 text-foreground/80 text-sm sm:table-cell">
									{formatShortDate(caseItem.deletedAt)}
								</td>
								<td className="px-3 py-4 text-sm">
									<DaysRemainingBadge days={caseItem.daysRemaining} />
								</td>
								<td className="py-4 pr-4 pl-3 text-right font-medium text-sm sm:pr-0">
									<div className="flex items-center justify-end gap-2">
										<Button
											disabled={
												isRestoring === caseItem.id || isPurging === caseItem.id
											}
											onClick={() => handleRestore(caseItem.id)}
											size="sm"
											variant="outline"
										>
											{isRestoring === caseItem.id ? (
												<ArrowPathIcon className="mr-1.5 h-4 w-4 animate-spin" />
											) : (
												<ArrowPathIcon className="mr-1.5 h-4 w-4" />
											)}
											Restore
										</Button>
										<Button
											disabled={
												isRestoring === caseItem.id || isPurging === caseItem.id
											}
											onClick={() => openPurgeDialog(caseItem)}
											size="sm"
											variant="destructive"
										>
											{isPurging === caseItem.id ? (
												<TrashIcon className="mr-1.5 h-4 w-4 animate-spin" />
											) : (
												<TrashIcon className="mr-1.5 h-4 w-4" />
											)}
											Delete
										</Button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<AlertDialog onOpenChange={setPurgeDialogOpen} open={purgeDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Permanently delete case?</AlertDialogTitle>
						<AlertDialogDescription>
							This cannot be undone. The case &ldquo;{caseToDelete?.name}&rdquo;
							and all its elements will be permanently deleted.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={handlePurge}
						>
							Delete permanently
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
