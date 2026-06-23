/**
 * Unit tests for the getCaseStudyEntries filter/sort/link-building logic.
 *
 * PREREQUISITE: Aerith needs to export `getCaseStudyEntries` from
 * `components/docs/case-studies-index.tsx` (currently private).
 * Change:
 *   async function getCaseStudyEntries()
 * to:
 *   export async function getCaseStudyEntries()
 *
 * That single change is the only code modification required — the test
 * infrastructure (mocking nextra/page-map) is already in place below.
 *
 * Why bother with a unit test when there are e2e tests?
 * The e2e suite proves the page works end-to-end but cannot exercise
 * edge cases without real files on disk:
 *   - entries missing domain / assurance_goal (should be silently dropped)
 *   - tie-breaking when two entries share the same sidebar_position
 *   - underscore-prefixed names beyond _TEMPLATE/_workshop
 *   - MetaJsonFile / folder items in the page map (should be skipped)
 *   - href construction for slugs containing hyphens vs underscores
 * A pure-function unit test covers all of these cheaply.
 */

import type { MdxFile, PageMapItem } from "nextra";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock nextra/page-map *before* importing the module under test so that
// vi.mock hoisting takes effect.
// ---------------------------------------------------------------------------
vi.mock("nextra/page-map", () => ({
	getPageMap: vi.fn(),
}));

// Import the mock so we can configure return values per-test.
import { getPageMap } from "nextra/page-map";

// ---------------------------------------------------------------------------
// Import the function under test.
//
// NOTE: This import will fail until Aerith exports getCaseStudyEntries.
// When it fails, the error message makes the fix obvious:
//   "does not provide an export named 'getCaseStudyEntries'"
// ---------------------------------------------------------------------------
import { getCaseStudyEntries } from "../case-studies-index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMdxFile(
	name: string,
	frontMatter: Record<string, unknown> = {}
): MdxFile {
	return {
		kind: "MdxPage",
		name,
		route: `/docs/curriculum/hands-on/case-studies/${name}`,
		frontMatter,
	} as MdxFile;
}

// A MetaJsonFile entry (no `name` field — only `data`) — must be skipped.
const metaEntry: PageMapItem = {
	kind: "Meta",
	data: { index: "Case Studies" },
} as unknown as PageMapItem;

// Top-level regex constants (Biome useTopLevelRegex)
const RE_NO_RELATIVE_PREFIX = /^\.\./;

// A folder entry (has `children`) — must be skipped.
const folderEntry: PageMapItem = {
	kind: "Folder",
	name: "subfolder",
	route: "/docs/curriculum/hands-on/case-studies/subfolder",
	children: [],
} as unknown as PageMapItem;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getCaseStudyEntries", () => {
	beforeEach(() => {
		vi.mocked(getPageMap).mockResolvedValue([]);
	});

	it("returns an empty array when the page map is empty", async () => {
		vi.mocked(getPageMap).mockResolvedValue([]);
		const result = await getCaseStudyEntries();
		expect(result).toEqual([]);
	});

	it("excludes the index page", async () => {
		vi.mocked(getPageMap).mockResolvedValue([
			makeMdxFile("index", {
				title: "Case Studies",
				domain: "Meta",
				assurance_goal: "None",
			}),
		]);
		const result = await getCaseStudyEntries();
		expect(result).toHaveLength(0);
	});

	it("excludes underscore-prefixed files (_TEMPLATE, _workshop-evidence-mining)", async () => {
		vi.mocked(getPageMap).mockResolvedValue([
			makeMdxFile("_TEMPLATE", {
				title: "Template",
				domain: "Any",
				assurance_goal: "Any",
			}),
			makeMdxFile("_workshop-evidence-mining", {
				title: "Workshop",
				domain: "Any",
				assurance_goal: "Any",
			}),
		]);
		const result = await getCaseStudyEntries();
		expect(result).toHaveLength(0);
	});

	it("excludes entries without a domain field", async () => {
		vi.mocked(getPageMap).mockResolvedValue([
			makeMdxFile("no-domain", {
				title: "No Domain",
				assurance_goal: "Fairness",
				sidebar_position: 1,
			}),
		]);
		const result = await getCaseStudyEntries();
		expect(result).toHaveLength(0);
	});

	it("excludes entries without an assurance_goal field", async () => {
		vi.mocked(getPageMap).mockResolvedValue([
			makeMdxFile("no-goal", {
				title: "No Goal",
				domain: "Healthcare",
				sidebar_position: 1,
			}),
		]);
		const result = await getCaseStudyEntries();
		expect(result).toHaveLength(0);
	});

	it("skips MetaJsonFile entries (no `name` field)", async () => {
		vi.mocked(getPageMap).mockResolvedValue([
			metaEntry,
			makeMdxFile("valid", {
				title: "Valid",
				domain: "Healthcare",
				assurance_goal: "Explainability",
				sidebar_position: 1,
			}),
		]);
		const result = await getCaseStudyEntries();
		expect(result).toHaveLength(1);
	});

	it("skips folder entries (have `children`)", async () => {
		vi.mocked(getPageMap).mockResolvedValue([
			folderEntry,
			makeMdxFile("valid", {
				title: "Valid",
				domain: "Healthcare",
				assurance_goal: "Explainability",
				sidebar_position: 1,
			}),
		]);
		const result = await getCaseStudyEntries();
		expect(result).toHaveLength(1);
	});

	it("builds absolute href using /docs/curriculum/hands-on/case-studies/<slug>", async () => {
		vi.mocked(getPageMap).mockResolvedValue([
			makeMdxFile("diabetic-retinopathy-screening", {
				title: "Explainable Diabetic Retinopathy Screening System",
				domain: "Healthcare",
				assurance_goal: "Explainability",
				sidebar_position: 2,
			}),
		]);
		const result = await getCaseStudyEntries();
		expect(result[0]!.href).toBe(
			"/docs/curriculum/hands-on/case-studies/diabetic-retinopathy-screening"
		);
		// Must be absolute — no relative prefix
		expect(result[0]!.href).not.toMatch(RE_NO_RELATIVE_PREFIX);
	});

	it("sorts by sidebar_position ascending, then title alphabetically", async () => {
		vi.mocked(getPageMap).mockResolvedValue([
			makeMdxFile("c", {
				title: "C",
				domain: "X",
				assurance_goal: "Y",
				sidebar_position: 3,
			}),
			makeMdxFile("a", {
				title: "A",
				domain: "X",
				assurance_goal: "Y",
				sidebar_position: 1,
			}),
			makeMdxFile("b", {
				title: "B",
				domain: "X",
				assurance_goal: "Y",
				sidebar_position: 2,
			}),
		]);
		const result = await getCaseStudyEntries();
		expect(result.map((e) => e.slug)).toEqual(["a", "b", "c"]);
	});

	it("breaks sidebar_position ties by title alphabetically (case: positions 7+7)", async () => {
		// Mirrors the real data defect: explainable-atc-rl-agent and
		// clinical-genai-data-governance both have sidebar_position 7.
		vi.mocked(getPageMap).mockResolvedValue([
			makeMdxFile("explainable-atc-rl-agent", {
				title:
					"Explainable Reinforcement Learning Agent for Air Traffic Control",
				domain: "Aviation",
				assurance_goal: "Explainability",
				sidebar_position: 7,
			}),
			makeMdxFile("clinical-genai-data-governance", {
				title: "Transparent Clinical GenAI System with Legacy Data",
				domain: "Healthcare",
				assurance_goal: "Transparency",
				sidebar_position: 7,
			}),
		]);
		const result = await getCaseStudyEntries();
		// "Explainable..." < "Transparent..." alphabetically
		expect(result[0]!.slug).toBe("explainable-atc-rl-agent");
		expect(result[1]!.slug).toBe("clinical-genai-data-governance");
	});

	it("falls back to file.name as title when frontmatter title is absent", async () => {
		vi.mocked(getPageMap).mockResolvedValue([
			makeMdxFile("untitled-study", {
				domain: "Education",
				assurance_goal: "Fairness",
				sidebar_position: 5,
			}),
		]);
		const result = await getCaseStudyEntries();
		expect(result[0]!.title).toBe("untitled-study");
	});

	it("defaults sidebar_position to 999 when not provided", async () => {
		vi.mocked(getPageMap).mockResolvedValue([
			makeMdxFile("no-position", {
				title: "No Position",
				domain: "Agriculture",
				assurance_goal: "Fairness",
			}),
			makeMdxFile("has-position", {
				title: "Has Position",
				domain: "Agriculture",
				assurance_goal: "Fairness",
				sidebar_position: 1,
			}),
		]);
		const result = await getCaseStudyEntries();
		// has-position (1) should appear before no-position (999)
		expect(result[0]!.slug).toBe("has-position");
		expect(result[1]!.slug).toBe("no-position");
	});

	it("includes all 9 real case studies from fixture data", async () => {
		const fixtures = [
			{
				slug: "diabetic-retinopathy-screening",
				title: "Explainable Diabetic Retinopathy Screening System",
				domain: "Healthcare",
				assurance_goal: "Explainability",
				sidebar_position: 2,
			},
			{
				slug: "crop-damage-assessment",
				title: "Fair Crop Damage Assessment System",
				domain: "Agriculture",
				assurance_goal: "Fairness",
				sidebar_position: 3,
			},
			{
				slug: "flood-risk-assessment",
				title: "Equitable Flood Risk Assessment System",
				domain: "Environmental",
				assurance_goal: "Fairness",
				sidebar_position: 4,
			},
			{
				slug: "student-learning-assessment",
				title: "Explainable Student Learning Assessment System",
				domain: "Education",
				assurance_goal: "Explainability",
				sidebar_position: 5,
			},
			{
				slug: "personalised-pharmaceutical-formulations",
				title: "Equitable Personalised Pharmaceutical Formulation System",
				domain: "Pharmaceutical",
				assurance_goal: "Fairness",
				sidebar_position: 6,
			},
			{
				slug: "explainable-atc-rl-agent",
				title:
					"Explainable Reinforcement Learning Agent for Air Traffic Control",
				domain: "Aviation",
				assurance_goal: "Explainability",
				sidebar_position: 7,
			},
			{
				slug: "clinical-genai-data-governance",
				title: "Transparent Clinical GenAI System with Legacy Data",
				domain: "Healthcare",
				assurance_goal: "Transparency",
				sidebar_position: 7,
			},
			{
				slug: "adaptive-clinical-trial-allocation",
				title: "Safe Adaptive Allocation in a Bayesian Platform Clinical Trial",
				domain: "Healthcare",
				assurance_goal: "Safety",
				sidebar_position: 8,
			},
			{
				slug: "census-disclosure-control",
				title: "Balancing Privacy and Utility in Census Disclosure Control",
				domain: "Public Sector",
				assurance_goal: "Privacy",
				sidebar_position: 9,
			},
		];

		vi.mocked(getPageMap).mockResolvedValue([
			// Mix in exclusions to confirm they are filtered out
			makeMdxFile("index", {
				title: "Index",
				domain: "X",
				assurance_goal: "Y",
			}),
			makeMdxFile("_TEMPLATE", {
				title: "Template",
				domain: "X",
				assurance_goal: "Y",
			}),
			metaEntry,
			folderEntry,
			...fixtures.map(({ slug, ...fm }) => makeMdxFile(slug, fm)),
		]);

		const result = await getCaseStudyEntries();
		expect(result).toHaveLength(9);

		for (const fixture of fixtures) {
			const entry = result.find((e) => e.slug === fixture.slug);
			expect(entry, `entry for ${fixture.slug} should exist`).toBeDefined();
			expect(entry!.domain).toBe(fixture.domain);
			expect(entry!.assurance_goal).toBe(fixture.assurance_goal);
			expect(entry!.href).toBe(
				`/docs/curriculum/hands-on/case-studies/${fixture.slug}`
			);
		}
	});
});
