import { describe, expect, it } from "vitest";
import {
	getPublishedItemBySlug,
	getPublishedItems,
} from "@/lib/services/discover-service";
import {
	publishAssuranceCase,
	unpublishAssuranceCase,
	updatePublishedCase,
} from "@/lib/services/publish-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCaseInformation,
	createTestCaseWithGoal,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Discover reads exclusively from `PublishedAssuranceCase` (ADR 0003 §3/§4)
 * — these tests exercise that read path directly, independent of the
 * Discover pages themselves.
 */

describe("getPublishedItems", () => {
	it("lists a published case with its curated case information", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Listed Case");
		await createTestCaseInformation(testCase.id, {
			description: "A curated public description",
			authors: "Ada Lovelace",
			sector: "Healthcare",
			featureImageUrl: "https://example.com/feature.png",
		});
		await publishAssuranceCase(owner.id, testCase.id);

		const items = expectSuccess(await getPublishedItems());
		const item = items.find((i) => i.title === "Listed Case");

		expect(item).toBeDefined();
		expect(item?.type).toBe("ASSURANCE_CASE");
		expect(item?.slug).toBe("listed-case");
		expect(item?.description).toBe("A curated public description");
		expect(item?.authors).toBe("Ada Lovelace");
		expect(item?.sector).toBe("Healthcare");
		expect(item?.featureImageUrl).toBe("https://example.com/feature.png");
	});

	it("resolves a stored stable sector ID to its full canonical name (never the raw ID)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "ID Sector Case");
		await createTestCaseInformation(testCase.id, {
			description: "Sector stored by ID",
			// 15 = "Health & Social Care" in lib/sectors.ts.
			sector: "15",
		});
		await publishAssuranceCase(owner.id, testCase.id);

		const items = expectSuccess(await getPublishedItems());
		const item = items.find((i) => i.title === "ID Sector Case");

		expect(item?.sector).toBe("Health & Social Care");
	});

	it("falls back to the case's own description when there is no case information", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Bare Case");
		await publishAssuranceCase(owner.id, testCase.id);

		const items = expectSuccess(await getPublishedItems());
		const item = items.find((i) => i.title === "Bare Case");

		expect(item).toBeDefined();
		expect(item?.description).toBe(testCase.description);
		expect(item?.sector).toBeNull();
		expect(item?.authors).toBeNull();
		expect(item?.featureImageUrl).toBeNull();
	});

	it("does not list an unpublished (draft) case", async () => {
		const owner = await createTestUser();
		await createTestCaseWithGoal(owner.id, "Never Published Case");

		const items = expectSuccess(await getPublishedItems());
		expect(items.some((i) => i.title === "Never Published Case")).toBe(false);
	});

	it("does not list a case after it has been unpublished", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Unpublished Case");
		await publishAssuranceCase(owner.id, testCase.id);
		await unpublishAssuranceCase(owner.id, testCase.id);

		const items = expectSuccess(await getPublishedItems());
		expect(items.some((i) => i.title === "Unpublished Case")).toBe(false);
	});

	it("lists only the current version after a republish, not the superseded one", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Republished Case");
		await publishAssuranceCase(owner.id, testCase.id);
		await updatePublishedCase(owner.id, testCase.id, "Second release");

		const items = expectSuccess(await getPublishedItems());
		const matches = items.filter((i) => i.title === "Republished Case");
		expect(matches).toHaveLength(1);
	});
});

describe("getPublishedItemBySlug", () => {
	it("returns the published item for its slug", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Sluggable Case");
		await createTestCaseInformation(testCase.id, {
			description: "Findable by slug",
		});
		await publishAssuranceCase(owner.id, testCase.id);

		const item = expectSuccess(await getPublishedItemBySlug("sluggable-case"));
		expect(item.title).toBe("Sluggable Case");
		expect(item.description).toBe("Findable by slug");
		expect(item.content).toBeDefined();
	});

	it("returns an error for a slug that doesn't exist", async () => {
		expectError(
			await getPublishedItemBySlug("no-such-slug"),
			"Published item not found"
		);
	});

	it("returns an error for a numeric-looking slug that was never published (retired /discover/[id] path)", async () => {
		expectError(
			await getPublishedItemBySlug("123"),
			"Published item not found"
		);
	});

	it("carries the slug forward across a republish, serving the newest content", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(
			owner.id,
			"Carried Slug Case"
		);
		const first = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		await updatePublishedCase(owner.id, testCase.id, "Second release");

		const item = expectSuccess(
			await getPublishedItemBySlug("carried-slug-case")
		);
		expect(item.id).not.toBe(first.publishedId);
	});

	it("returns an error for a slug that has been unpublished", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Gone Case");
		await publishAssuranceCase(owner.id, testCase.id);
		await unpublishAssuranceCase(owner.id, testCase.id);

		expectError(
			await getPublishedItemBySlug("gone-case"),
			"Published item not found"
		);
	});
});
