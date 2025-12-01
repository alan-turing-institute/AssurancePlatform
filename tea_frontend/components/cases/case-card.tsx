"use client";

import { Eye, MessageCircleMore, PencilRuler, Trash2 } from "lucide-react";
import moment from "moment";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { AlertModal } from "@/components/modals/alert-modal";
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "../ui/skeleton";

// Flexible type for case data - compatible with both actions and domain types
export type CaseCardData = {
	id: number | string;
	name: string;
	description?: string;
	created_date?: string;
	permissions?: string | string[];
};

type CaseCardProps = {
	assuranceCase: CaseCardData;
};

const CaseCard = ({ assuranceCase }: CaseCardProps) => {
	const { id, name, description, created_date } = assuranceCase;
	const { data: session } = useSession();

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
				window.location.reload();
			}
		} catch (_error: unknown) {
			// Error handling is done through the response status check above
		} finally {
			setLoading(false);
			setOpen(false);
		}
	}, [assuranceCase.id]);

	const fetchScreenshot = useCallback(async () => {
		try {
			const requestOptions: RequestInit = {
				method: "GET",
				headers: {
					Authorization: `Token ${session?.key}`,
				},
				redirect: "follow",
			};

			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${id}/image`,
				requestOptions
			);

			if (response.status === 404) {
				setImgSrc("/images/assurance-case-medium.png");
				return;
			}

			const result = await response.json();
			setImgSrc(result.image);
		} catch (_error) {
			// Error handling is done through the response status check above
		} finally {
			setImageLoading(false);
		}
	}, [session?.key, id]);

	useEffect(() => {
		fetchScreenshot().catch(() => {
			// Handle error silently - image loading state already updated in fetchScreenshot
		});
	}, [fetchScreenshot]);

	return (
		<div className="group relative min-h-[420px]">
			<Link href={`/case/${assuranceCase.id}`}>
				<Card className="flex h-full flex-col items-start justify-start transition-all group-hover:bg-indigo-500/5">
					<CardHeader className="w-full flex-1">
						{imageLoading ? (
							<Skeleton className="relative mb-4 flex aspect-video overflow-hidden rounded-md" />
						) : (
							<div className="relative mb-4 flex aspect-video overflow-hidden rounded-md">
								{imgSrc && (
									<Image
										alt={`Assurance Case ${assuranceCase.name} screenshot`}
										fill
										src={imgSrc}
									/>
								)}
							</div>
						)}
						<CardTitle>{name}</CardTitle>
						<CardDescription className="text-slate-900 dark:text-white">
							{description}
						</CardDescription>
					</CardHeader>
					<CardFooter className="flex w-full items-center justify-between text-gray-500 text-xs dark:text-gray-300">
						<p>Created on: {moment(created_date).format("DD/MM/YYYY")}</p>
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
					className="absolute top-4 right-4 z-50 hidden rounded-md bg-rose-500 p-2 text-white shadow-lg group-hover:block"
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
