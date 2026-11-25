import { describe, expect, it } from "vitest";
import { issuesOf, outputOf } from "@/src/__tests__/utils/schema-issues-kit";
import { GitHubImportSchema } from "../github-import";

describe("GitHubImportSchema", () => {
	it("accepts a web address alone and keeps it unchanged", () => {
		expect(outputOf(GitHubImportSchema, { url: "org/repo/case.json" })).toEqual(
			{
				url: "org/repo/case.json",
			}
		);
	});

	it("keeps the owner, repository, path and branch when given", () => {
		const body = {
			url: "u",
			owner: "org",
			repo: "repo",
			path: "a/b.json",
			branch: "main",
		};
		expect(outputOf(GitHubImportSchema, body)).toEqual(body);
	});

	it("asks for a web address", () => {
		expect(issuesOf(GitHubImportSchema, { url: "" })).toEqual([
			"url: GitHub URL is required",
		]);
	});

	it("refuses a body with no web address or with a field it does not know", () => {
		expect(issuesOf(GitHubImportSchema, {})).not.toEqual([]);
		expect(issuesOf(GitHubImportSchema, { url: "u", extra: 1 })).not.toEqual(
			[]
		);
	});
});
