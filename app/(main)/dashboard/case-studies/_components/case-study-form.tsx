"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createCaseStudy, updateCaseStudy } from "@/actions/case-studies";
import { AlertModal } from "@/components/modals/alert-modal";
import { Form } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/lib/toast";
import type { CaseStudyFormProps } from "@/types/domain";
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

const CaseStudyForm = ({ caseStudy }: CaseStudyFormProps) => {
	const { toast } = useToast();
	const router = useRouter();

	const [value, setValue] = useState("");
	const [selectedAssuranceCases, setSelectedAssuranceCases] = useState<
		string[]
	>(
		caseStudy?.assuranceCases && caseStudy.assuranceCases.length > 0
			? caseStudy.assurance_cases || []
			: []
	);

	const [alertOpen, setAlertOpen] = useState(false);
	const [formValues, setFormValues] = useState<CaseStudyFormValues | null>(
		null
	);
	const [loading, setLoading] = useState(false);

	// 1. Define your form.
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

	// 2. Define a submit handler.
	// async function onSubmit(values: CaseStudyFormValues) {
	//   if (!caseStudy) {
	//     let newCaseStudy = {
	//       title: values.title,
	//       description: values.description,
	//       authors: values.authors,
	//       category: values.category,
	//       // published_date: values.publishedDate?.toISOString(),
	//       last_modified_on: new Date().toISOString(),
	//       created_on: new Date().toISOString(),
	//       sector: values.sector,
	//       contact: values.contact,
	//       // assurance_cases": [2, 5],
	//       // "image": "https://example.com/path-to-image.jpg",
	//     }

	//     const createdCaseStudy = await createCaseStudy(data?.key!!, newCaseStudy)

	//     if(createdCaseStudy) {
	//       toast({
	//         title: 'Successfully created',
	//         description: 'You have created a case study!',
	//       });
	//       router.back()
	//     }

	//   } else {
	//     let newCaseStudy = {
	//       id: caseStudy.id,
	//       title: values.title,
	//       description: values.description,
	//       authors: values.authors,
	//       category: values.category,
	//       // published_date: values.publishedDate?.toISOString(),
	//       last_modified_on: new Date().toISOString(),
	//       sector: values.sector,
	//       contact: values.contact,
	//       // assurance_cases": [2, 5],
	//       // "image": "https://example.com/path-to-image.jpg",
	//     }

	//     console.log(newCaseStudy)

	//     const updated = await updateCaseStudy(data?.key, newCaseStudy)

	//     if(updated) {
	//       toast({
	//         title: 'Successfully Updated',
	//         description: 'You have updated a case study!',
	//       });
	//     } else {
	//       toast({
	//         variant: "destructive",
	//         title: 'Failed to Update',
	//         description: 'Something went wrong!',
	//       });
	//     }
	//   }
	// }

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
		const result = await updateCaseStudy("", formData);

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
		const result = await createCaseStudy("", formData);

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
			"assurance_cases",
			JSON.stringify(caseStudy.assurance_cases || [])
		);

		// Set only the fields that need updating
		if (caseStudy.published) {
			formData.append("published", "false"); // Convert boolean to string
			formData.append("published_date", ""); // Clear the published date
		} else {
			formData.append("published", "true"); // Convert boolean to string
			formData.append("published_date", new Date().toISOString()); // Set new date
		}

		// Send the formData to the API
		const result = await updateCaseStudy("", formData);

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

							{/* <button
                  onClick={() => importModal.onOpen()}
                  className="inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500/40 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  <ArrowUpTrayIcon className="-ml-0.5 md:mr-1.5 size-4" aria-hidden="true" />
                  <span className='hidden md:block'>Import</span>
                </button> */}
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
