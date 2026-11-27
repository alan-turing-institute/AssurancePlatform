import { describe, expect, it } from "vitest";
import { getSectorById, getSectorDisplayName, sectors } from "@/lib/sectors";

const TEXT_FIELDS = ["Name", "Description", "ISICcode", "NACEcode"] as const;

describe("sectors list", () => {
	it("is not empty", () => {
		expect(sectors.length).toBeGreaterThan(0);
	});

	it("gives every entry a positive whole-number ID", () => {
		for (const sector of sectors) {
			expect(Number.isInteger(sector.ID)).toBe(true);
			expect(sector.ID).toBeGreaterThan(0);
		}
	});

	it("gives every entry non-empty text in every field", () => {
		for (const sector of sectors) {
			for (const field of TEXT_FIELDS) {
				expect(typeof sector[field]).toBe("string");
				expect(sector[field].trim().length).toBeGreaterThan(0);
			}
		}
	});

	it("has exactly the five declared fields on every entry", () => {
		for (const sector of sectors) {
			expect(Object.keys(sector).sort()).toStrictEqual([
				"Description",
				"ID",
				"ISICcode",
				"NACEcode",
				"Name",
			]);
		}
	});

	it("never uses the empty string as a name (reserved for no selection)", () => {
		expect(sectors.some((sector) => sector.Name === "")).toBe(false);
	});

	it.each([
		"ID",
		"Name",
	] as const)("has a unique %s on every entry", (field) => {
		const values = sectors.map((sector) => sector[field]);
		expect(new Set(values).size).toBe(values.length);
	});
});

describe("getSectorById", () => {
	it("returns the matching entry for the ID of every sector", () => {
		for (const sector of sectors) {
			expect(getSectorById(String(sector.ID))).toBe(sector);
		}
	});

	it.each([
		"0",
		"-1",
		"1.5",
		"abc",
		"Healthcare",
		"12abc",
		"1e10",
		"99999",
	])("returns undefined for %j", (id) => {
		expect(getSectorById(id)).toBeUndefined();
	});

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

	it("returns each sector's own name for its ID", () => {
		for (const sector of sectors) {
			expect(getSectorDisplayName(String(sector.ID))).toBe(sector.Name);
		}
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
