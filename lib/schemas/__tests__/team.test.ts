import { describe, expect, it } from "vitest";
import {
	emailOfLength,
	issuesOf,
	outputOf,
} from "@/src/__tests__/utils/schema-issues-kit";
import {
	addTeamMemberSchema,
	createTeamSchema,
	updateMemberRoleSchema,
	updateTeamBaseSchema,
	updateTeamSchema,
} from "../team";

const NOTHING_TO_UPDATE = ": At least one field to update must be provided";

describe("createTeamSchema", () => {
	it("trims the name and drops a blank description", () => {
		expect(
			outputOf(createTeamSchema, { name: " Team ", description: "  " })
		).toEqual({ name: "Team", description: undefined });
	});

	it("asks for a name", () => {
		expect(issuesOf(createTeamSchema, { name: " " })).toEqual([
			"name: Team name is required",
		]);
	});

	it("accepts a name of 100 characters and refuses 101", () => {
		expect(issuesOf(createTeamSchema, { name: "n".repeat(100) })).toEqual([]);
		expect(issuesOf(createTeamSchema, { name: "n".repeat(101) })).toEqual([
			"name: Team name must be less than 100 characters",
		]);
	});

	it("accepts a description of 500 characters and refuses 501", () => {
		const team = (description: string) => ({ name: "n", description });
		expect(issuesOf(createTeamSchema, team("d".repeat(500)))).toEqual([]);
		expect(issuesOf(createTeamSchema, team("d".repeat(501)))).toEqual([
			"description: Must be less than 500 characters",
		]);
	});
});

describe("updateTeamBaseSchema", () => {
	it("accepts an empty update", () => {
		expect(issuesOf(updateTeamBaseSchema, {})).toEqual([]);
	});

	it("asks for a name when one is given blank", () => {
		expect(issuesOf(updateTeamBaseSchema, { name: "" })).toEqual([
			"name: Team name is required",
		]);
	});
});

describe("updateTeamSchema", () => {
	it.each([
		["a name", { name: "New" }],
		["a description", { description: "About" }],
		["a name and a blank description", { name: "New", description: "" }],
	])("accepts an update with %s", (_name, input) => {
		expect(issuesOf(updateTeamSchema, input)).toEqual([]);
	});

	it.each([
		["nothing", {}],
		["only a blank description", { description: "" }],
	])("refuses an update with %s", (_name, input) => {
		expect(issuesOf(updateTeamSchema, input)).toEqual([NOTHING_TO_UPDATE]);
	});

	it("asks for a name when one is given blank", () => {
		expect(issuesOf(updateTeamSchema, { name: "" })).toEqual([
			"name: Team name is required",
		]);
	});
});

describe("updateMemberRoleSchema", () => {
	it.each(["ADMIN", "MEMBER"])("accepts the role %s", (role) => {
		expect(outputOf(updateMemberRoleSchema, { role })).toEqual({ role });
	});

	it("names an unknown role", () => {
		expect(issuesOf(updateMemberRoleSchema, { role: "OWNER" })).toEqual([
			"role: Invalid team role",
		]);
	});
});

describe("addTeamMemberSchema", () => {
	it("lowercases the address and leaves the role out when none is given", () => {
		expect(outputOf(addTeamMemberSchema, { email: "A@B.CO" })).toEqual({
			email: "a@b.co",
		});
	});

	it.each(["ADMIN", "MEMBER"])("accepts the role %s", (role) => {
		expect(outputOf(addTeamMemberSchema, { email: "a@b.co", role })).toEqual({
			email: "a@b.co",
			role,
		});
	});

	it("names an unknown role", () => {
		expect(
			issuesOf(addTeamMemberSchema, { email: "a@b.co", role: "OWNER" })
		).toEqual(["role: Invalid team role"]);
	});

	it("asks for an email when the field is empty", () => {
		expect(issuesOf(addTeamMemberSchema, { email: "" })).toContain(
			"email: Email is required"
		);
	});

	it("rejects text that is not an address", () => {
		expect(issuesOf(addTeamMemberSchema, { email: "not-an-email" })).toEqual([
			"email: Please enter a valid email address",
		]);
	});

	it("accepts an address of 254 characters and refuses 255", () => {
		expect(
			issuesOf(addTeamMemberSchema, { email: emailOfLength(254) })
		).toEqual([]);
		expect(
			issuesOf(addTeamMemberSchema, { email: emailOfLength(255) })
		).toEqual(["email: Email must be less than 254 characters"]);
	});
});
