import { describe, expect, it } from "vitest";
import {
	registerIntegrationSchema,
	updateIntegrationSchema,
} from "../integration";
import {
	createTeamSchema,
	updateTeamBaseSchema,
	updateTeamSchema,
} from "../team";
import { updateUserProfileSchema } from "../user";

/**
 * Four fields can be cleared by an update: a user's first and last name, a
 * team's description and an integration's description. Absent means "not
 * given"; null, "" and spaces mean "remove the stored value".
 */

interface ClearableField {
	/** A second field that keeps the request non-empty when this one is absent. */
	companion: Record<string, unknown>;
	field: string;
	label: string;
	max: number;
	parse: (body: Record<string, unknown>) => {
		data?: Record<string, unknown>;
		success: boolean;
	};
}

const FIELDS: ClearableField[] = [
	{
		label: "user first name",
		field: "firstName",
		max: 150,
		companion: { username: "someone" },
		parse: (body) => updateUserProfileSchema.safeParse(body),
	},
	{
		label: "user last name",
		field: "lastName",
		max: 150,
		companion: { username: "someone" },
		parse: (body) => updateUserProfileSchema.safeParse(body),
	},
	{
		label: "team description (full rule)",
		field: "description",
		max: 500,
		companion: { name: "Team" },
		parse: (body) => updateTeamSchema.safeParse(body),
	},
	{
		label: "team description (form base rule)",
		field: "description",
		max: 500,
		companion: { name: "Team" },
		parse: (body) => updateTeamBaseSchema.safeParse(body),
	},
	{
		label: "integration description",
		field: "description",
		max: 1000,
		companion: { scopes: ["case:read"] },
		parse: (body) => updateIntegrationSchema.safeParse(body),
	},
];

const BLANKS: [string, unknown][] = [
	["null", null],
	["an empty string", ""],
	["one space", " "],
	["tabs and newlines", " \t\n "],
];

describe.each(FIELDS)("update rule: $label", (spec) => {
	it("reports an absent field as not given", () => {
		const result = spec.parse({ ...spec.companion });
		expect(result.success).toBe(true);
		expect(result.data).toBeDefined();
		expect(spec.field in (result.data ?? {})).toBe(false);
		expect(result.data?.[spec.field]).toBeUndefined();
	});

	it.each(BLANKS)("turns %s into null", (_name, value) => {
		const result = spec.parse({ ...spec.companion, [spec.field]: value });
		expect(result.success).toBe(true);
		expect(result.data?.[spec.field]).toBeNull();
	});

	it("accepts a request that only clears the field", () => {
		const result = spec.parse({ [spec.field]: null });
		expect(result.success).toBe(true);
		expect(result.data?.[spec.field]).toBeNull();
	});

	it("trims text it keeps", () => {
		const result = spec.parse({ [spec.field]: "  kept  " });
		expect(result.data?.[spec.field]).toBe("kept");
	});

	it("accepts text of exactly the maximum length", () => {
		const result = spec.parse({ [spec.field]: "a".repeat(spec.max) });
		expect(result.success).toBe(true);
	});

	it("refuses text one over the maximum length", () => {
		const result = spec.parse({ [spec.field]: "a".repeat(spec.max + 1) });
		expect(result.success).toBe(false);
	});
});

describe("update rules: a request with nothing to change", () => {
	const MESSAGE = "At least one field to update must be provided";

	it.each([
		["user profile", (b: object) => updateUserProfileSchema.safeParse(b)],
		["team", (b: object) => updateTeamSchema.safeParse(b)],
		["integration", (b: object) => updateIntegrationSchema.safeParse(b)],
	])("refuses an empty %s request", (_name, parse) => {
		const result = parse({});
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toBe(MESSAGE);
	});
});

describe("update rules: fields that still cannot be cleared", () => {
	it.each([
		["a null username", { username: null }],
		["an empty username", { username: "" }],
		["a username of spaces", { username: "   " }],
		["a null email", { email: null }],
		["an empty email", { email: "" }],
	])("refuses %s", (_name, body) => {
		expect(updateUserProfileSchema.safeParse(body).success).toBe(false);
	});

	it.each([
		["a null team name", { name: null }],
		["an empty team name", { name: "" }],
		["a team name of spaces", { name: "   " }],
	])("refuses %s", (_name, body) => {
		expect(updateTeamSchema.safeParse(body).success).toBe(false);
		expect(updateTeamBaseSchema.safeParse(body).success).toBe(false);
	});

	it("refuses clearing the scopes of an integration", () => {
		expect(updateIntegrationSchema.safeParse({ scopes: [] }).success).toBe(
			false
		);
		expect(updateIntegrationSchema.safeParse({ scopes: null }).success).toBe(
			false
		);
	});

	it("still refuses unknown keys", () => {
		expect(
			updateUserProfileSchema.safeParse({ firstName: null, extra: 1 }).success
		).toBe(false);
	});
});

describe("create rules: a blank description means none given", () => {
	it.each(BLANKS)("team creation with %s as description", (_name, value) => {
		const result = createTeamSchema.safeParse({
			name: "T",
			description: value,
		});
		expect(result.success).toBe(true);
		expect(result.data?.description).toBeUndefined();
	});

	it.each(
		BLANKS
	)("integration registration with %s as description", (_name, value) => {
		const result = registerIntegrationSchema.safeParse({
			name: "I",
			description: value,
			scopes: ["case:read"],
		});
		expect(result.success).toBe(true);
		expect(result.data?.description).toBeUndefined();
	});
});
