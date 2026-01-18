-- Add performance indexes for Comment, ReleaseComment, and EvidenceLink tables
-- These indexes improve query performance for common lookups by foreign key

-- Comment table indexes (internal collaboration comments)
CREATE INDEX IF NOT EXISTS "comments_element_id_idx" ON "comments"("element_id");
CREATE INDEX IF NOT EXISTS "comments_case_id_idx" ON "comments"("case_id");

-- ReleaseComment table indexes (public release comments)
CREATE INDEX IF NOT EXISTS "release_comments_release_id_idx" ON "release_comments"("release_id");
CREATE INDEX IF NOT EXISTS "release_comments_element_id_idx" ON "release_comments"("element_id");

-- EvidenceLink table indexes (evidence-to-claim links)
CREATE INDEX IF NOT EXISTS "evidence_links_evidence_id_idx" ON "evidence_links"("evidence_id");
CREATE INDEX IF NOT EXISTS "evidence_links_claim_id_idx" ON "evidence_links"("claim_id");
