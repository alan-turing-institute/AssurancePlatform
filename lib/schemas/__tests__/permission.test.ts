import { describe, expect, it } from "vitest";
import { issuesOf, outputOf } from "@/src/__tests__/utils/schema-issues-kit";
import {
	shareByEmailSchema,
	sharePermissionSchema,
	shareTypeDiscriminatorSchema,
	shareWithTeamSchema,
	updatePermissionSchema,
} from "../permission";

const TEAM_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("shareByEmailSchema", () => {
	it.each([
		["no type", { email: "a@b.co", permission: "VIEW" }],
		["type user", { type: "user", email: "a@b.co", permission: "EDIT" }],
	])("accepts a share with %s", (_name, input) => {
		expect(issuesOf(shareByEmailSchema, input)).toEqual([]);
	});

	it("lowercases the address", () => {
		expect(
			outputOf(shareByEmailSchema, { email: "A@B.CO", permission: "VIEW" })
		).toEqual({ email: "a@b.co", permission: "VIEW" });
	});

	it("refuses the team type", () => {
		const input = { type: "team", email: "a@b.co", permission: "VIEW" };
		expect(issuesOf(shareByEmailSchema, input)).toHaveLength(1);
	});

	it("names an unknown permission level", () => {
		expect(
			issuesOf(shareByEmailSchema, { email: "a@b.co", permission: "OWNER" })
		).toEqual(["permission: Invalid permission level"]);
	});
});

describe("shareWithTeamSchema", () => {
	it("accepts a team share", () => {
		const input = { type: "team", teamId: TEAM_ID, permission: "COMMENT" };
		expect(outputOf(shareWithTeamSchema, input)).toEqual(input);
	});

	it.each([
		["no type", { teamId: TEAM_ID, permission: "VIEW" }],
		["type user", { type: "user", teamId: TEAM_ID, permission: "VIEW" }],
	])("refuses a share with %s", (_name, input) => {
		expect(issuesOf(shareWithTeamSchema, input)).toHaveLength(1);
	});
});

describe("shareTypeDiscriminatorSchema", () => {
	it("keeps every key of the body it peeks at", () => {
		const body = { type: "team", teamId: TEAM_ID };
		expect(outputOf(shareTypeDiscriminatorSchema, body)).toEqual(body);
	});

	it("accepts a body with no type", () => {
		expect(issuesOf(shareTypeDiscriminatorSchema, { a: 1 })).toEqual([]);
	});

	it("refuses a type that is not text", () => {
		expect(issuesOf(shareTypeDiscriminatorSchema, { type: 5 })).toHaveLength(1);
	});
});

describe("sharePermissionSchema", () => {
	it("accepts a team share", () => {
		const input = { type: "team", teamId: TEAM_ID, permission: "EDIT" };
		expect(outputOf(sharePermissionSchema, input)).toEqual(input);
	});

	it("accepts a user share", () => {
		const input = { type: "user", email: "a@b.co", permission: "EDIT" };
		expect(outputOf(sharePermissionSchema, input)).toEqual(input);
	});

	it.each([
		["no type", { email: "a@b.co", permission: "EDIT" }],
		["an unknown type", { type: "group", email: "a@b.co", permission: "EDIT" }],
	])("refuses a share with %s", (_name, input) => {
		expect(issuesOf(sharePermissionSchema, input)).toHaveLength(1);
	});
});

describe("updatePermissionSchema", () => {
	it.each([
		{ permission: "ADMIN" },
		{ permission: "VIEW", type: "user" },
		{ permission: "VIEW", type: "team" },
	])("accepts %j", (input) => {
		expect(outputOf(updatePermissionSchema, input)).toEqual(input);
	});

	it("refuses an unknown type", () => {
		const input = { permission: "VIEW", type: "group" };
		expect(issuesOf(updatePermissionSchema, input)).toHaveLength(1);
	});

	it("names an unknown permission level", () => {
		expect(issuesOf(updatePermissionSchema, { permission: "OWNER" })).toEqual([
			"permission: Invalid permission level",
		]);
	});
});
