import { describe, expect, it } from "vitest";
import { issuesOf, outputOf } from "@/src/__tests__/utils/schema-issues-kit";
import { feedbackFormSchema } from "../feedback";

const form = (fields: Record<string, unknown>) => ({
	name: "Ada",
	email: "Ada@Example.org",
	feedback: "It works",
	...fields,
});

describe("feedbackFormSchema", () => {
	it("trims the text fields and lower-cases the email", () => {
		expect(
			outputOf(feedbackFormSchema, form({ name: " Ada ", feedback: " ok " }))
		).toEqual({ name: "Ada", email: "ada@example.org", feedback: "ok" });
	});

	it("asks for a name of at least 2 characters", () => {
		expect(issuesOf(feedbackFormSchema, form({ name: "A" }))).toEqual([
			"name: Name is required",
		]);
	});

	it("asks for feedback of at least 2 characters", () => {
		expect(issuesOf(feedbackFormSchema, form({ feedback: "x" }))).toEqual([
			"feedback: Feedback is required",
		]);
	});

	it("accepts a name of 200 characters and refuses 201", () => {
		expect(
			issuesOf(feedbackFormSchema, form({ name: "n".repeat(200) }))
		).toEqual([]);
		expect(
			issuesOf(feedbackFormSchema, form({ name: "n".repeat(201) }))
		).toEqual(["name: Name must be less than 200 characters"]);
	});

	it("accepts feedback of 5000 characters and refuses 5001", () => {
		expect(
			issuesOf(feedbackFormSchema, form({ feedback: "f".repeat(5000) }))
		).toEqual([]);
		expect(
			issuesOf(feedbackFormSchema, form({ feedback: "f".repeat(5001) }))
		).toEqual(["feedback: Feedback must be less than 5000 characters"]);
	});
});
