import { useCallback, useEffect, useState } from "react";
import type { toast as toastFn } from "@/lib/toast";

interface UseCaseStudyImageParams {
	caseStudyId: number | undefined;
	toast: typeof toastFn;
}

interface UseCaseStudyImageReturn {
	deleteCaseStudyFeatureImage: (caseStudyId: number) => Promise<void>;
	featuredImage: string;
	previewImage: string;
	setFeaturedImage: React.Dispatch<React.SetStateAction<string>>;
	setPreviewImage: React.Dispatch<React.SetStateAction<string>>;
	uploadCaseStudyFeatureImage: (
		caseStudyId: number,
		imageFile: File
	) => Promise<void>;
}

export function useCaseStudyImage({
	caseStudyId,
	toast,
}: UseCaseStudyImageParams): UseCaseStudyImageReturn {
	const [previewImage, setPreviewImage] = useState("");
	const [featuredImage, setFeaturedImage] = useState("");

	async function uploadCaseStudyFeatureImage(
		id: number,
		imageFile: File
	): Promise<void> {
		const formData = new FormData();
		formData.append("image", imageFile);

		try {
			// Use internal API route - auth handled via NextAuth session cookies
			const response = await fetch(`/api/case-studies/${id}/image`, {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				throw new Error("Failed to upload feature image");
			}

			const _result = await response.json();
			toast({
				title: "Feature Image Uploaded",
				description: "Feature image successfully uploaded!",
			});
		} catch (_error) {
			toast({
				variant: "destructive",
				title: "Image Upload Failed",
				description: "Could not upload feature image!",
			});
		}
	}

	async function deleteCaseStudyFeatureImage(id: number): Promise<void> {
		try {
			// Use internal API route - auth handled via NextAuth session cookies
			const response = await fetch(`/api/case-studies/${id}/image`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("Failed to delete feature image");
			}
		} catch (_error) {
			// Silently handle error
		}
	}

	const fetchFeaturedImage = useCallback(async () => {
		try {
			// Use internal API route - auth handled via NextAuth session cookies
			const response = await fetch(`/api/case-studies/${caseStudyId}/image`);

			if (response.status === 404) {
				setFeaturedImage("");
				return;
			}

			const result = await response.json();
			// Internal API returns the image path directly
			setFeaturedImage(result.image || "");
		} catch (_error) {
			// Silently handle error
		}
	}, [caseStudyId]);

	useEffect(() => {
		if (caseStudyId !== undefined) {
			fetchFeaturedImage();
		}
	}, [caseStudyId, fetchFeaturedImage]);

	return {
		previewImage,
		setPreviewImage,
		featuredImage,
		setFeaturedImage,
		uploadCaseStudyFeatureImage,
		deleteCaseStudyFeatureImage,
	};
}
