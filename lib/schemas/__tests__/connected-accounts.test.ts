import { describe, expect, it } from "vitest";
import { issuesOf, outputOf } from "@/src/__tests__/utils/schema-issues-kit";
import { ProviderSchema } from "../connected-accounts";

describe("ProviderSchema", () => {
	it.each(["github", "google"])("accepts %s", (provider) => {
		expect(outputOf(ProviderSchema, provider)).toBe(provider);
	});

	it.each(["gitlab", "", "GitHub"])("refuses %j", (provider) => {
		expect(issuesOf(ProviderSchema, provider)).not.toEqual([]);
	});
});
