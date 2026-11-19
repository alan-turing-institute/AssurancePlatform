/**
 * Named schemas for the answers programs read: the machine routes, case
 * export and import, public Discover and the scheduled jobs. Each follows the
 * shape its handler sends, with every field the handler always sets listed as
 * required. operations.ts refers to them by name.
 */

import { healthEvidenceRecordSchema } from "../../lib/schemas/health-evidence";
import { fromZod, type Schema } from "./from-zod";

const STRING: Schema = { type: "string" };
const INTEGER: Schema = { type: "integer" };
const BOOLEAN: Schema = { type: "boolean" };
const DATE_TIME: Schema = { type: "string", format: "date-time" };
const OPEN_OBJECT: Schema = { type: "object" };

function ref(name: string): Schema {
	return { $ref: `#/components/schemas/${name}` };
}

/** The schema, also allowing null; `nullable` only counts beside an explicit type, and an enum must list null. */
function nullable(schema: Schema): Schema {
	if ("$ref" in schema) {
		return { type: "object", nullable: true, allOf: [schema] };
	}
	if ("oneOf" in schema) {
		return { type: "object", ...schema, nullable: true };
	}
	if (Array.isArray(schema.enum)) {
		return { ...schema, nullable: true, enum: [...schema.enum, null] };
	}
	return { ...schema, nullable: true };
}

function list(items: Schema): Schema {
	return { type: "array", items };
}

function oneOf(values: string[]): Schema {
	return { type: "string", enum: values };
}

/** An object whose listed fields are all present in every answer, unless named in `optional`. */
export function shape(
	properties: Record<string, Schema>,
	optional: string[] = []
): Schema {
	return {
		type: "object",
		properties,
		required: Object.keys(properties).filter(
			(name) => !optional.includes(name)
		),
	};
}

const BLOCK_SOURCE = oneOf(["recommended", "edited", "hand"]);

/** A rule, reduction or aggregation block: its own fields vary by kind, and each carries a version label. */
const SETTINGS_BLOCK: Schema = {
	type: "object",
	required: ["version"],
	properties: { kind: STRING, params: OPEN_OBJECT, version: STRING },
	additionalProperties: true,
};

const HEALTH_MISMATCH: Schema = {
	oneOf: [
		shape({ state: oneOf(["undeclared"]) }),
		shape({
			state: oneOf(["mismatch"]),
			differences: list(
				shape({ field: STRING, declared: {}, used: {} }, ["declared", "used"])
			),
		}),
	],
};

const HEALTH_STATUS: Schema = shape({
	bound_check: nullable(STRING),
	expires_at: nullable(DATE_TIME),
	mismatch: nullable(HEALTH_MISMATCH),
	record_id: nullable(STRING),
	rejected_since_last_accept: INTEGER,
	stale: BOOLEAN,
	stale_reason: nullable(oneOf(["expired", "condition", "all-revoked"])),
	stale_since: nullable(DATE_TIME),
	timestamp: nullable(DATE_TIME),
	verdict: nullable(oneOf(["pass", "marginal", "fail", "indeterminate"])),
});

const MACHINE_CRITERIA: Schema = shape(
	{
		claim_ref: STRING,
		state: oneOf(["accepted"]),
		revision: INTEGER,
		check: shape(
			{ name: STRING, version: STRING, scope: STRING, params: OPEN_OBJECT },
			["scope", "params"]
		),
		rule: SETTINGS_BLOCK,
		reduction: SETTINGS_BLOCK,
		aggregation: SETTINGS_BLOCK,
		window: STRING,
		valid_for: STRING,
		source: shape(
			{
				kind: BLOCK_SOURCE,
				rule: BLOCK_SOURCE,
				timing: BLOCK_SOURCE,
				check_version: STRING,
				check_params: BLOCK_SOURCE,
				reduction: BLOCK_SOURCE,
				aggregation: BLOCK_SOURCE,
			},
			["check_params", "reduction", "aggregation"]
		),
		accepted_at: nullable(DATE_TIME),
		updated_at: DATE_TIME,
	},
	["reduction", "aggregation"]
);

const REVOCATION: Schema = shape({
	cause: oneOf([
		"evidence-defect",
		"binding-defect",
		"duplicate",
		"superseded",
		"other",
	]),
	reason: STRING,
	revoked_at: DATE_TIME,
	revoked_by_name: STRING,
});

const THINNED_RUN: Schema = shape({
	removed_count: INTEGER,
	first_removed_at: DATE_TIME,
	first_removed_sequence: INTEGER,
	last_removed_at: DATE_TIME,
	last_removed_sequence: INTEGER,
	rule_version: INTEGER,
	thinned_at: DATE_TIME,
});

const EVIDENCE_ITEM: Schema = shape({
	id: STRING,
	record: ref("HealthEvidenceRecord"),
	chain_sequence: INTEGER,
	record_hash: STRING,
	previous_record_hash: nullable(STRING),
	created_by_id: STRING,
	created_at: DATE_TIME,
	expires_at: nullable(DATE_TIME),
	revocation: nullable(REVOCATION),
	echo_state: oneOf(["match", "mismatch", "undeclared"]),
	echo_differences: nullable(
		list(shape({ field: STRING, declared: {}, used: {} }, ["declared", "used"]))
	),
	criteria_revision: nullable(INTEGER),
	thinned_before: nullable(THINNED_RUN),
});

const IMPORT_RESULT: Schema = shape({
	id: STRING,
	name: STRING,
	elementCount: INTEGER,
	evidenceLinkCount: INTEGER,
	warnings: list(STRING),
});

const PUBLISHED_ITEM: Schema = shape({
	id: STRING,
	slug: STRING,
	title: STRING,
	type: oneOf(["ASSURANCE_CASE", "ARGUMENT_PATTERN"]),
	description: nullable(STRING),
	authors: nullable(STRING),
	sector: nullable(STRING),
	featureImageUrl: nullable(STRING),
	publishedAt: DATE_TIME,
	archivedAt: nullable(DATE_TIME),
	content: {
		description:
			"The frozen snapshot as the publisher stored it: the case tree, plugin data and case information. Text inside it may contain HTML markup.",
	},
});

/** The schemas the answers below refer to, by name. */
export function answerSchemas(): Record<string, Schema> {
	return {
		HealthStatus: HEALTH_STATUS,
		ClaimHealthStatus: shape({ status: nullable(ref("HealthStatus")) }),
		MachineCriteria: MACHINE_CRITERIA,
		HealthEvidenceRecord: fromZod(healthEvidenceRecordSchema, [
			"JsonValue",
			"JsonValue",
		]),
		HealthEvidenceItem: EVIDENCE_ITEM,
		ImportResult: IMPORT_RESULT,
		ImportResultFromDrive: {
			allOf: [
				ref("ImportResult"),
				shape({
					source: shape({
						type: oneOf(["gdrive"]),
						fileId: STRING,
						fileName: STRING,
					}),
				}),
			],
		},
		ImportResultFromGitHub: {
			allOf: [
				ref("ImportResult"),
				shape({
					source: shape({
						type: oneOf(["github"]),
						owner: STRING,
						repo: STRING,
						path: STRING,
						branch: STRING,
					}),
				}),
			],
		},
		PublishedItem: PUBLISHED_ITEM,
	};
}

/** Answers that are not worth a name of their own. */
export const ANSWERS = {
	whoami: shape({ name: STRING, scopes: list(STRING), tokenPrefix: STRING }),
	publishedChecks: shape({
		checks: INTEGER,
		warnings: list(shape({ check: STRING, problem: STRING })),
	}),
	caseCriteria: shape({
		case_id: STRING,
		criteria: list(ref("MachineCriteria")),
	}),
	caseStatuses: shape({
		case_id: STRING,
		statuses: list(shape({ claim_ref: STRING, status: ref("HealthStatus") })),
	}),
	evidencePage: shape({
		evidence: list(ref("HealthEvidenceItem")),
		next_before: nullable(INTEGER),
	}),
	appendedEvidence: shape({
		record: ref("HealthEvidenceRecord"),
		status: ref("HealthStatus"),
	}),
	purgeTrash: shape({
		success: BOOLEAN,
		cutoffDate: STRING,
		purgedCount: INTEGER,
	}),
	stalenessSweep: shape({
		success: BOOLEAN,
		casesNotified: INTEGER,
		staleClaimsNotified: INTEGER,
	}),
	evidenceThinning: shape({
		success: BOOLEAN,
		dryRun: BOOLEAN,
		busy: BOOLEAN,
		claimsProcessed: INTEGER,
		more: BOOLEAN,
		recordsRemoved: INTEGER,
		runsRecorded: INTEGER,
	}),
	retentionSweep: shape({
		success: BOOLEAN,
		dryRun: BOOLEAN,
		deleted: INTEGER,
		skipped: INTEGER,
		warned7: INTEGER,
		warned30: INTEGER,
	}),
	caseInformation: {
		type: "object",
		nullable: true,
		description: "The case information, or null when none has been saved yet",
	} as Schema,
} as const;
