import { describe, expect, it } from "vitest";
import { issuesOf, outputOf } from "@/src/__tests__/utils/schema-issues-kit";
import { backupToDriveSchema, importFromDriveSchema } from "../google-drive";

const CASE_ID = "3f2b8c1e-5d4a-4b6f-8a7c-9e0d1f2a3b4c";

describe("backupToDriveSchema", () => {
	it("includes comments unless told otherwise", () => {
		expect(outputOf(backupToDriveSchema, { caseId: CASE_ID })).toEqual({
			caseId: CASE_ID,
			includeComments: true,
		});
		expect(
			outputOf(backupToDriveSchema, { caseId: CASE_ID, includeComments: false })
		).toEqual({ caseId: CASE_ID, includeComments: false });
	});

	it("refuses a case id that is not an identifier, with a message", () => {
		expect(issuesOf(backupToDriveSchema, { caseId: "nope" })).toEqual([
			"caseId: Invalid case ID",
		]);
	});
});

describe("importFromDriveSchema", () => {
	it("accepts a file id of one character", () => {
		expect(issuesOf(importFromDriveSchema, { fileId: "a" })).toEqual([]);
	});

	it("asks for a file id", () => {
		expect(issuesOf(importFromDriveSchema, { fileId: "" })).toEqual([
			"fileId: File ID is required",
		]);
	});
});
