"use client";

import { useCallback, useEffect, useState } from "react";
import type { CaseInformationData } from "@/lib/schemas/case-information";
// Reusing the service's snapshot shape rather than hand-declaring a parallel
// type: it already names exactly the four case-information fields (ADR 0003
// §1), so this can't drift from the real record shape.
import type { CaseInformationSnapshot } from "@/lib/services/case-information-service";
import { toast } from "@/lib/toast";

interface UseCaseInformationReturn {
	information: CaseInformationSnapshot | null;
	loading: boolean;
	removeFeatureImage: () => Promise<boolean>;
	save: (values: CaseInformationData) => Promise<boolean>;
	saving: boolean;
	uploadFeatureImage: (file: File) => Promise<boolean>;
	uploadingImage: boolean;
}

/**
 * Client-side data access for a case's case-information record (ADR 0003
 * §1). Fetches on mount/caseId change, and exposes save / feature-image
 * upload / feature-image remove actions against the `/api/cases/[id]/
 * information` route pair. Mirrors the shape of `use-case-study-image.ts`
 * for the image half — this is the case-information analogue.
 */
export function useCaseInformation(
	caseId: string | undefined
): UseCaseInformationReturn {
	const [information, setInformation] =
		useState<CaseInformationSnapshot | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [uploadingImage, setUploadingImage] = useState(false);

	const fetchInformation = useCallback(async () => {
		if (!caseId) {
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			const response = await fetch(`/api/cases/${caseId}/information`);
			if (!response.ok) {
				setInformation(null);
				return;
			}
			const data = await response.json();
			setInformation(data);
		} catch {
			setInformation(null);
		} finally {
			setLoading(false);
		}
	}, [caseId]);

	useEffect(() => {
		fetchInformation();
	}, [fetchInformation]);

	const save = useCallback(
		async (values: CaseInformationData): Promise<boolean> => {
			if (!caseId) {
				return false;
			}

			setSaving(true);
			try {
				const response = await fetch(`/api/cases/${caseId}/information`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(values),
				});

				if (!response.ok) {
					toast({
						variant: "destructive",
						title: "Failed to save case information",
						description: "Something went wrong trying to save the changes.",
					});
					return false;
				}

				const data = await response.json();
				setInformation(data);
				toast({
					variant: "success",
					title: "Case information saved",
				});
				return true;
			} catch {
				toast({
					variant: "destructive",
					title: "Failed to save case information",
					description: "Something went wrong trying to save the changes.",
				});
				return false;
			} finally {
				setSaving(false);
			}
		},
		[caseId]
	);

	const uploadFeatureImage = useCallback(
		async (file: File): Promise<boolean> => {
			if (!caseId) {
				return false;
			}

			setUploadingImage(true);
			try {
				const formData = new FormData();
				formData.append("image", file);

				const response = await fetch(`/api/cases/${caseId}/information/image`, {
					method: "POST",
					body: formData,
				});

				if (!response.ok) {
					toast({
						variant: "destructive",
						title: "Image upload failed",
						description: "Could not upload the feature image.",
					});
					return false;
				}

				const data = await response.json();
				setInformation((prev) => ({
					authors: prev?.authors ?? null,
					description: prev?.description ?? null,
					sector: prev?.sector ?? null,
					featureImageUrl: data.featureImageUrl,
				}));
				return true;
			} catch {
				toast({
					variant: "destructive",
					title: "Image upload failed",
					description: "Could not upload the feature image.",
				});
				return false;
			} finally {
				setUploadingImage(false);
			}
		},
		[caseId]
	);

	const removeFeatureImage = useCallback(async (): Promise<boolean> => {
		if (!caseId) {
			return false;
		}

		setUploadingImage(true);
		try {
			const response = await fetch(`/api/cases/${caseId}/information/image`, {
				method: "DELETE",
			});

			if (!response.ok) {
				toast({
					variant: "destructive",
					title: "Failed to remove image",
					description: "Could not remove the feature image.",
				});
				return false;
			}

			setInformation((prev) =>
				prev ? { ...prev, featureImageUrl: null } : prev
			);
			return true;
		} catch {
			toast({
				variant: "destructive",
				title: "Failed to remove image",
				description: "Could not remove the feature image.",
			});
			return false;
		} finally {
			setUploadingImage(false);
		}
	}, [caseId]);

	return {
		information,
		loading,
		saving,
		uploadingImage,
		save,
		uploadFeatureImage,
		removeFeatureImage,
	};
}
