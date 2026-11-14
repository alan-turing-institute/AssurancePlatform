-- Health plugin: lets the nightly thinning job ask whether a session carries
-- a valid_while condition without reading every record in the session.
--
-- Additive only: one partial index, hand-written because Prisma's schema DSL
-- cannot express a partial index (the same reason the revocations table's
-- partial unique index has no line in schema.prisma). Prisma's migration diff
-- ignores partial indexes, so the schema and the migrations stay in step
-- without one. It holds only the records whose valid_while is a non-empty
-- object, so for a session with no conditions the question is answered from an
-- empty slice of the index. The predicate is written exactly as the thinning
-- service's query writes it, which is what lets the planner use the index.

-- CreateIndex
CREATE INDEX "plugin_health_evidence_session_conditions_idx" ON "plugin_health_evidence"("session") WHERE jsonb_typeof("record" -> 'valid_while') = 'object' AND "record" -> 'valid_while' <> '{}'::jsonb;
