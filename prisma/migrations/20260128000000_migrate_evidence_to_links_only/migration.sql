-- Migrate Evidence to evidence_links-only
-- Evidence elements previously used a hybrid system (parentId + evidence_links).
-- This migration converts all parentId relationships to evidence_links and enforces
-- evidence elements always have parentId=null.

-- Step 1: Convert evidence parentId relationships to evidence_links
-- Only creates links where one doesn't already exist
INSERT INTO evidence_links (id, evidence_id, claim_id, created_at)
SELECT
  gen_random_uuid(),
  e.id,
  e.parent_id,
  NOW()
FROM assurance_elements e
WHERE e.element_type = 'EVIDENCE'
  AND e.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM evidence_links el
    WHERE el.evidence_id = e.id AND el.claim_id = e.parent_id
  );

-- Step 2: Clear parentId for all evidence elements
UPDATE assurance_elements
SET parent_id = NULL
WHERE element_type = 'EVIDENCE' AND parent_id IS NOT NULL;

-- Step 3: Clean up orphaned evidence_links
-- Remove links where either the evidence or claim element is deleted or doesn't exist
DELETE FROM evidence_links
WHERE NOT EXISTS (
  SELECT 1 FROM assurance_elements
  WHERE id = evidence_links.evidence_id AND deleted_at IS NULL
)
OR NOT EXISTS (
  SELECT 1 FROM assurance_elements
  WHERE id = evidence_links.claim_id AND deleted_at IS NULL
);
