"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { AuthorsTagInput } from "@/components/cases/authors-tag-input";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { ImageUpload } from "@/components/ui/image-upload";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCaseInformation } from "@/hooks/use-case-information";
import type {
	CaseInformationData,
	CaseInformationInput,
} from "@/lib/schemas/case-information";
import { upsertCaseInformationSchema } from "@/lib/schemas/case-information";
import { sectors } from "@/lib/sectors";
import useStore from "@/store/store";
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
	const { reset, setValue, setFocus, getValues } = form;

	// Sync fetched values into the form once, when the record for this case
	// first arrives (the form mounts before the fetch resolves). Deliberately
	// does NOT re-run on every `information` change — `information` is also
	// updated by feature-image upload/remove and by a successful save, and a
	// full `reset()` on those would overwrite whatever the user has typed but
	// not yet saved (the "upload wipes unsaved fields" bug: uploading an
	// image replaced `information` with the last-saved server values, and
	// this effect used to reset the whole form to match, clobbering in-flight
	// edits to Authors/Sector). Keyed on caseId so switching to a different
	// case still re-hydrates the form.
	const hydratedCaseIdRef = useRef<string | undefined>(undefined);
	useEffect(() => {
		if (loading || hydratedCaseIdRef.current === caseId) {
			return;
		}
		reset({
			description: information?.description ?? "",
			authors: information?.authors ?? "",
			sector: information?.sector ?? "",
			featureImageUrl: information?.featureImageUrl ?? "",
		});
		hydratedCaseIdRef.current = caseId;
	}, [information, reset, caseId, loading]);

	// The feature image is the one field a background upload/remove legitimately
	// needs to push into the form after initial hydration — sync just that
	// field (never the others) so it reflects the freshly uploaded URL.
	useEffect(() => {
		if (loading || hydratedCaseIdRef.current !== caseId) {
			return;
		}
		setValue("featureImageUrl", information?.featureImageUrl ?? "");
	}, [information?.featureImageUrl, setValue, caseId, loading]);

	// The publish flow (ADR 0003 §2) sends the user here with a specific
	// missing field named — focus it once the fetched values have synced in,
	// then clear the request so a later manual open of this sheet doesn't
	// re-focus anything.
	const caseInformationFocusField = useStore(
		(state) => state.caseInformationFocusField
	);
	const setCaseInformationFocusField = useStore(
		(state) => state.setCaseInformationFocusField
	);
	useEffect(() => {
		if (loading || !(canEdit && caseInformationFocusField)) {
			return;
		}
		if (caseInformationFocusField in getValues()) {
			setFocus(caseInformationFocusField as keyof CaseInformationInput);
		}
		setCaseInformationFocusField(null);
	}, [
		loading,
		canEdit,
		caseInformationFocusField,
		getValues,
		setFocus,
		setCaseInformationFocusField,
	]);

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
								<AuthorsTagInput
									onChange={field.onChange}
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
					render={({ field }) => {
						// A case saved before this select existed can hold a
						// free-text sector value that isn't in the canonical
						// list (e.g. "Healthcare"). Tolerate it: show it as
						// the current selection rather than crashing or
						// silently discarding it — replacing it with a
						// canonical choice is the user's action, not ours.
						const currentValue = field.value ?? "";
						const isLegacyValue =
							currentValue !== "" &&
							!sectors.some((sector) => sector.Name === currentValue);
						return (
							<FormItem>
								<FormLabel>Sector</FormLabel>
								<Select
									onValueChange={field.onChange}
									value={currentValue || undefined}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Select a sector" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{isLegacyValue && (
											<SelectItem value={currentValue}>
												{currentValue} (legacy value)
											</SelectItem>
										)}
										{sectors.map((sector) => (
											<SelectItem key={sector.ID} value={sector.Name}>
												{sector.Name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						);
					}}
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
