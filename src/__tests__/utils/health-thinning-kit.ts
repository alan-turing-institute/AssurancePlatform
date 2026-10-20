import { randomUUID } from "node:crypto";
import { vi } from "vitest";
import prisma from "@/lib/prisma";
import { healthEvidenceRecordSchema } from "@/lib/schemas/health-evidence";
import {
	appendHealthEvidence,
	type ThinHealthEvidenceOptions,
	thinHealthEvidence,
} from "@/lib/services/health-evidence-service";
import { expectSuccess } from "./assertion-helpers";

/**
 * The job's clock in the thinning tests: the cut-off is the start of this
 * hour, a day back (noon on the 15th), so a record stamped before that is old
 * enough to thin.
 */
export const NOW = new Date("2026-10-16T12:30:00.000Z");
/** A start time two days before `NOW`, well inside the thinnable part of the log. */
export const OLD = new Date("2026-10-14T00:00:00.000Z");

type Overrides = Record<string, unknown> & {
	provenance?: Record<string, unknown>;
};

/**
 * A wire-shape record in the style of a long-running pipeline: a measured
 * value with uncertainty, a judged statistic, a subject and a payload, and
 * the details that change with every result (the reading list, a failed
 * subject, a comment, a simulated clock). `index` makes those details differ
 * from one record to the next.
 */
function thinningRecord(
	claimId: string,
	at: Date,
	index: number,
	overrides: Overrides = {}
) {
	const { provenance, ...rest } = overrides;
	return {
		format_version: "1.1",
		record_id: randomUUID(),
		timestamp: at.toISOString(),
		claim_ref: claimId,
		check: { name: "Unit Drift Checker", version: "2.0", scope: "unit" },
		rule: {
			kind: "threshold",
			direction: "minimize",
			params: { pass_values: 0.5, marginal_values: 1 },
			version: "r4",
		},
		window: "PT5M",
		value: { number: 0.31, unit: "mm" },
		verdict: "pass",
		valid_for: "P1D",
		uncertainty: {
			kind: "interval",
			params: { lower: 0.22, upper: 0.4 },
			level: 0.95,
			method: "bootstrap",
			validated: true,
			nature: "predictive",
		},
		judged: { statistic: "mean", method: "bootstrap", value: 0.31 },
		subject: { kind: "unit", id: "U-7" },
		payload: { detail: "steady" },
		comment: `Check ${index}`,
		provenance: {
			twin_version: "2.3",
			session: "RUN-A",
			pipeline_version: "0.4.0",
			run: "offline",
			sim_time: 1000 + index,
			members: Array.from({ length: index + 1 }, () => randomUUID()),
			failed_subjects: [{ kind: "unit", id: `U-${index}` }],
			...provenance,
		},
		...rest,
	};
}

/**
 * Appends one record through the service as if it arrived at `at`, stamped
 * `at`: the clock is held there while the service stores it, so the record's
 * stored time and its hash agree. Returns the record id.
 */
export async function appendAt(
	userId: string,
	claimId: string,
	at: Date,
	index = 0,
	overrides: Overrides = {}
): Promise<string> {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(at);
	try {
		const record = healthEvidenceRecordSchema.parse(
			thinningRecord(claimId, at, index, overrides)
		);
		expectSuccess(await appendHealthEvidence(userId, claimId, record));
		return record.record_id;
	} finally {
		vi.useRealTimers();
	}
}

/** Appends `count` records `stepMs` apart from `start`; returns their ids in order. */
export async function appendSeries(
	userId: string,
	claimId: string,
	start: Date,
	count: number,
	stepMs: number,
	options: { firstIndex?: number; overrides?: Overrides } = {}
): Promise<string[]> {
	const ids: string[] = [];
	for (let i = 0; i < count; i++) {
		ids.push(
			await appendAt(
				userId,
				claimId,
				new Date(start.getTime() + i * stepMs),
				(options.firstIndex ?? 0) + i,
				options.overrides
			)
		);
	}
	return ids;
}

/**
 * Records every result of `claimId` as having matched accepted settings. The
 * comparison is made when a result arrives and sits outside the hash, so a
 * test can set it directly instead of accepting settings for each claim.
 */
export async function markMatched(claimId: string): Promise<void> {
	await prisma.pluginHealthEvidence.updateMany({
		where: { claimId },
		data: { echoState: "MATCH", criteriaRevision: 1 },
	});
}

/** The ids of `claimId`'s records that are still stored, in chain order. */
export async function storedRecordIds(claimId: string): Promise<string[]> {
	const rows = await prisma.pluginHealthEvidence.findMany({
		where: { claimId },
		orderBy: { chainSequence: "asc" },
		select: { recordId: true },
	});
	return rows.map((row) => row.recordId);
}

/** `ids` at the given positions. */
export function pick(ids: string[], positions: number[]): string[] {
	return positions.map((position) => {
		const id = ids[position];
		if (id === undefined) {
			throw new Error(`no record at position ${position}`);
		}
		return id;
	});
}

/** Runs the job at the tests' fixed time and returns its counts. */
export async function thin(options: ThinHealthEvidenceOptions = {}) {
	return expectSuccess(await thinHealthEvidence({ now: NOW, ...options }));
}
