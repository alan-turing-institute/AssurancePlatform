import { describe, expect, it } from "vitest";
import { getSectorById, getSectorDisplayName, sectors } from "@/lib/sectors";

describe("getSectorById", () => {
	it("resolves a known stable ID to its Sector record", () => {
		const sector = getSectorById("15");
		expect(sector?.Name).toBe("Health & Social Care");
	});

	it("returns undefined for a non-numeric value", () => {
		expect(getSectorById("Healthcare")).toBeUndefined();
	});

	it("returns undefined for an ID with no matching sector", () => {
		expect(getSectorById("9999")).toBeUndefined();
	});

	it("returns undefined for null/undefined/empty input", () => {
		expect(getSectorById(null)).toBeUndefined();
		expect(getSectorById(undefined)).toBeUndefined();
		expect(getSectorById("")).toBeUndefined();
	});
});

describe("getSectorDisplayName", () => {
	// The three stored-value shapes the migration and the UI's
	// legacy-tolerance path both need to cover (issue acceptance criterion
	// 3): a canonical stable ID, a known legacy variant already migrated to
	// its ID, and genuinely unmappable free text left untouched.

	it("resolves a canonical stable ID to the full sector name", () => {
		const financialServices = sectors.find(
			(sector) => sector.Name === "Financial Services"
		);
		expect(getSectorDisplayName(String(financialServices?.ID))).toBe(
			"Financial Services"
		);
	});

	it("resolves a known legacy variant's migrated ID to the canonical name (e.g. 'Healthcare' -> 'Health & Social Care')", () => {
		const healthAndSocialCare = sectors.find(
			(sector) => sector.Name === "Health & Social Care"
		);
		expect(getSectorDisplayName(String(healthAndSocialCare?.ID))).toBe(
			"Health & Social Care"
		);
	});

	it("falls back to the raw string for genuinely unmappable legacy free text", () => {
		expect(getSectorDisplayName("Medical Devices")).toBe("Medical Devices");
	});

	it("returns null for null/undefined/empty input", () => {
		expect(getSectorDisplayName(null)).toBeNull();
		expect(getSectorDisplayName(undefined)).toBeNull();
		expect(getSectorDisplayName("")).toBeNull();
	});
});
