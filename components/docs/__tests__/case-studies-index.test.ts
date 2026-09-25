/**
 * Unit tests for the getCaseStudyEntries filter/sort/link-building logic.
 *
 * `getCaseStudyEntries` takes a `pages` array as its (defaulted) parameter,
 * so tests pass in fixture data directly — no module mocking of the
 * Fumadocs source is needed.
 *
 * Why bother with a unit test when there are e2e tests?
 * The e2e suite proves the page works end-to-end but cannot exercise
 * edge cases without real files on disk:
 *   - entries missing domain / assurance_goal (should be silently dropped)
 *   - tie-breaking when two entries share the same sidebar_position
 *   - pages outside the case-studies folder (should be skipped)
 *   - href construction for slugs containing hyphens
 * A pure-function unit test covers all of these cheaply.
 */

import { describe, expect, it } from "vitest";
import { getCaseStudyEntries } from "../case-studies-index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROUTE = "/docs/curriculum/case-studies";

function makePage(slug: string, data: Record<string, unknown> = {}) {
	return {
		url: `${ROUTE}/${slug}`,
		data: { title: slug, ...data } as {
			assurance_goal?: string;
			description?: string;
			domain?: string;
			sidebar_position?: number;
			title: string;
		},
	};
}

// Top-level regex constants (Biome useTopLevelRegex)
const RE_NO_RELATIVE_PREFIX = /^\.\./;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getCaseStudyEntries", () => {
	it("returns an empty array when there are no pages", () => {
		expect(getCaseStudyEntries([])).toEqual([]);
	});

	it("excludes the index page (url with no trailing segment)", () => {
		const result = getCaseStudyEntries([
			{
				url: ROUTE,
				data: { title: "Case Studies", domain: "Meta", assurance_goal: "None" },
			},
		]);
		expect(result).toHaveLength(0);
	});

	it("excludes pages outside the case-studies folder", () => {
		const result = getCaseStudyEntries([
			{
				url: "/docs/curriculum/index",
				data: { title: "Curriculum", domain: "Any", assurance_goal: "Any" },
			},
		]);
		expect(result).toHaveLength(0);
	});

	it("excludes nested pages (url containing a further slash)", () => {
		const result = getCaseStudyEntries([
			{
				url: `${ROUTE}/sub/nested`,
				data: { title: "Nested", domain: "Any", assurance_goal: "Any" },
			},
		]);
		expect(result).toHaveLength(0);
	});

	it("excludes entries without a domain field", () => {
		const result = getCaseStudyEntries([
			makePage("no-domain", {
				title: "No Domain",
				assurance_goal: "Fairness",
				sidebar_position: 1,
			}),
		]);
		expect(result).toHaveLength(0);
	});

	it("excludes entries without an assurance_goal field", () => {
		const result = getCaseStudyEntries([
			makePage("no-goal", {
				title: "No Goal",
				domain: "Healthcare",
				sidebar_position: 1,
			}),
		]);
		expect(result).toHaveLength(0);
	});

	it("builds absolute href using /docs/curriculum/case-studies/<slug>", () => {
		const result = getCaseStudyEntries([
			makePage("diabetic-retinopathy-screening", {
				title: "Explainable Diabetic Retinopathy Screening System",
				domain: "Healthcare",
				assurance_goal: "Explainability",
				sidebar_position: 2,
			}),
		]);
		expect(result[0]!.href).toBe(
			"/docs/curriculum/case-studies/diabetic-retinopathy-screening"
		);
		// Must be absolute — no relative prefix
		expect(result[0]!.href).not.toMatch(RE_NO_RELATIVE_PREFIX);
	});

	it("sorts by sidebar_position ascending, then title alphabetically", () => {
		const result = getCaseStudyEntries([
			makePage("c", {
				title: "C",
				domain: "X",
				assurance_goal: "Y",
				sidebar_position: 3,
			}),
			makePage("a", {
				title: "A",
				domain: "X",
				assurance_goal: "Y",
				sidebar_position: 1,
			}),
			makePage("b", {
				title: "B",
				domain: "X",
				assurance_goal: "Y",
				sidebar_position: 2,
			}),
		]);
		expect(result.map((e) => e.slug)).toEqual(["a", "b", "c"]);
	});

	it("breaks sidebar_position ties by title alphabetically (case: positions 7+7)", () => {
		// Mirrors the real data defect: explainable-atc-rl-agent and
		// clinical-genai-data-governance both have sidebar_position 7.
		const result = getCaseStudyEntries([
			makePage("explainable-atc-rl-agent", {
				title:
					"Explainable Reinforcement Learning Agent for Air Traffic Control",
				domain: "Aviation",
				assurance_goal: "Explainability",
				sidebar_position: 7,
			}),
			makePage("clinical-genai-data-governance", {
				title: "Transparent Clinical GenAI System with Legacy Data",
				domain: "Healthcare",
				assurance_goal: "Transparency",
				sidebar_position: 7,
			}),
		]);
		// "Explainable..." < "Transparent..." alphabetically
		expect(result[0]!.slug).toBe("explainable-atc-rl-agent");
		expect(result[1]!.slug).toBe("clinical-genai-data-governance");
	});

	it("defaults sidebar_position to 999 when not provided", () => {
		const result = getCaseStudyEntries([
			makePage("no-position", {
				title: "No Position",
				domain: "Agriculture",
				assurance_goal: "Fairness",
			}),
			makePage("has-position", {
				title: "Has Position",
				domain: "Agriculture",
				assurance_goal: "Fairness",
				sidebar_position: 1,
			}),
		]);
		expect(result[0]!.slug).toBe("has-position");
		expect(result[1]!.slug).toBe("no-position");
	});

	it("defaults description to an empty string when not provided", () => {
		const result = getCaseStudyEntries([
			makePage("no-description", {
				title: "No Description",
				domain: "Agriculture",
				assurance_goal: "Fairness",
			}),
		]);
		expect(result[0]!.description).toBe("");
	});

	it("includes all 10 real case studies from fixture data", () => {
		// Mirrors content/curriculum/case-studies/*.mdx (index and the
		// underscore-prefixed template are not represented — they never reach
		// getCaseStudyEntries via the real source, since source.config.ts
		// excludes underscore-prefixed files from the doc collection).
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
			{
				slug: "aerial-facial-recognition",
				title: "Equitable Identification in Aerial Facial Recognition",
				domain: "Security and Defence",
				assurance_goal: "Fairness",
				sidebar_position: 11,
			},
		];

		const result = getCaseStudyEntries(
			fixtures.map(({ slug, ...data }) => makePage(slug, data))
		);
		expect(result).toHaveLength(10);

		for (const fixture of fixtures) {
			const entry = result.find((e) => e.slug === fixture.slug);
			expect(entry, `entry for ${fixture.slug} should exist`).toBeDefined();
			expect(entry!.domain).toBe(fixture.domain);
			expect(entry!.assurance_goal).toBe(fixture.assurance_goal);
			expect(entry!.href).toBe(`${ROUTE}/${fixture.slug}`);
		}
	});
});
