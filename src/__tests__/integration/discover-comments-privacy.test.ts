import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
	getPublishedItemBySlug,
	getPublishedItems,
} from "@/lib/services/discover-service";
import {
	transformPublishableItemDetailForApi,
	transformPublishableItemsForApi,
} from "@/lib/services/discover-transforms";
import { publishAssuranceCase } from "@/lib/services/publish-service";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestComment,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Privacy fix (Chris's ruling, 2026-08-11 — BOTH layers): published
 * snapshots used to capture case comments (including commenter emails), and
 * the public Discover surface served that `content` unfiltered. Covers the
 * capture-layer fix (`composeSnapshotContent` no longer includes comments in
 * NEW snapshots) and the serve-layer fix (`transformPublishableItemDetailForApi`
 * strips `comments` from ANY snapshot, including one published before the
 * capture-layer fix existed — simulated below by inserting a
 * `PublishedAssuranceCase` row directly).
 */

const COMMENT_BODY = "Should we add more detail here?";
const COMMENTER_EMAIL = "alice@example.com";

describe("Discover — comments never reach the public surface", () => {
	it("a freshly published snapshot never captures comments in the first place (capture-layer fix)", async () => {
		const owner = await createTestUser();
		const commenter = await createTestUser({ email: COMMENTER_EMAIL });
		const testCase = await createTestCase(owner.id, {
			name: "Commented Case — Fresh Publish",
		});
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "Goal",
			role: "TOP_LEVEL",
		});
		await createTestComment(commenter.id, {
			elementId: goal.id,
			content: COMMENT_BODY,
		});

		expectSuccess(await publishAssuranceCase(owner.id, testCase.id));

		// The raw stored snapshot itself has no comments — not just the public
		// response. This is the capture-layer half of the fix.
		const stored = await prisma.publishedAssuranceCase.findFirst({
			where: { assuranceCaseId: testCase.id, isCurrent: true },
		});
		const storedJson = JSON.stringify(stored?.content);
		expect(storedJson).not.toContain(COMMENT_BODY);
		expect(storedJson).not.toContain(COMMENTER_EMAIL);

		// The detail payload (serve layer) is clean too, redundantly.
		const item = expectSuccess(
			await getPublishedItemBySlug("commented-case-fresh-publish")
		);
		const detail = transformPublishableItemDetailForApi(item);
		const detailJson = JSON.stringify(detail.content);
		expect(detailJson).not.toContain(COMMENT_BODY);
		expect(detailJson).not.toContain(COMMENTER_EMAIL);

		// The list payload never carries `content` at all, so it's clean by
		// construction — asserted here so a future shape change that added
		// content to the summary would be caught.
		const items = expectSuccess(await getPublishedItems());
		const listJson = JSON.stringify(transformPublishableItemsForApi(items));
		expect(listJson).not.toContain(COMMENT_BODY);
		expect(listJson).not.toContain(COMMENTER_EMAIL);
	});

	it("strips comments from a legacy snapshot published before the capture-layer fix (serve-layer defence in depth)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			name: "Legacy Commented Case",
		});

		// Simulate a pre-fix snapshot: a `PublishedAssuranceCase` row inserted
		// directly with comments already embedded in `content`, bypassing
		// `composeSnapshotContent` entirely — exactly what a row published
		// before the capture-layer fix looks like.
		await prisma.publishedAssuranceCase.create({
			data: {
				assuranceCaseId: testCase.id,
				type: "ASSURANCE_CASE",
				slug: "legacy-commented-case",
				isCurrent: true,
				title: testCase.name,
				description: "A legacy snapshot with embedded comments",
				content: {
					version: "1.0",
					exportedAt: new Date().toISOString(),
					case: { name: testCase.name, description: testCase.description },
					tree: {
						id: "legacy-goal",
						type: "GOAL",
						name: "Legacy Goal",
						description: "A goal",
						inSandbox: false,
						children: [],
						comments: [
							{
								author: COMMENTER_EMAIL,
								content: COMMENT_BODY,
								createdAt: new Date().toISOString(),
							},
						],
					},
				},
			},
		});

		const item = expectSuccess(
			await getPublishedItemBySlug("legacy-commented-case")
		);
		// The raw stored row genuinely still has the comment — proves this
		// test simulates a real legacy row, not a no-op.
		expect(JSON.stringify(item.content)).toContain(COMMENT_BODY);

		const detail = transformPublishableItemDetailForApi(item);
		const detailJson = JSON.stringify(detail.content);
		expect(detailJson).not.toContain(COMMENT_BODY);
		expect(detailJson).not.toContain(COMMENTER_EMAIL);
		expect(detailJson).not.toContain("comments");

		// Structure survives the strip — only `comments` is gone.
		expect(detail.content).toStrictEqual({
			version: "1.0",
			exportedAt: expect.any(String),
			case: { name: testCase.name, description: testCase.description },
			tree: {
				id: "legacy-goal",
				type: "GOAL",
				name: "Legacy Goal",
				description: "A goal",
				inSandbox: false,
				children: [],
			},
		});
	});
});
