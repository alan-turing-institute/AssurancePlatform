"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCaseInformation } from "@/hooks/use-case-information";
import type {
	CaseInformationData,
	CaseInformationInput,
} from "@/lib/schemas/case-information";
import { upsertCaseInformationSchema } from "@/lib/schemas/case-information";
import { Button } from "../ui/button";

interface CaseInformationSectionProps {
	canEdit: boolean;
	caseId: string | undefined;
}

/**
 * Read/edit surface for a case's case-information record (ADR 0003 §1) —
 * description, authors, sector, and feature image. Anyone with case access
 * can view it; only case EDIT permission can save changes, matching the
 * server-side gate in `upsertCaseInformation`. Rendered inside the shared
 * `CaseSheet` (`case-details.tsx`), reachable from both the title-click
 * entry point and the toolbar's "Case Information" button (ADR 0003
 * implementation shape §2 — two entry points, one component).
 */
export function CaseInformationSection({
	caseId,
	canEdit,
}: CaseInformationSectionProps) {
	const {
		information,
		loading,
		saving,
		uploadingImage,
		save,
		uploadFeatureImage,
		removeFeatureImage,
	} = useCaseInformation(caseId);

	const form = useForm<CaseInformationInput, unknown, CaseInformationData>({
		resolver: zodResolver(upsertCaseInformationSchema),
		defaultValues: {
			description: "",
			authors: "",
			sector: "",
			featureImageUrl: "",
		},
	});
	const { reset } = form;

	// Sync fetched values into the form once they arrive (the form mounts
	// before the fetch resolves).
	useEffect(() => {
		reset({
			description: information?.description ?? "",
			authors: information?.authors ?? "",
			sector: information?.sector ?? "",
			featureImageUrl: information?.featureImageUrl ?? "",
		});
	}, [information, reset]);

	const onSubmit = async (values: CaseInformationData) => {
		await save(values);
	};

	const onImageChange = async (file: File | string) => {
		if (typeof file !== "string") {
			await uploadFeatureImage(file);
		}
	};

	const onImageRemove = async () => {
		await removeFeatureImage();
	};

	if (loading) {
		return (
			<div className="space-y-4" data-testid="case-information-loading">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-20 w-full" />
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-10 w-full" />
			</div>
		);
	}

	if (!canEdit) {
		return (
			<div className="space-y-4" data-testid="case-information-view">
				<div>
					<h4 className="font-medium text-muted-foreground text-sm">
						Description
					</h4>
					<p className="text-sm">
						{information?.description || "No description provided."}
					</p>
				</div>
				<div>
					<h4 className="font-medium text-muted-foreground text-sm">Authors</h4>
					<p className="text-sm">{information?.authors || "Not provided."}</p>
				</div>
				<div>
					<h4 className="font-medium text-muted-foreground text-sm">Sector</h4>
					<p className="text-sm">{information?.sector || "Not provided."}</p>
				</div>
				{information?.featureImageUrl && (
					<div>
						<h4 className="font-medium text-muted-foreground text-sm">
							Feature image
						</h4>
						<div className="relative mt-2 aspect-video w-full max-w-2xl overflow-hidden rounded-lg border">
							<Image
								alt="Case feature"
								className="object-cover"
								fill
								sizes="(max-width: 768px) 100vw, 672px"
								src={information.featureImageUrl}
							/>
						</div>
					</div>
				)}
			</div>
		);
	}

	return (
		<Form {...form}>
			<form
				className="space-y-6"
				data-testid="case-information-form"
				onSubmit={form.handleSubmit(onSubmit)}
			>
				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Description</FormLabel>
							<FormControl>
								<Textarea
									placeholder="A short description of this assurance case"
									rows={4}
									{...field}
									value={field.value ?? ""}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="authors"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Authors</FormLabel>
							<FormControl>
								<Input
									placeholder="e.g. Ada Lovelace"
									{...field}
									value={field.value ?? ""}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="sector"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Sector</FormLabel>
							<FormControl>
								<Input
									placeholder="e.g. Healthcare"
									{...field}
									value={field.value ?? ""}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<div className="space-y-2">
					<span className="font-medium text-sm">Feature image</span>
					<ImageUpload
						disabled={uploadingImage}
						onChange={onImageChange}
						onRemove={onImageRemove}
						value={information?.featureImageUrl ?? ""}
					/>
				</div>
				<Separator />
				<Button disabled={saving} type="submit">
					{saving ? (
						<span className="flex items-center justify-center gap-2">
							<Loader2 className="h-4 w-4 animate-spin" />
							Saving...
						</span>
					) : (
						<span>Save case information</span>
					)}
				</Button>
			</form>
		</Form>
	);
}
