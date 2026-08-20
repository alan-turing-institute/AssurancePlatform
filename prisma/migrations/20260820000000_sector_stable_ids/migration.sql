-- Migrate `case_information.sector` from a free-text display name to the
-- sector's stable numeric ID (as a string) from `lib/sectors.ts`.
--
-- Rationale: the column previously stored the display name verbatim, so
-- relabelling a sector orphaned every case that had already selected it
-- into the "(legacy value)" tolerance path. Drift had already happened in
-- practice — the dev seed stored "Healthcare" while the canonical list
-- calls it "Health & Social Care" (see the sector-stable-id issue and
-- [[TEA — Staging walkthrough of the walkthrough-defect fixes (PRs
-- 890-891+)]] story 3 in the vault).
--
-- The stable ID is used (not the ISIC/NACE code) because those codes are
-- not unique across the 20 sectors — three are bespoke composites and
-- codes M, O and N are each reused across two different sectors.
--
-- Covers: (1) every current canonical name, verbatim, and (2) the one
-- known legacy variant ("Healthcare"). Any other stored value is left
-- untouched — genuinely unmappable free text stays on the UI's existing
-- legacy-tolerance path (case-information-section.tsx), which continues to
-- display it labelled "(legacy value)" rather than losing user data.
--
-- `PublishedAssuranceCase.content` (frozen publish snapshots) is
-- deliberately NOT touched here: snapshots are point-in-time and frozen by
-- design (never rewritten after publish), and `discover-service.ts`'s
-- `getSectorDisplayName` already resolves either a stable ID or a
-- pre-migration name string at read time, so old snapshots keep rendering
-- correctly without a JSON rewrite.
--
-- Guarded on the table's existence (`to_regclass`) rather than a bare
-- `UPDATE "case_information" ...`: `publishing-schema-migration.test.ts`
-- reconstructs a pre-`20260716000000_publishing_schema_and_state_model`
-- database state by applying every OTHER migration in order (including
-- this one, which sorts after it chronologically) before that one
-- migration — the one that actually creates `case_information` — is
-- applied. A bare reference would fail migrate deploy in that scenario;
-- this migration is a genuine no-op until the table exists, and in every
-- real deployment (where migrations always apply in full, in order) that
-- is immediately true.
DO $$
BEGIN
	IF to_regclass('public.case_information') IS NOT NULL THEN
		-- Canonical names -> stable ID.
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '1'  WHERE "sector" = 'Agriculture, Forestry & Fishing'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '2'  WHERE "sector" = 'Mining, Quarrying & Extraction'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '3'  WHERE "sector" = 'Energy Production & Supply'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '4'  WHERE "sector" = 'Utilities & Environmental Services'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '5'  WHERE "sector" = 'Construction & Civil Engineering'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '6'  WHERE "sector" = 'Manufacturing & Industrial Production'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '7'  WHERE "sector" = 'Wholesale & Retail Trade'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '8'  WHERE "sector" = 'Transportation & Logistics'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '9'  WHERE "sector" = 'Information, Communication & Media'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '10' WHERE "sector" = 'Financial Services'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '11' WHERE "sector" = 'Real-Estate & Property Management'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '12' WHERE "sector" = 'Professional, Scientific & Technical Services'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '13' WHERE "sector" = 'Public Administration, Defence & Security'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '14' WHERE "sector" = 'Education & Training'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '15' WHERE "sector" = 'Health & Social Care'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '16' WHERE "sector" = 'Accommodation, Food Service & Tourism'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '17' WHERE "sector" = 'Arts, Entertainment & Creative Industries'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '18' WHERE "sector" = 'Legal Services & Justice'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '19' WHERE "sector" = 'Personal & Other Community Services'$sql$;
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '20' WHERE "sector" = 'Extraterrestrial & International Organisations'$sql$;

		-- Known legacy variant -> canonical ID.
		EXECUTE $sql$UPDATE "case_information" SET "sector" = '15' WHERE "sector" = 'Healthcare'$sql$;
	END IF;
END
$$;
