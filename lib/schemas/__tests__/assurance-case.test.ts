import { describe, expect, it } from "vitest";
import {
	createAssuranceCaseSchema,
	updateAssuranceCaseSchema,
} from "../assurance-case";

const firstMessage = (
	schema: { safeParse: (v: unknown) => unknown },
	value: unknown
) => {
	const result = schema.safeParse(value) as {
		success: boolean;
		error?: { issues: { message: string }[] };
	};
	return result.error?.issues[0]?.message;
};

describe("createAssuranceCaseSchema", () => {
	it("fills in the default colour profile and kind", () => {
		const parsed = createAssuranceCaseSchema.parse({
			name: "Case",
			description: "About it",
		});
		expect(parsed).toEqual({
			name: "Case",
			description: "About it",
			colourProfile: "default",
			kind: "CASE",
		});
	});

	it("keeps a colour profile and kind that are given", () => {
		const parsed = createAssuranceCaseSchema.parse({
			name: "Case",
			description: "About it",
			colourProfile: "ocean",
			kind: "PATTERN",
		});
		expect(parsed.colourProfile).toBe("ocean");
		expect(parsed.kind).toBe("PATTERN");
	});

	it("names the description when it is blank", () => {
		expect(
			firstMessage(createAssuranceCaseSchema, { name: "C", description: " " })
		).toBe("Description is required");
	});

	it.each([
		[5000, true],
		[5001, false],
	])("accepts a description of %i characters: %s", (length, ok) => {
		const result = createAssuranceCaseSchema.safeParse({
			name: "C",
			description: "d".repeat(length),
		});
		expect(result.success).toBe(ok);
	});

	it("says how long a description may be when it is too long", () => {
		expect(
			firstMessage(createAssuranceCaseSchema, {
				name: "C",
				description: "d".repeat(5001),
			})
		).toBe("Description must be less than 5000 characters");
	});
});

describe("updateAssuranceCaseSchema", () => {
	it("keeps each field that is given", () => {
		const input = {
			name: "Renamed",
			description: "New text",
			colourProfile: "ocean",
			layoutDirection: "LR",
		};
		expect(updateAssuranceCaseSchema.parse(input)).toEqual(input);
	});

	it("accepts an update that changes nothing", () => {
		expect(updateAssuranceCaseSchema.parse({})).toEqual({});
	});

	it.each([
		[0, false],
		[1, true],
		[5000, true],
		[5001, false],
	])("accepts a description of %i characters: %s", (length, ok) => {
		const result = updateAssuranceCaseSchema.safeParse({
			description: "d".repeat(length),
		});
		expect(result.success).toBe(ok);
	});

	it.each([
		["TB", true],
		["LR", true],
		["", false],
		["RL", false],
	])("accepts the layout direction %j: %s", (direction, ok) => {
		const result = updateAssuranceCaseSchema.safeParse({
			layoutDirection: direction,
		});
		expect(result.success).toBe(ok);
	});
});
