"use client";

import {
	BookOpen,
	Eye,
	MessageCircleMore,
	PencilRuler,
	Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertModal } from "@/components/modals/alert-modal";
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { formatShortDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

// Flexible type for case data - compatible with both actions and domain types
export type CaseCardData = {
	id: number | string;
	name: string;
	description?: string;
	createdDate?: string;
	updatedDate?: string;
	permissions?: string | string[];
	isDemo?: boolean;
};

type CaseCardProps = {
	assuranceCase: CaseCardData;
	className?: string;
};

const CaseCard = ({ assuranceCase }: CaseCardProps) => {
	const { id, name, description, createdDate, isDemo } = assuranceCase;
	const router = useRouter();

	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [imgSrc, setImgSrc] = useState("");
	const [imageLoading, setImageLoading] = useState<boolean>(true);

	// Normalize permissions to always be an array
	const normalizePermissions = (): string[] => {
		if (Array.isArray(assuranceCase.permissions)) {
			return assuranceCase.permissions;
		}
		if (assuranceCase.permissions) {
			return [assuranceCase.permissions];
		}
		return [];
	};
	const permissions = normalizePermissions();

	const onDelete = useCallback(async () => {
		try {
			setLoading(true);

			// Use Next.js API route for Prisma auth compatibility
			const response = await fetch(`/api/cases/${assuranceCase.id}`, {
				method: "DELETE",
			});

			if (response.ok) {
				router.refresh();
			}
		} catch (_error: unknown) {
			// Error handling is done through the response status check above
		} finally {
			setLoading(false);
			setOpen(false);
		}
	}, [assuranceCase.id, router]);

	const fetchScreenshot = useCallback(async () => {
		try {
			const response = await fetch(`/api/cases/${id}/image`);

			if (response.status === 404) {
				setImgSrc("/images/assurance-case-medium.png");
				return;
			}

			if (!response.ok) {
				setImgSrc("/images/assurance-case-medium.png");
				return;
			}

			const result = await response.json();
			setImgSrc(result.image);
		} catch (_error) {
			setImgSrc("/images/assurance-case-medium.png");
		} finally {
			setImageLoading(false);
		}
	}, [id]);

	useEffect(() => {
		fetchScreenshot().catch(() => {
			// Handle error silently - image loading state already updated in fetchScreenshot
		});
	}, [fetchScreenshot]);

	return (
		<div className="group relative min-h-[420px]">
			<Link href={`/case/${assuranceCase.id}`}>
				<Card
					className={cn(
						"flex h-full flex-col items-start justify-start transition-all group-hover:bg-primary/5",
						isDemo && "ring-2 ring-primary/20"
					)}
				>
					<CardHeader className="w-full flex-1">
						{imageLoading ? (
							<Skeleton className="relative mb-4 flex aspect-video overflow-hidden rounded-md" />
						) : (
							<div className="relative mb-4 flex aspect-video overflow-hidden rounded-md">
								{imgSrc && (
									<Image
										alt={`Assurance Case ${assuranceCase.name} screenshot`}
										fill
										sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
										src={imgSrc}
									/>
								)}
								{isDemo && (
									<div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-medium text-primary-foreground text-xs">
										<BookOpen aria-hidden="true" className="h-3 w-3" />
										Tutorial
									</div>
								)}
							</div>
						)}
						<CardTitle>{name}</CardTitle>
						<CardDescription className="text-foreground">
							{description}
						</CardDescription>
					</CardHeader>
					<CardFooter className="flex w-full items-center justify-between text-muted-foreground text-xs">
						<p>
							Created on: {createdDate ? formatShortDate(createdDate) : "N/A"}
						</p>
						<div className="flex items-center justify-start gap-2">
							{permissions.includes("view") && <Eye className="h-4 w-4" />}
							{permissions.includes("review") && (
								<MessageCircleMore className="h-4 w-4" />
							)}
							{permissions.includes("edit") && (
								<PencilRuler className="h-4 w-4" />
							)}
						</div>
					</CardFooter>
				</Card>
			</Link>
			{(permissions.includes("manage") || permissions.includes("owner")) && (
				<button
					aria-label="Delete case"
					className="absolute top-4 right-4 z-50 hidden rounded-md bg-destructive p-2 text-destructive-foreground shadow-lg group-hover:block"
					data-testid="delete-case-button"
					disabled={loading}
					onClick={() => setOpen(true)}
					type="button"
				>
					<Trash2 className="h-4 w-4" />
				</button>
			)}
			<AlertModal
				confirmButtonText={"Delete"}
				isOpen={open}
				loading={loading}
				onClose={() => setOpen(false)}
				onConfirm={onDelete}
			/>
		</div>
	);
};

export default CaseCard;
