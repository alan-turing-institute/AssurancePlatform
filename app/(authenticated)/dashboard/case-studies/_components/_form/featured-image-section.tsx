"use client";

import type { useForm } from "react-hook-form";
import { ImageUpload } from "@/components/ui/image-upload";
import { cn } from "@/lib/utils";
import type { CaseStudyFormValues } from "./form-schema";

export type FeaturedImageSectionProps = {
	form: ReturnType<typeof useForm<CaseStudyFormValues>>;
	previewImage: string;
	setPreviewImage: React.Dispatch<React.SetStateAction<string>>;
	featuredImage: string;
	setFeaturedImage: React.Dispatch<React.SetStateAction<string>>;
	caseStudyId: number | undefined;
	deleteCaseStudyFeatureImage: (caseStudyId: number) => Promise<void>;
	className?: string;
};

export function FeaturedImageSection({
	form,
	previewImage,
	setPreviewImage,
	featuredImage,
	setFeaturedImage,
	caseStudyId,
	deleteCaseStudyFeatureImage,
	className,
}: FeaturedImageSectionProps) {
	return (
		<div className={cn("space-y-6", className)}>
			<div>
				<h3 className="font-medium text-lg">Featured Image</h3>
				<p className="text-muted-foreground text-sm">
					Upload a representative image for this case study
				</p>
			</div>

			<ImageUpload
				disabled={false}
				onChange={(file) => {
					if (typeof file === "string") {
						// Handle string case (when removing)
						setPreviewImage("");
						form.setValue("image", "");
					} else {
						// Handle File case
						setPreviewImage(URL.createObjectURL(file));
						form.setValue("image", file);
					}
				}}
				onRemove={() => {
					setPreviewImage("");
					setFeaturedImage("");
					form.setValue("image", "");
					if (featuredImage && caseStudyId !== undefined) {
						deleteCaseStudyFeatureImage(caseStudyId);
					}
				}}
				value={previewImage || featuredImage}
			/>
		</div>
	);
}
