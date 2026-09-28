"use client";

import { TrashIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
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
import { logger } from "@/lib/logger";
import { toast } from "@/lib/toast";

const log = logger.child({ component: "archived-copies-list" });

export interface ArchivedCopy {
	archivedAt: string;
	id: string;
	slug: string;
	title: string;
}

interface ArchivedCopiesListProps {
	copies: ArchivedCopy[];
}

/**
 * The Trash page's "Archived on Discover" section (design note, Chris's
 * ruling 1 and 3, 2026-09-28) — the owner's archived Discover copies,
 * including copies whose case has since been permanently deleted. Renders
 * nothing when there are none, so the section appears only when non-empty.
 */
export function ArchivedCopiesList({ copies }: ArchivedCopiesListProps) {
	const router = useRouter();
	const [isRemoving, setIsRemoving] = useState<string | null>(null);
	const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
	const [copyToRemove, setCopyToRemove] = useState<ArchivedCopy | null>(null);

	async function handleRemove() {
		if (!copyToRemove) {
			return;
		}

		setIsRemoving(copyToRemove.id);
		setRemoveDialogOpen(false);

		try {
			const response = await fetch(
				`/api/cases/trash/archived/${copyToRemove.id}`,
				{ method: "DELETE" }
			);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to remove archived copy");
			}

			toast({
				title: "Removed from Discover",
				description: "The archived copy has been permanently removed",
			});
			router.refresh();
		} catch (error) {
			log.error("Error removing archived copy", { error });
			toast({
				title: "Error",
				description:
					error instanceof Error
						? error.message
						: "Failed to remove archived copy",
				variant: "destructive",
			});
		} finally {
			setIsRemoving(null);
			setCopyToRemove(null);
		}
	}

	function openRemoveDialog(copy: ArchivedCopy) {
		setCopyToRemove(copy);
		setRemoveDialogOpen(true);
	}

	if (copies.length === 0) {
		return null;
	}

	return (
		<div className="space-y-4">
			<h2 className="font-medium text-lg">Archived on Discover</h2>
			<div className="-mx-4 sm:mx-0">
				<table className="min-w-full divide-y divide-foreground/10">
					<thead>
						<tr>
							<th
								className="py-3.5 pr-3 pl-4 text-left font-semibold text-foreground text-sm sm:pl-0"
								scope="col"
							>
								Title
							</th>
							<th
								className="hidden px-3 py-3.5 text-left font-semibold text-foreground text-sm sm:table-cell"
								scope="col"
							>
								Archived
							</th>
							<th className="relative py-3.5 pr-4 pl-3 sm:pr-0" scope="col">
								<span className="sr-only">Actions</span>
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-foreground/10 bg-background">
						{copies.map((copy) => (
							<tr key={copy.id}>
								<td className="w-full max-w-0 py-4 pr-3 pl-4 font-medium text-foreground text-sm sm:w-auto sm:max-w-none sm:pl-0">
									<Link
										className="hover:underline"
										href={`/discover/${copy.slug}`}
									>
										{copy.title}
									</Link>
									<div className="mt-1 text-muted-foreground text-xs sm:hidden">
										Archived {formatShortDate(copy.archivedAt)}
									</div>
								</td>
								<td className="hidden px-3 py-4 text-foreground/80 text-sm sm:table-cell">
									{formatShortDate(copy.archivedAt)}
								</td>
								<td className="py-4 pr-4 pl-3 text-right font-medium text-sm sm:pr-0">
									<Button
										disabled={isRemoving === copy.id}
										onClick={() => openRemoveDialog(copy)}
										size="sm"
										variant="destructive"
									>
										<TrashIcon
											className={
												isRemoving === copy.id
													? "mr-1.5 h-4 w-4 animate-spin"
													: "mr-1.5 h-4 w-4"
											}
										/>
										Remove from Discover
									</Button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<AlertDialog onOpenChange={setRemoveDialogOpen} open={removeDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove from Discover?</AlertDialogTitle>
						<AlertDialogDescription>
							This cannot be undone. The archived public copy of &ldquo;
							{copyToRemove?.title}&rdquo; will be permanently removed from
							Discover.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={handleRemove}
						>
							Remove from Discover
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
