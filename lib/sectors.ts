/**
 * Canonical sector list for case information (ADR 0003 §1). Recovered from
 * git history — this lived as the `sectors` export in `config/index.ts`
 * until commit ee15d369 removed it as (then) dead code. It backs the
 * publish-completion pane's Sector select, replacing a free-text input.
 *
 * 20 broad sectors mapped to ISIC/NACE classification codes, chosen for
 * plain-English recognisability over exhaustive standards coverage.
 */
export interface Sector {
	Description: string;
	ID: number;
	ISICcode: string;
	NACEcode: string;
	Name: string;
}

// Empty string ("") is a reserved sentinel for "no sector selected" — never add a
// sector with that value here; see the onValueChange guard in case-information-section.tsx.
export const sectors: Sector[] = [
	{
		ID: 1,
		Name: "Agriculture, Forestry & Fishing",
		Description:
			"Growing crops, raising animals, managing forests and catching fish to supply food and raw materials.",
		ISICcode: "A",
		NACEcode: "A",
	},
	{
		ID: 2,
		Name: "Mining, Quarrying & Extraction",
		Description:
			"Digging or drilling the earth for minerals, metals, stone, oil and gas that feed industry and energy systems.",
		ISICcode: "B",
		NACEcode: "B",
	},
	{
		ID: 3,
		Name: "Energy Production & Supply",
		Description:
			"Generating and distributing electricity, heat, oil, gas and renewable power that keep homes, businesses and transport running.",
		ISICcode: "D",
		NACEcode: "D",
	},
	{
		ID: 4,
		Name: "Utilities & Environmental Services",
		Description:
			"Delivering clean water, treating wastewater, collecting rubbish and recycling, and cleaning up pollution.",
		ISICcode: "E",
		NACEcode: "E",
	},
	{
		ID: 5,
		Name: "Construction & Civil Engineering",
		Description:
			"Building and maintaining houses, offices, roads, bridges and other physical infrastructure.",
		ISICcode: "F",
		NACEcode: "F",
	},
	{
		ID: 6,
		Name: "Manufacturing & Industrial Production",
		Description: "Turning raw or semi-processed materials into finished goods.",
		ISICcode: "C",
		NACEcode: "C",
	},
	{
		ID: 7,
		Name: "Wholesale & Retail Trade",
		Description:
			"Buying goods in bulk and selling them on to shops or directly to consumers in stores and online.",
		ISICcode: "G",
		NACEcode: "G",
	},
	{
		ID: 8,
		Name: "Transportation & Logistics",
		Description:
			"Moving people and goods by road, rail, air, sea and pipelines, plus warehousing and delivery services.",
		ISICcode: "H",
		NACEcode: "H",
	},
	{
		ID: 9,
		Name: "Information, Communication & Media",
		Description:
			"Creating, processing and transmitting data, software, news, entertainment and telecoms services.",
		ISICcode: "J",
		NACEcode: "J",
	},
	{
		ID: 10,
		Name: "Financial Services",
		Description:
			"Managing money through banking, investment, insurance, pensions and related advisory activities.",
		ISICcode: "K",
		NACEcode: "K",
	},
	{
		ID: 11,
		Name: "Real-Estate & Property Management",
		Description:
			"Buying, selling, renting and looking after land and buildings for living, working or investment.",
		ISICcode: "L",
		NACEcode: "L",
	},
	{
		ID: 12,
		Name: "Professional, Scientific & Technical Services",
		Description:
			"Providing expert knowledge such as engineering design, R&D, consulting, accountancy and advertising.",
		ISICcode: "M",
		NACEcode: "M",
	},
	{
		ID: 13,
		Name: "Public Administration, Defence & Security",
		Description:
			"Government bodies that make policy, deliver public services and protect national safety.",
		ISICcode: "O",
		NACEcode: "O",
	},
	{
		ID: 14,
		Name: "Education & Training",
		Description:
			"Schools, colleges, universities and lifelong learning organisations that teach skills and capabilities.",
		ISICcode: "P",
		NACEcode: "P",
	},
	{
		ID: 15,
		Name: "Health & Social Care",
		Description:
			"Hospitals, clinics, care homes and community services that maintain physical and mental well-being.",
		ISICcode: "Q",
		NACEcode: "Q",
	},
	{
		ID: 16,
		Name: "Accommodation, Food Service & Tourism",
		Description:
			"Hotels, restaurants, cafés and travel operators that host, feed and entertain visitors.",
		ISICcode: "I, N",
		NACEcode: "I, N",
	},
	{
		ID: 17,
		Name: "Arts, Entertainment & Creative Industries",
		Description:
			"Producing culture and leisure activities such as music, film, gaming, museums and live events.",
		ISICcode: "R",
		NACEcode: "R",
	},
	{
		ID: 18,
		Name: "Legal Services & Justice",
		Description:
			"Solicitors, barristers, courts and mediation bodies that advise on and enforce the law.",
		ISICcode: "M, O",
		NACEcode: "M, O",
	},
	{
		ID: 19,
		Name: "Personal & Other Community Services",
		Description:
			"Everyday support such as hairdressing, dry-cleaning, household repairs, gyms and charities.",
		ISICcode: "N, S, T",
		NACEcode: "N, S, T",
	},
	{
		ID: 20,
		Name: "Extraterrestrial & International Organisations",
		Description:
			"Embassies, UN agencies, the International Space Station and other bodies operating outside national jurisdictions.",
		ISICcode: "U",
		NACEcode: "U",
	},
];

/**
 * Looks up a sector by its stable numeric ID (the value now stored on
 * `CaseInformation.sector` — see the migration
 * `20260820000000_sector_stable_ids`). Accepts the ID as a string because
 * that is how it travels through forms and the database column, which
 * stays `String?` for legacy free-text compatibility.
 */
export function getSectorById(
	id: string | null | undefined
): Sector | undefined {
	if (!id) {
		return undefined;
	}
	const numericId = Number(id);
	if (!Number.isInteger(numericId)) {
		return undefined;
	}
	return sectors.find((sector) => sector.ID === numericId);
}

/**
 * Resolves a stored `sector` value to the full display name a user should
 * always see (Chris's hard constraint, 2026-08-18 — the ID/code is a
 * storage detail, never UI). Handles three shapes of stored value:
 *
 * - A known stable ID (e.g. `"15"`) → the canonical `Name`.
 * - Free text that predates the ID migration and was never mapped (a
 *   genuinely unmappable legacy value) → returned verbatim, since it is
 *   already a human-readable string and there is nothing to resolve it to.
 * - `null`/`undefined`/`""` → `null` (no sector recorded).
 *
 * Also tolerant of a frozen publish snapshot's `caseInformation.sector`,
 * which may still hold a pre-migration display-name string verbatim
 * (snapshots are never rewritten after the fact) — the same free-text
 * fallback covers that case.
 */
export function getSectorDisplayName(
	value: string | null | undefined
): string | null {
	if (!value) {
		return null;
	}
	return getSectorById(value)?.Name ?? value;
}
