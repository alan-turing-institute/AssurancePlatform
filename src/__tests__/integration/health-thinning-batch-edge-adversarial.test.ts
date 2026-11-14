import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	CUTOFF,
	captureLog,
	HOUR,
	NOW,
	noteProblems,
	put,
	readRows,
	rulebookProblems,
	SECOND,
	sessionsWithConditions,
	setupWorld,
	thin,
} from "../utils/health-thinning-adversarial-kit";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

afterEach(() => {
	vi.useRealTimers();
});

const DEFAULT_BATCH = 2000;

/**
 * One real record, then `extra` copies of it six seconds apart, written
 * straight to the table (the job never recomputes hashes, so the copies need
 * not chain). All identical apart from their ids and times.
 */
async function longRun(count: number) {
	const world = await setupWorld();
	const claimId = world.claims[0]?.id ?? "";
	const start = CUTOFF - 20 * HOUR;
	await put(world, 0, { ts: start });
	const [template] = await readRows(claimId);
	const startIso = new Date(start)
		.toISOString()
		.replace("T", " ")
		.replace("Z", "");
	await prisma.$executeRawUnsafe(
		`INSERT INTO plugin_health_evidence
			(id, claim_id, record, record_id, record_timestamp, verdict, check_name,
			 session, valid_for, expires_at, format_version, echo_state,
			 echo_differences, criteria_revision, record_hash, previous_record_hash,
			 created_by_id, created_at)
		SELECT gen_random_uuid()::text, e.claim_id,
			jsonb_set(jsonb_set(e.record, '{record_id}', to_jsonb(s.rid)),
				'{timestamp}', to_jsonb(to_char(s.ts, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),
			s.rid, s.ts, e.verdict, e.check_name, e.session, e.valid_for,
			s.ts + interval '5 minutes', e.format_version, e.echo_state,
			e.echo_differences, e.criteria_revision, md5(s.rid), NULL,
			e.created_by_id, s.ts
		FROM plugin_health_evidence e,
			LATERAL (
				SELECT gen_random_uuid()::text AS rid,
					('${startIso}'::timestamp + g * interval '6 seconds') AS ts
				FROM generate_series(1, ${count - 1}) AS g
				ORDER BY g
			) s
		WHERE e.id = '${template?.id}'`
	);
	return { world, claimId };
}

describe("a run longer than a batch", () => {
	it.each([
		DEFAULT_BATCH - 1,
		DEFAULT_BATCH,
		DEFAULT_BATCH + 1,
		2 * DEFAULT_BATCH,
		2 * DEFAULT_BATCH + 1,
		3 * DEFAULT_BATCH + 7,
	])("of %i identical results is thinned with the rule held across every batch edge", async (count) => {
		const { world, claimId } = await longRun(count);
		const before = await captureLog(world);
		expect(before.get(claimId)).toHaveLength(count);
		const protectedSessions = await sessionsWithConditions(world.caseId);

		const result = await thin(NOW);
		expect(result.more).toBe(false);

		const after = await captureLog(world);
		const survivors = new Map(
			[...after].map(([id, rows]) => [id, new Set(rows.map((row) => row.id))])
		);
		expect(rulebookProblems(before, protectedSessions, survivors)).toEqual([]);
		expect(await noteProblems(world, before)).toEqual([]);

		const kept = after.get(claimId) ?? [];
		const hours = Math.floor(((count - 1) * 6 * SECOND) / HOUR);
		// First, last and one in every hour; each batch edge adds a little.
		const batches = Math.ceil(count / (DEFAULT_BATCH - 1));
		expect(kept.length).toBeGreaterThanOrEqual(hours + 2);
		expect(kept.length).toBeLessThanOrEqual(hours + 2 + 2 * batches);
		expect(result.recordsRemoved).toBe(count - kept.length);

		// Nothing more to do on the same cut-off.
		expect(await thin(NOW)).toMatchObject({ recordsRemoved: 0 });
		expect((await readRows(claimId)).length).toBe(kept.length);
	}, 120_000);
});
