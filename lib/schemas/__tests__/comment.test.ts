import { describe, expect, it } from "vitest";
import { issuesOf, outputOf } from "@/src/__tests__/utils/schema-issues-kit";
import {
	commentFormSchema,
	createCommentSchema,
	createElementCommentSchema,
	noteFormSchema,
	resolveCommentSchema,
	updateCommentSchema,
} from "../comment";

const PARENT = "3f2b8c1e-5d4a-4b6f-8a7c-9e0d1f2a3b4c";

describe.each([
	["createCommentSchema", createCommentSchema],
	["updateCommentSchema", updateCommentSchema],
])("%s content", (_name, schema) => {
	it("trims the content", () => {
		expect(outputOf(schema, { content: "  hello " })).toMatchObject({
			content: "hello",
		});
	});

	it("asks for content", () => {
		expect(issuesOf(schema, { content: "  " })).toEqual([
			"content: Content is required",
		]);
	});

	it("accepts 5000 characters and refuses 5001", () => {
		expect(issuesOf(schema, { content: "c".repeat(5000) })).toEqual([]);
		expect(issuesOf(schema, { content: "c".repeat(5001) })).toEqual([
			"content: Content must be less than 5000 characters",
		]);
	});
});

describe("createCommentSchema parent", () => {
	it("accepts a missing, null or valid parent and refuses a malformed one", () => {
		expect(issuesOf(createCommentSchema, { content: "a" })).toEqual([]);
		expect(
			issuesOf(createCommentSchema, { content: "a", parentId: null })
		).toEqual([]);
		expect(
			issuesOf(createCommentSchema, { content: "a", parentId: PARENT })
		).toEqual([]);
		expect(
			issuesOf(createCommentSchema, { content: "a", parentId: "x" })
		).toEqual(["parentId: Invalid ID format"]);
	});
});

describe("createElementCommentSchema", () => {
	it.each([
		["content", { content: "  hi " }],
		["the older comment field", { comment: " hi  " }],
	])("takes the text from %s, trimmed, with no parent", (_name, body) => {
		expect(outputOf(createElementCommentSchema, body)).toEqual({
			content: "hi",
			parentId: null,
		});
	});

	it("prefers content when both fields are given", () => {
		expect(
			outputOf(createElementCommentSchema, {
				content: "first",
				comment: "second",
			})
		).toEqual({ content: "first", parentId: null });
	});

	it("keeps a parent that is given", () => {
		expect(
			outputOf(createElementCommentSchema, { content: "a", parentId: PARENT })
		).toEqual({ content: "a", parentId: PARENT });
	});

	it.each([
		["neither field", {}],
		["only spaces", { content: "   " }],
		["an empty older field", { comment: "" }],
	])("asks for text when given %s", (_name, body) => {
		expect(issuesOf(createElementCommentSchema, body)).toEqual([
			"content: Comment content is required",
		]);
	});

	it("accepts a longer comment", () => {
		expect(
			issuesOf(createElementCommentSchema, { content: "long text" })
		).toEqual([]);
	});

	it("refuses a field it does not know", () => {
		expect(
			issuesOf(createElementCommentSchema, { content: "a", other: 1 })
		).not.toEqual([]);
	});
});

describe("resolveCommentSchema", () => {
	it("accepts true and false", () => {
		expect(outputOf(resolveCommentSchema, { resolved: true })).toEqual({
			resolved: true,
		});
		expect(outputOf(resolveCommentSchema, { resolved: false })).toEqual({
			resolved: false,
		});
	});

	it.each(["yes", 1, null])("refuses %j with a message", (resolved) => {
		expect(issuesOf(resolveCommentSchema, { resolved })).toEqual([
			"resolved: resolved must be a boolean",
		]);
	});
});

describe.each([
	["commentFormSchema", commentFormSchema, "comment", "Comment"],
	["noteFormSchema", noteFormSchema, "note", "Note"],
])("%s", (_name, schema, field, label) => {
	it("accepts 2 characters and refuses 1", () => {
		expect(issuesOf(schema, { [field]: "ab" })).toEqual([]);
		expect(issuesOf(schema, { [field]: "a" })).toEqual([
			`${field}: ${label} must be at least 2 characters`,
		]);
	});

	it("accepts 500 characters and refuses 501", () => {
		expect(issuesOf(schema, { [field]: "a".repeat(500) })).toEqual([]);
		expect(issuesOf(schema, { [field]: "a".repeat(501) })).toEqual([
			`${field}: ${label} must be less than 500 characters`,
		]);
	});
});
