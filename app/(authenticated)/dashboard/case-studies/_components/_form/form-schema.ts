import { z } from "zod";
import type { CaseStudyFormProps } from "@/types/domain";

export const assuranceCaseSchema = z.object({
	id: z.string(),
});

export const caseStudyFormSchema = z.object({
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

export type CaseStudyFormValues = z.infer<typeof caseStudyFormSchema>;

// Helper function to get default values for the form
export const getDefaultFormValues = (
	caseStudy?: CaseStudyFormProps["caseStudy"]
): CaseStudyFormValues =>
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
