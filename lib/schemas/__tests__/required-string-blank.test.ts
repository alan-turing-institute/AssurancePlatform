import { describe, expect, it } from "vitest";
import { createAssuranceCaseSchema } from "../assurance-case";
import { requiredString } from "../base";
import { createCommentSchema, updateCommentSchema } from "../comment";
import { feedbackFormSchema } from "../feedback";
import { registerIntegrationSchema } from "../integration";
import { createTeamSchema } from "../team";
import { updateUserProfileSchema } from "../user";

/**
 * A value made only of spaces is as empty as "" for every field that uses the
 * shared required-string rule, and padding around a real value is dropped.
 */
describe("requiredString — blank values", () => {
	it("refuses spaces as a case name, naming the field", () => {
		const result = createAssuranceCaseSchema.safeParse({
			name: "   ",
			description: "About it",
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe("Case name is required");
		}
	});

	it("stores a padded case name trimmed", () => {
		const result = createAssuranceCaseSchema.safeParse({
			name: " X ",
			description: "About it",
		});
		expect(result.success && result.data.name).toBe("X");
	});

	it("refuses spaces as a comment", () => {
		expect(createCommentSchema.safeParse({ content: "   " }).success).toBe(
			false
		);
		expect(updateCommentSchema.safeParse({ content: "   " }).success).toBe(
			false
		);
	});

	it("refuses spaces as a team name", () => {
		expect(createTeamSchema.safeParse({ name: "   " }).success).toBe(false);
	});

	it("refuses spaces as an integration name", () => {
		expect(
			registerIntegrationSchema.safeParse({
				name: "   ",
				scopes: ["case:read"],
			}).success
		).toBe(false);
	});

	it("refuses spaces as a username", () => {
		expect(updateUserProfileSchema.safeParse({ username: "   " }).success).toBe(
			false
		);
	});

	it("refuses a feedback name of one letter padded with spaces", () => {
		const result = feedbackFormSchema.safeParse({
			name: " a ",
			email: "a@example.com",
			feedback: "Something useful",
		});
		expect(result.success).toBe(false);
	});

	it("measures the length limit on the trimmed value", () => {
		const schema = requiredString("Field", 1, 5);
		expect(schema.safeParse("  abcde  ").success).toBe(true);
		expect(schema.safeParse("abcdef").success).toBe(false);
	});
});
