import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { listViewablePatterns } from "@/lib/services/case-from-pattern-service";
import { mockNoAuth } from "../utils/auth-helpers";
import { createStoredPattern } from "../utils/case-kind-kit";
import { createPublishedRow } from "../utils/pattern-start-kit";
import { createTestUser } from "../utils/prisma-factories";

/**
 * The descriptions the new-case dialog's picker shows. A published pattern's
 * description is stored as sanitised HTML but the picker shows text, so the
 * service lists it as plain text; the description of a pattern case is
 * already text and is listed as written.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const TAG = /<[^>]*>/;

beforeEach(async () => {
	await mockNoAuth();
});

async function publishedDescription(html: string | null) {
	const viewer = await createTestUser();
	await createPublishedRow({
		slug: "a-published-pattern",
		title: "A published pattern",
		description: html ?? "",
	});
	if (html === null) {
		await prisma.publishedAssuranceCase.updateMany({
			data: { description: null },
		});
	}
	const result = await listViewablePatterns(viewer.id);
	if (!("data" in result)) {
		throw new Error(`list failed: ${result.error}`);
	}
	const entry = result.data.find(
		(pattern) => pattern.key === "published:a-published-pattern"
	);
	if (!entry) {
		throw new Error("the published pattern was not listed");
	}
	return entry.description;
}

describe("the descriptions listed for published patterns", () => {
	it("lists formatting as the words it holds, without markup", async () => {
		const description = await publishedDescription(
			'<p>How a system treats <strong>groups</strong> alike</p><p>Second <a href="https://example.org/x">paragraph</a></p>'
		);

		expect(description).not.toMatch(TAG);
		expect(description).toContain("How a system treats groups alike");
		expect(description).toContain("Second paragraph");
		expect(description).not.toContain("alikeSecond");
		expect(description).not.toContain("example.org");
	});

	it("lists escaped characters as the characters themselves", async () => {
		const description = await publishedDescription(
			"<p>Fish &amp; chips, and 5 &lt; 6</p>"
		);

		expect(description).toContain("Fish & chips, and 5 < 6");
		expect(description).not.toContain("&amp;");
		expect(description).not.toContain("&lt;");
	});

	it("keeps the words of a list on separate lines or at least apart", async () => {
		const description = await publishedDescription(
			"<ul><li>First point</li><li>Second point</li></ul>"
		);

		expect(description).not.toMatch(TAG);
		expect(description).not.toContain("pointSecond");
		expect(description).toContain("First point");
		expect(description).toContain("Second point");
	});

	it("leaves no script or event handler in what it lists", async () => {
		const description = await publishedDescription(
			'<p>Safe words</p><script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">click</a>'
		);

		expect(description).toContain("Safe words");
		expect(description).not.toMatch(TAG);
		expect(description).not.toContain("onerror");
		expect(description).not.toContain("javascript:");
		expect(description).not.toContain("alert(1)");
	});

	it("lists text with no markup unchanged", async () => {
		expect(await publishedDescription("Just some plain words")).toBe(
			"Just some plain words"
		);
	});

	it.each([
		["no description", null],
		["an empty description", ""],
		["an empty paragraph", "<p></p>"],
	])("lists %s as an empty description", async (_label, stored) => {
		expect((await publishedDescription(stored)).trim()).toBe("");
	});
});

describe("the descriptions listed for pattern cases", () => {
	it("lists the description of a pattern case exactly as written, angle brackets and all", async () => {
		const owner = await createTestUser();
		const written = "Use when a < b && c > d, or when <angle> brackets matter";
		const pattern = await createStoredPattern(owner.id, "Own pattern");
		await prisma.assuranceCase.update({
			where: { id: pattern.id },
			data: { description: written },
		});

		const result = await listViewablePatterns(owner.id);

		if (!("data" in result)) {
			throw new Error(`list failed: ${result.error}`);
		}
		expect(result.data).toHaveLength(1);
		expect(result.data[0]?.description).toBe(written);
	});
});
