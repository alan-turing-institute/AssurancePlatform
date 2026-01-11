"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CloudDownload, InfoIcon, Share, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
	createCaseStudy,
	deleteCaseStudy,
	updateCaseStudy,
} from "@/actions/case-studies";
import { AlertModal } from "@/components/modals/alert-modal";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import TiptapEditor from "@/components/ui/tiptap-editor";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { sectors } from "@/config/index";
import { useImportModal } from "@/hooks/use-import-modal";
import { useToast } from "@/lib/toast";
import type { CaseStudyFormProps } from "@/types/domain";
import DeleteCaseButton from "./delete-button";
import RelatedAssuranceCaseList from "./related-assurance-case-list";

const assuranceCaseSchema = z.object({
	id: z.string(),
});

const caseStudyFormSchema = z.object({
	id: z.number().optional(), // Optional ID for new case studies
	title: z.string().min(1, "Title is required"), // Required
	description: z.string().min(1, "Description is required"), // Required
	authors: z.string().optional(),
	// category: z.string().optional(),
	type: z.string().optional(),
	publishedDate: z.coerce.date().optional(),
	lastModifiedOn: z.coerce.date().optional(),
	createdOn: z.coerce.date().optional(),
	sector: z.string().optional(),
	contact: z
		.string()
		.email("Please enter a valid email address")
		.optional()
		.or(z.literal("")),
	assuranceCases: z.array(assuranceCaseSchema).optional(),
	image: z.any().optional(),
	published: z.boolean().optional(),
});

// Helper function to get default values for the form
const getDefaultFormValues = (caseStudy?: CaseStudyFormProps["caseStudy"]) =>
	caseStudy
		? {
				id: caseStudy.id,
				title: caseStudy.title,
				description: caseStudy.description || "",
				authors: caseStudy.authors || "",
				publishedDate: caseStudy.publishedDate
					? new Date(caseStudy.publishedDate)
					: undefined,
				createdOn: caseStudy.createdOn
					? new Date(caseStudy.createdOn)
					: undefined,
				sector: caseStudy.sector || "",
				type: caseStudy.type || "",
				contact: caseStudy.contact || "",
				assuranceCases:
					caseStudy.assuranceCases?.map((ac) => ({ id: ac.id })) || [],
				published: caseStudy.published,
			}
		: {
				title: "",
				description: "",
				authors: "",
				publishedDate: undefined,
				lastModifiedOn: undefined,
				createdOn: undefined,
				sector: "",
				type: "",
				contact: "",
				assuranceCases: [],
				image: undefined,
				published: false,
			};

// Helper function for author management
const useAuthorManagement = (
	form: ReturnType<typeof useForm<z.infer<typeof caseStudyFormSchema>>>
) => {
	const [authors, setAuthors] = useState<string[]>([]);
	const [inputValue, setInputValue] = useState("");

	// Sync authors state with form field value
	useEffect(() => {
		const formAuthors = form.watch("authors");
		if (formAuthors) {
			const authorsArray = formAuthors
				.split(",")
				.map((a) => a.trim())
				.filter((a) => a);
			setAuthors(authorsArray);
		} else {
			setAuthors([]);
		}
	}, [form]);

	const addAuthor = () => {
		const trimmed = inputValue.trim();
		if (trimmed && !authors.includes(trimmed)) {
			const newAuthors = [...authors, trimmed];
			setAuthors(newAuthors);
			form.setValue("authors", newAuthors.join(", "));
			setInputValue(""); // Clear input
		}
	};

	const removeAuthor = (authorToRemove: string) => {
		const newAuthors = authors.filter((author) => author !== authorToRemove);
		setAuthors(newAuthors);
		form.setValue("authors", newAuthors.join(", "));
	};

	return {
		authors,
		inputValue,
		setInputValue,
		addAuthor,
		removeAuthor,
	};
};

const CaseStudyForm = ({ caseStudy }: CaseStudyFormProps) => {
	const { toast } = useToast();
	const router = useRouter();
	const _importModal = useImportModal();

	const [value, setValue] = useState("");
	const [selectedAssuranceCases, setSelectedAssuranceCases] = useState<
		string[]
	>([]);
	const [_imageLoading, setImageLoading] = useState<boolean>(true);
	const [previewImage, setPreviewImage] = useState("");
	const [featuredImage, setFeaturedImage] = useState("");

	const [alertOpen, setAlertOpen] = useState(false);
	const [_alertLoading, _setAlertLoading] = useState<boolean>(false);
	const [formValues, setFormValues] = useState<z.infer<
		typeof caseStudyFormSchema
	> | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (caseStudy?.assuranceCases && caseStudy.assuranceCases.length > 0) {
			setSelectedAssuranceCases(caseStudy.assurance_cases || []);
		} else {
			setSelectedAssuranceCases([]);
		}
	}, [caseStudy]);

	// 1. Define your form.
	const form = useForm<z.infer<typeof caseStudyFormSchema>>({
		resolver: zodResolver(caseStudyFormSchema),
		defaultValues: getDefaultFormValues(caseStudy),
		mode: "onBlur", // This enables real-time validation on blur
		reValidateMode: "onChange", // Re-validate on every change after initial blur
	});

	// Use author management helper
	const { authors, inputValue, setInputValue, addAuthor, removeAuthor } =
		useAuthorManagement(form);

	// 2. Define a submit handler.
	// async function onSubmit(values: z.infer<typeof caseStudyFormSchema>) {
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

	async function uploadCaseStudyFeatureImage(
		caseStudyId: number,
		imageFile: File
	) {
		const formData = new FormData();
		formData.append("image", imageFile);

		try {
			// Use internal API route - auth handled via NextAuth session cookies
			const response = await fetch(`/api/case-studies/${caseStudyId}/image`, {
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

	async function deleteCaseStudyFeatureImage(caseStudyId: number) {
		try {
			// Use internal API route - auth handled via NextAuth session cookies
			const response = await fetch(`/api/case-studies/${caseStudyId}/image`, {
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
			const response = await fetch(`/api/case-studies/${caseStudy?.id}/image`);

			if (response.status === 404) {
				setFeaturedImage("");
				return;
			}

			const result = await response.json();
			// Internal API returns the image path directly
			setFeaturedImage(result.image || "");
		} catch (_error) {
			// Silently handle error
		} finally {
			setImageLoading(false);
		}
	}, [caseStudy?.id]);

	useEffect(() => {
		if (caseStudy) {
			fetchFeaturedImage();
		}
	}, [caseStudy, fetchFeaturedImage]);

	async function onSubmit(values: z.infer<typeof caseStudyFormSchema>) {
		if (caseStudy?.published) {
			setFormValues(values);
			setAlertOpen(true);
			return;
		}
		await handleSubmit(values);
	}

	function buildFormData(values: z.infer<typeof caseStudyFormSchema>) {
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
		values: z.infer<typeof caseStudyFormSchema>,
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
		values: z.infer<typeof caseStudyFormSchema>,
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

	async function handleSubmit(values: z.infer<typeof caseStudyFormSchema>) {
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

	const _handleDelete = async () => {
		if (!caseStudy) {
			return;
		}
		const result = await deleteCaseStudy("", caseStudy.id);

		if (result.success) {
			toast({
				title: "Successfully Deleted",
				description: "Case Study Deleted",
			});
			router.push("/dashboard/case-studies");
		} else {
			toast({
				variant: "destructive",
				title: "Delete Failed",
				description: result.error || "Something went wrong!",
			});
		}
	};

	return (
		<>
			<div className="mt-6">
				<Separator className="my-6" />
				<TooltipProvider>
					<Form {...form}>
						<form className="space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
							{/* Basic Information Section */}
							<div className="space-y-6">
								<div>
									<h3 className="font-medium text-lg">Basic Information</h3>
									<p className="text-muted-foreground text-sm">
										Provide the essential details about your case study
									</p>
								</div>

								<div className="grid grid-cols-2 gap-8">
									<FormField
										control={form.control}
										name="title"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Title</FormLabel>
												<FormControl>
													<Input
														{...field}
														placeholder="Enter a descriptive title"
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
													<Select
														defaultValue={field.value}
														onValueChange={field.onChange}
													>
														<SelectTrigger>
															<SelectValue placeholder="Select sector" />
														</SelectTrigger>
														<SelectContent>
															{sectors.map((sector) => (
																<SelectItem key={sector.ID} value={sector.Name}>
																	{sector.Name}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									{/* <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} defaultValue={field.value} >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {["AI", "Business", "Health", "Education"].map((sector) => (
                              <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                /> */}
									<FormField
										control={form.control}
										name="type"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Type</FormLabel>
												<FormControl>
													<Select
														defaultValue={field.value}
														onValueChange={field.onChange}
													>
														<SelectTrigger>
															<SelectValue placeholder="Select type" />
														</SelectTrigger>
														<SelectContent>
															{["Assurance Case", "Argument Pattern"].map(
																(sector) => (
																	<SelectItem key={sector} value={sector}>
																		{sector}
																	</SelectItem>
																)
															)}
														</SelectContent>
													</Select>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</div>

							<Separator className="my-6" />

							{/* Author Information Section */}
							<div className="space-y-6">
								<div>
									<h3 className="font-medium text-lg">Author Information</h3>
									<p className="text-muted-foreground text-sm">
										Add all authors and specify contact details for
										correspondence
									</p>
								</div>

								<FormField
									control={form.control}
									name="authors"
									render={() => (
										<FormItem>
											<FormLabel>Authors</FormLabel>
											<FormDescription>
												List all authors who contributed to this case study
											</FormDescription>

											<div className="mb-2 flex items-center gap-2">
												<Input
													onChange={(e) => setInputValue(e.target.value)}
													onKeyDown={(e) => {
														if (e.key === "Enter") {
															e.preventDefault();
															addAuthor();
														}
													}}
													placeholder="Enter author name"
													value={inputValue}
												/>
												<Button
													onClick={addAuthor}
													type="button"
													variant="secondary"
												>
													Add Author
												</Button>
											</div>

											<div className="flex flex-wrap gap-2">
												{authors.map((author) => (
													<span
														className="flex items-center rounded-full bg-muted px-3 py-1.5 text-sm"
														key={author}
													>
														{author}
														{!caseStudy?.published && (
															<button
																className="ml-2 text-muted-foreground hover:text-destructive"
																onClick={() => removeAuthor(author)}
																type="button"
															>
																<X className="h-3 w-3" />
															</button>
														)}
													</span>
												))}
												{authors.length === 0 && (
													<span className="text-muted-foreground text-sm italic">
														No authors added yet
													</span>
												)}
											</div>

											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="contact"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Corresponding Author Email</FormLabel>
											<FormDescription>
												Email address of the author who will handle
												correspondence about this case study (should be one of
												the authors listed above)
											</FormDescription>
											<FormControl>
												<Input
													{...field}
													className="max-w-md"
													placeholder="author@example.com"
													type="email"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<Separator className="my-6" />

							{/* Description Section */}
							<div className="space-y-6">
								<div>
									<h3 className="font-medium text-lg">
										Case Study Description
									</h3>
									<p className="text-muted-foreground text-sm">
										Provide a detailed description of your case study
									</p>
								</div>

								<FormField
									control={form.control}
									name="description"
									render={({ field }) => (
										<FormItem>
											<div className="mb-2 flex items-center gap-1">
												<FormLabel>Description</FormLabel>
												<Tooltip>
													<TooltipTrigger asChild>
														<span>
															<InfoIcon className="h-4 w-4 cursor-pointer text-muted-foreground" />
														</span>
													</TooltipTrigger>
													<TooltipContent side="right">
														Provide a clear and concise summary of the case
														study.
													</TooltipContent>
												</Tooltip>
											</div>
											<FormControl>
												<TiptapEditor
													className="min-h-[200px]" // Ensure controlled component
													onChange={(content) => {
														field.onChange(content); // Update form state
														setValue(content);
													}}
													placeholder="Provide a clear and concise summary of the case study..."
													value={field.value || value}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<Separator className="my-6" />

							{/* Related Assurance Cases Section */}
							<div className="space-y-6">
								<div>
									<h3 className="font-medium text-lg">
										Related Assurance Cases
									</h3>
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

							{/* Featured Image Section */}
							<div className="space-y-6">
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
										if (featuredImage && caseStudy) {
											deleteCaseStudyFeatureImage(caseStudy.id);
										}
									}}
									value={previewImage || featuredImage}
								/>
							</div>

							<Separator className="my-6" />

							{/* Form Actions */}
							<div className="flex w-full items-center justify-between gap-4">
								<div className="flex items-center justify-start gap-2">
									{caseStudy && (
										<Button disabled={loading} type="submit" variant="default">
											Save Changes
										</Button>
									)}
									{!caseStudy && (
										<Button disabled={loading} type="submit" variant="default">
											Save
										</Button>
									)}
									{caseStudy && (
										<Button
											onClick={handlePublish}
											type="button"
											variant="default"
										>
											{caseStudy.published ? (
												<>
													<CloudDownload className="mr-2 size-4" />
													<span>Remove from Public</span>
												</>
											) : (
												<>
													<Share className="mr-2 size-4" />
													<span>Make Public</span>
												</>
											)}
										</Button>
									)}
								</div>
								{caseStudy && (
									<DeleteCaseButton
										caseStudyId={caseStudy.id}
										redirect
										variant="destructive"
									/>
								)}
								{/* <Button variant="destructive" onClick={handleDelete} type="button"><Trash2Icon className="size-4 mr-2"/>Delete</Button> */}
							</div>
						</form>
					</Form>
				</TooltipProvider>
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
