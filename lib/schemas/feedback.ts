import { z } from "zod";
import { emailSchema, requiredString } from "./base";

/**
 * Feedback form schema — used by the public feedback form.
 */
export const feedbackFormSchema = z.object({
	name: requiredString("Name", 2, 200),
	email: emailSchema,
	feedback: requiredString("Feedback", 2, 5000),
});

export type FeedbackFormInput = z.input<typeof feedbackFormSchema>;
export type FeedbackFormOutput = z.output<typeof feedbackFormSchema>;
