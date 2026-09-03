-- TEA — Element Name Prefix Validation (design note, Chris's ruling
-- 2026-09-03): every non-deleted, named element must carry its type's
-- TEA-syntax prefix (<prefix><n>(.<n>)*, e.g. P1, P1.1). This migration
-- brings existing data into line BEFORE the application-level check
-- (lib/schemas/element-validation.ts's validateElementName) starts
-- enforcing it, so the check never rejects the platform's own data.
--
-- Scope: every element with deleted_at IS NULL and a non-null name whose
-- name does not already match its type's pattern. Null names are left
-- null (names are optional); conforming names are left untouched.
--
-- Rename rule (Chris's ruling, same day): rename ONLY the non-conforming
-- elements. Each gets <prefix><n>, where n continues from the highest
-- integer already used by a CONFORMING name of that type in that case (a
-- sub-numbered name like "P1.1" counts by its leading integer, 1) —
-- assigned consecutively in creation order. This is a flat renumbering,
-- not the platform's hierarchical numbering (that's `resetIdentifiers`,
-- a separate, user-triggered action, and out of scope here).
--
-- Reversibility: every rename is logged to element_name_backfill
-- (old_name -> new_name) before it's applied, so a support query can
-- restore it.
--
-- Idempotency: re-running this script renames nothing. After the first
-- run, every previously non-conforming name now conforms, so the WHERE
-- clause that selects "does not conform" no longer matches it.

-- CreateTable
CREATE TABLE "element_name_backfill" (
    "id" TEXT NOT NULL,
    "element_id" TEXT NOT NULL,
    "old_name" TEXT NOT NULL,
    "new_name" TEXT NOT NULL,
    "migrated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "element_name_backfill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "element_name_backfill_element_id_idx" ON "element_name_backfill"("element_id");

-- Backfill: rename every non-conforming stored name to its type's prefix
-- format, logging the old -> new mapping first.
WITH prefixes(element_type, prefix) AS (
    -- Mirrors lib/element-names/prefix-registry.ts's CORE_PREFIXES table —
    -- the single source of prefixes; keep the two in sync if either changes.
    VALUES
        ('GOAL', 'G'),
        ('STRATEGY', 'S'),
        ('PROPERTY_CLAIM', 'P'),
        ('EVIDENCE', 'E'),
        ('CONTEXT', 'C'),
        ('JUSTIFICATION', 'J'),
        ('ASSUMPTION', 'A'),
        ('MODULE', 'M'),
        ('AWAY_GOAL', 'AG'),
        ('CONTRACT', 'Ct')
),
-- Every live, named element, tagged with its type's prefix and whether its
-- current name already conforms to ^<prefix>[0-9]+(\.[0-9]+)*$.
candidates AS (
    SELECT
        e.id,
        e.case_id,
        e.element_type,
        e.name,
        e.created_at,
        p.prefix,
        (e.name ~ ('^' || p.prefix || '[0-9]+(\.[0-9]+)*$')) AS conforms,
        -- Leading integer of the name (valid only when it conforms) — seeds
        -- the per-case/type counter below.
        CASE
            WHEN e.name ~ ('^' || p.prefix || '[0-9]+(\.[0-9]+)*$')
                THEN (regexp_match(e.name, '^' || p.prefix || '([0-9]+)'))[1]::INT
            ELSE NULL
        END AS leading_int
    FROM "assurance_elements" e
    JOIN prefixes p ON p.element_type = e.element_type::TEXT
    WHERE e.deleted_at IS NULL
      AND e.name IS NOT NULL
),
-- Highest already-conforming leading integer per (case, type) — the new
-- numbers for that group start one past this, so they never collide with
-- an existing conforming name.
existing_max AS (
    SELECT case_id, element_type, MAX(leading_int) AS max_n
    FROM candidates
    WHERE conforms
    GROUP BY case_id, element_type
),
-- Non-conforming elements, numbered consecutively within their (case, type)
-- group in creation order.
to_rename AS (
    SELECT
        c.id,
        c.case_id,
        c.element_type,
        c.name AS old_name,
        c.prefix,
        ROW_NUMBER() OVER (
            PARTITION BY c.case_id, c.element_type
            ORDER BY c.created_at
        ) AS rn
    FROM candidates c
    WHERE NOT c.conforms
),
renamed AS (
    SELECT
        t.id,
        t.old_name,
        t.prefix || (COALESCE(m.max_n, 0) + t.rn) AS new_name
    FROM to_rename t
    LEFT JOIN existing_max m
        ON m.case_id = t.case_id AND m.element_type = t.element_type
),
logged AS (
    INSERT INTO "element_name_backfill" ("id", "element_id", "old_name", "new_name")
    SELECT gen_random_uuid(), id, old_name, new_name FROM renamed
    RETURNING "element_id", "new_name"
)
UPDATE "assurance_elements" e
SET "name" = logged."new_name"
FROM logged
WHERE e.id = logged."element_id";
