"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createCaseStudy, updateCaseStudy } from "@/actions/case-studies";
import { AlertModal } from "@/components/modals/alert-modal";
import { Form } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import type { CaseStudyResponse } from "@/lib/services/case-response-types";
import { toast } from "@/lib/toast";
import { AuthorSection } from "./_form/author-section";
import { BasicInformationSection } from "./_form/basic-information-section";
import { DescriptionSection } from "./_form/description-section";
import { FeaturedImageSection } from "./_form/featured-image-section";
import { FormActions } from "./_form/form-actions";
import {
	type CaseStudyFormValues,
	caseStudyFormSchema,
	getDefaultFormValues,
} from "./_form/form-schema";
import { useAuthorManagement } from "./_form/use-author-management";
import { useCaseStudyImage } from "./_form/use-case-study-image";
import RelatedAssuranceCaseList from "./related-assurance-case-list";

type CaseStudyFormProps = {
	caseStudy?: CaseStudyResponse;
	className?: string;
};

const CaseStudyForm = ({ caseStudy }: CaseStudyFormProps) => {
	const router = useRouter();

	const [value, setValue] = useState("");
	const [selectedAssuranceCases, setSelectedAssuranceCases] = useState<
		string[]
	>(
		caseStudy?.assuranceCases && caseStudy.assuranceCases.length > 0
			? caseStudy.assuranceCases.map((ac) => String(ac.id))
			: []
	);

	const [alertOpen, setAlertOpen] = useState(false);
	const [formValues, setFormValues] = useState<CaseStudyFormValues | null>(
		null
	);
	const [loading, setLoading] = useState(false);

	const form = useForm<CaseStudyFormValues>({
		resolver: zodResolver(caseStudyFormSchema),
		defaultValues: getDefaultFormValues(caseStudy),
		mode: "onBlur", // This enables real-time validation on blur
		reValidateMode: "onChange", // Re-validate on every change after initial blur
	});

	// Use author management helper
	const { authors, inputValue, setInputValue, addAuthor, removeAuthor } =
		useAuthorManagement(form);

	// Use image management helper
	const {
		previewImage,
		setPreviewImage,
		featuredImage,
		setFeaturedImage,
		uploadCaseStudyFeatureImage,
		deleteCaseStudyFeatureImage,
	} = useCaseStudyImage({ caseStudyId: caseStudy?.id, toast });

	async function onSubmit(values: CaseStudyFormValues) {
		if (caseStudy?.published) {
			setFormValues(values);
			setAlertOpen(true);
			return;
		}
		await handleSubmit(values);
	}

	function buildFormData(values: CaseStudyFormValues) {
		const formData = new FormData();

		formData.append("title", values.title);
		formData.append("description", values.description || "");
		formData.append("authors", values.authors || "");
		formData.append("last_modified_on", new Date().toISOString());
		formData.append("created_on", new Date().toISOString());
		formData.append("sector", values.sector || "");
		formData.append("type", values.type || "");
		formData.append("contact", values.contact || "");

		if (selectedAssuranceCases.length > 0) {
			formData.append(
				"assurance_cases",
				JSON.stringify(selectedAssuranceCases)
			);
		}

		return formData;
	}

	async function handleUpdateCaseStudy(
		values: CaseStudyFormValues,
		formData: FormData
	) {
		if (!caseStudy) {
			return;
		}

		formData.append("id", caseStudy.id.toString());
		const result = await updateCaseStudy(formData);

		if (values.image) {
			await uploadCaseStudyFeatureImage(caseStudy.id, values.image);
		}

		if (result.success) {
			toast({
				title: "Successfully Updated",
				description: "You have updated a case study!",
			});
		} else {
			toast({
				variant: "destructive",
				title: "Failed to Update",
				description: result.error || "Something went wrong!",
			});
		}
	}

	async function handleCreateCaseStudy(
		values: CaseStudyFormValues,
		formData: FormData
	) {
		const result = await createCaseStudy(formData);

		if (!result.success) {
			toast({
				title: "Error",
				description: result.error || "Failed to create case study",
				variant: "destructive",
			});
			return;
		}

		if (values.image) {
			await uploadCaseStudyFeatureImage(result.data.id, values.image);
		}

		toast({
			title: "Successfully created",
			description: "You have created a case study!",
		});

		router.push(`/dashboard/case-studies/${result.data.id}`);
	}

	async function handleSubmit(values: CaseStudyFormValues) {
		const formData = buildFormData(values);
		setLoading(true);

		try {
			if (caseStudy) {
				await handleUpdateCaseStudy(values, formData);
			} else {
				await handleCreateCaseStudy(values, formData);
			}
		} finally {
			setLoading(false);
		}
	}

	const handlePublish = async () => {
		if (!caseStudy) {
			return;
		}

		const formData = new FormData();
		formData.append("id", caseStudy.id.toString());
		formData.append(
			"assuranceCases",
			JSON.stringify(caseStudy.assuranceCases || [])
		);

		// Set only the fields that need updating
		if (caseStudy.published) {
			formData.append("published", "false"); // Convert boolean to string
			formData.append("publishedAt", ""); // Clear the published date
		} else {
			formData.append("published", "true"); // Convert boolean to string
			formData.append("publishedAt", new Date().toISOString()); // Set new date
		}

		// Send the formData to the API
		const result = await updateCaseStudy(formData);

		if (result.success) {
			toast({
				title: caseStudy.published
					? "Successfully Unpublished"
					: "Successfully Published",
				description: `You have ${caseStudy.published ? "unpublished" : "published"} your case study!`,
			});
		} else {
			toast({
				variant: "destructive",
				title: "Failed to Update",
				description: result.error || "Something went wrong!",
			});
		}
	};

	return (
		<>
			<div className="mt-6">
				<Separator className="my-6" />
				<Form {...form}>
					<form className="space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
						<BasicInformationSection form={form} />

						<Separator className="my-6" />

						<AuthorSection
							addAuthor={addAuthor}
							authors={authors}
							form={form}
							inputValue={inputValue}
							isPublished={caseStudy?.published ?? false}
							removeAuthor={removeAuthor}
							setInputValue={setInputValue}
						/>

						<Separator className="my-6" />

						<DescriptionSection form={form} setValue={setValue} value={value} />

						<Separator className="my-6" />

						{/* Related Assurance Cases Section */}
						<div className="space-y-6">
							<div>
								<h3 className="font-medium text-lg">Related Assurance Cases</h3>
								<p className="text-muted-foreground text-sm">
									Please select one or more assurance cases to link with this
									case study
								</p>
							</div>

							<RelatedAssuranceCaseList
								selectedAssuranceCases={selectedAssuranceCases}
								setSelectedAssuranceCases={setSelectedAssuranceCases}
							/>
						</div>

						<Separator className="my-6" />

						<FeaturedImageSection
							caseStudyId={caseStudy?.id}
							deleteCaseStudyFeatureImage={deleteCaseStudyFeatureImage}
							featuredImage={featuredImage}
							form={form}
							previewImage={previewImage}
							setFeaturedImage={setFeaturedImage}
							setPreviewImage={setPreviewImage}
						/>

						<Separator className="my-6" />

						<FormActions
							caseStudy={caseStudy}
							handlePublish={handlePublish}
							loading={loading}
						/>
					</form>
				</Form>
			</div>
			<AlertModal
				confirmButtonText="Update Anyway"
				isOpen={alertOpen}
				loading={loading}
				message="This case study is published. Updating it may affect the live version. Are you sure you want to proceed?"
				onClose={() => setAlertOpen(false)}
				onConfirm={async () => {
					setAlertOpen(false);
					if (formValues) {
						await handleSubmit(formValues);
					}
				}}
			/>
		</>
	);
};

export default CaseStudyForm;
