import { describe, expect, it } from "vitest";
import { tocDepthForUrl } from "../toc-depth";

describe("tocDepthForUrl", () => {
	it("caps the changelog to h2 only", () => {
		expect(
			tocDepthForUrl("/docs/technical-guide/ci-cd-pipeline/changelog")
		).toBe(2);
	});

	it("caps a sibling technical-guide page to h2/h3", () => {
		expect(
			tocDepthForUrl("/docs/technical-guide/ci-cd-pipeline/overview")
		).toBe(3);
	});

	it("caps a curriculum page to h2/h3", () => {
		expect(
			tocDepthForUrl("/docs/curriculum/tea-trainee/01-first-sip/exploration")
		).toBe(3);
	});
});
