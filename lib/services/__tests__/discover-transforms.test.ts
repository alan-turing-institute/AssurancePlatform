import { describe, expect, it } from "vitest";
import type {
	PublishableItemDetail,
	PublishableItemSummary,
} from "@/lib/services/discover-service";
import {
	transformPublishableItemDetailForApi,
	transformPublishableItemForApi,
} from "../discover-transforms";

/**
 * `transformPublishableItemDetailForApi` is the single choke point both
 * `GET /api/public/discover/[slug]` and the Discover detail page's Download
 * JSON button (via `actions/discover.ts`) pass through — it must strip
 * `comments` (privacy fix, Chris's ruling 2026-08-11) wherever they sit in
 * `content`, including shapes that don't match today's tree structure (a
 * pre-fix, legacy-shaped snapshot).
 */

const BASE_SUMMARY: PublishableItemSummary = {
	id: "item-1",
	type: "ASSURANCE_CASE",
	slug: "worked-example",
	title: "Worked Example",
	description: "A worked example",
	sector: "Healthcare",
	authors: "Ada Lovelace",
	featureImageUrl: null,
	publishedAt: new Date("2026-08-01T00:00:00.000Z"),
};

function detailWith(content: unknown): PublishableItemDetail {
	return { ...BASE_SUMMARY, content };
}

describe("transformPublishableItemForApi", () => {
	it("carries the summary fields through, formatting publishedAt as ISO", () => {
		const result = transformPublishableItemForApi(BASE_SUMMARY);

		expect(result).toStrictEqual({
			id: "item-1",
			type: "ASSURANCE_CASE",
			slug: "worked-example",
			title: "Worked Example",
			description: "A worked example",
			sector: "Healthcare",
			authors: "Ada Lovelace",
			featureImageUrl: null,
			publishedAt: "2026-08-01T00:00:00.000Z",
		});
	});
});

describe("transformPublishableItemDetailForApi — comment stripping", () => {
	it("strips a top-level comments array from the tree root", () => {
		const item = detailWith({
			tree: {
				id: "el-1",
				name: "Goal",
				comments: [
					{ author: "alice", content: "Nice work", createdAt: "2026-08-01" },
				],
				children: [],
			},
		});

		const result = transformPublishableItemDetailForApi(item);

		expect(result.content).toStrictEqual({
			tree: { id: "el-1", name: "Goal", children: [] },
		});
	});

	it("strips comments nested arbitrarily deep — child elements and inline evidence", () => {
		const item = detailWith({
			tree: {
				id: "goal",
				name: "Goal",
				comments: [{ author: "alice", content: "root comment" }],
				children: [
					{
						id: "claim",
						name: "Claim",
						comments: [{ author: "bob@example.com", content: "claim comment" }],
						children: [
							{
								id: "evidence",
								name: "Evidence",
								comments: [
									{ author: "alice@example.com", content: "evidence comment" },
								],
								children: [],
							},
						],
					},
				],
			},
		});

		const result = transformPublishableItemDetailForApi(item);
		const serialised = JSON.stringify(result.content);

		expect(serialised).not.toContain("comment");
		expect(serialised).not.toContain("@example.com");
		expect(result.content).toStrictEqual({
			tree: {
				id: "goal",
				name: "Goal",
				children: [
					{
						id: "claim",
						name: "Claim",
						children: [
							{
								id: "evidence",
								name: "Evidence",
								children: [],
							},
						],
					},
				],
			},
		});
	});

	it("strips comments from a legacy-shaped snapshot that doesn't match the current tree/children structure", () => {
		const item = detailWith({
			// A pre-versioning export shape, kept only to prove the strip is
			// structural (any `comments` key) rather than tree-aware.
			goals: [
				{
					id: "g1",
					comments: [{ author: "legacy@example.com", content: "old shape" }],
					strategies: [
						{
							id: "s1",
							claims: [
								{
									id: "c1",
									comments: [{ author: "legacy2@example.com", content: "x" }],
								},
							],
						},
					],
				},
			],
		});

		const result = transformPublishableItemDetailForApi(item);
		const serialised = JSON.stringify(result.content);

		expect(serialised).not.toContain("comments");
		expect(serialised).not.toContain("@example.com");
	});

	it("leaves content with no comments at all unchanged", () => {
		const content = {
			tree: { id: "el-1", name: "Goal", children: [] },
			caseInformation: { description: "x", authors: "y", sector: "z" },
		};
		const item = detailWith(content);

		const result = transformPublishableItemDetailForApi(item);

		expect(result.content).toStrictEqual(content);
	});

	it("passes through non-object content (defensive — content is `unknown`) without throwing", () => {
		expect(transformPublishableItemDetailForApi(detailWith(null)).content).toBe(
			null
		);
		expect(
			transformPublishableItemDetailForApi(detailWith("not-an-object")).content
		).toBe("not-an-object");
	});
});

/**
 * `content.caseInformation.sector` (the frozen snapshot's own copy, embedded
 * inside the raw JSON returned to the public JSON API and the Discover
 * detail page's Download JSON button) must resolve to the full canonical
 * sector name exactly like the top-level `sector` field does — never the
 * bare stable ID a post-migration snapshot stores. Blocking finding from
 * review: `transformPublishableItemDetailForApi` was passing `content`
 * through with only `stripComments`, leaking the raw ID.
 */
describe("transformPublishableItemDetailForApi — sector resolution in content", () => {
	it("resolves a post-migration snapshot's stable-ID sector to its full name", () => {
		const item = detailWith({
			tree: { id: "el-1", name: "Goal", children: [] },
			caseInformation: {
				description: "x",
				authors: "y",
				sector: "15",
			},
		});

		const result = transformPublishableItemDetailForApi(item);

		expect(
			(result.content as { caseInformation: { sector: string } })
				.caseInformation.sector
		).toBe("Health & Social Care");
	});

	it("passes a pre-migration snapshot's already-canonical sector name through unchanged", () => {
		const item = detailWith({
			tree: { id: "el-1", name: "Goal", children: [] },
			caseInformation: {
				description: "x",
				authors: "y",
				sector: "Health & Social Care",
			},
		});

		const result = transformPublishableItemDetailForApi(item);

		expect(
			(result.content as { caseInformation: { sector: string } })
				.caseInformation.sector
		).toBe("Health & Social Care");
	});

	it("passes unmappable legacy free-text sector values through verbatim", () => {
		const item = detailWith({
			tree: { id: "el-1", name: "Goal", children: [] },
			caseInformation: {
				description: "x",
				authors: "y",
				sector: "Bespoke Legacy Sector Text",
			},
		});

		const result = transformPublishableItemDetailForApi(item);

		expect(
			(result.content as { caseInformation: { sector: string } })
				.caseInformation.sector
		).toBe("Bespoke Legacy Sector Text");
	});

	it("leaves content with no caseInformation.sector key untouched", () => {
		const content = {
			tree: { id: "el-1", name: "Goal", children: [] },
			caseInformation: { description: "x", authors: "y" },
		};
		const item = detailWith(content);

		const result = transformPublishableItemDetailForApi(item);

		expect(result.content).toStrictEqual(content);
	});
});
