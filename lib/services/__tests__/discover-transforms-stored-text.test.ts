import { describe, expect, it } from "vitest";
import type { PublishableItemDetail } from "@/lib/services/discover-service";
import { transformPublishableItemDetailForApi } from "../discover-transforms";

/**
 * The public item route's documentation says its text comes back exactly as
 * the publisher stored it, without cleaning, so a reader must treat it as
 * untrusted markup. These tests hold the code to what the documentation says.
 */

const MARKUP =
	'<div class="fixed inset-0 z-50"><p class="x" onclick="alert(1)">Text <script>alert(1)</script> <a href="javascript:alert(1)" class="y">link</a> <img src=x onerror=alert(1)></p></div>';

function detail(content: unknown): PublishableItemDetail {
	return {
		id: "item-1",
		type: "ASSURANCE_CASE",
		slug: "worked-example",
		title: "Worked Example",
		description: MARKUP,
		sector: "Healthcare",
		authors: "Ada Lovelace",
		featureImageUrl: null,
		publishedAt: new Date("2026-08-01T00:00:00.000Z"),
		archivedAt: null,
		content,
	};
}

describe("the public item response carries text as stored", () => {
	it("returns the item description unchanged, markup and attributes included", () => {
		const result = transformPublishableItemDetailForApi(detail({}));

		expect(result.description).toBe(MARKUP);
	});

	it("returns every description inside the content unchanged", () => {
		const content = {
			caseInformation: { description: MARKUP, name: MARKUP },
			tree: {
				id: "goal-1",
				type: "GOAL",
				name: MARKUP,
				description: MARKUP,
				context: [MARKUP],
				assumption: MARKUP,
				justification: MARKUP,
				children: [
					{
						id: "evidence-1",
						type: "EVIDENCE",
						name: "E1",
						description: MARKUP,
						url: "javascript:alert(1)",
						children: [],
					},
				],
			},
		};

		const result = transformPublishableItemDetailForApi(detail(content));

		expect(result.content).toEqual(content);
	});
});
