-- Add constraint to prevent evidence from having parentId
-- This enforces the evidence_links-only model at the database level
-- Evidence elements must always use the evidence_links junction table, not parentId

ALTER TABLE assurance_elements
ADD CONSTRAINT chk_evidence_no_parent
CHECK (element_type != 'EVIDENCE' OR parent_id IS NULL);
