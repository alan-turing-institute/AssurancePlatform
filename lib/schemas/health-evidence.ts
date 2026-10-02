import { z } from "zod";
import { uuidSchema } from "@/lib/schemas/base";
import {
	BOUNDED_JSON_MAX_DEPTH,
	BOUNDED_JSON_MAX_KEYS,
	BOUNDED_JSON_MAX_STRING_LENGTH,
	boundedJsonValueSchema,
	serializedByteLength,
} from "@/lib/schemas/bounded-json";
import {
	aggregationSchema,
	durationSchema,
	paramsBagSchema,
	reductionSchema,
	ruleSchema,
	validForSchema,
} from "@/lib/schemas/health-rules";

/**
 * Zod schema for evidence format 1.1: the record a producer posts to
 * `POST /api/machine/health/elements/[id]/evidence`. Field names are the
 * snake_case wire names. Unknown top-level fields are rejected, so a
 * producer cannot supply fields the server sets itself (hashes, storing
 * time, recording principal, revocation state). TEA checks the record's
 * structure; it never re-judges whether a verdict follows from a value.
 *
 * `claim_ref` is required here, but its equality with the path `[id]` is
 * enforced at the route, since path and body are parsed separately.
 */

export const EVIDENCE_FORMAT_VERSION = "1.1";

const VERDICTS = ["pass", "marginal", "fail", "indeterminate"] as const;
export type HealthVerdict = (typeof VERDICTS)[number];

/** A record's timestamp may run ahead of the server clock by at most this long. */
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

const NAME_MAX_LENGTH = 200;
const COMMENT_MAX_LENGTH = 2000;
const PAYLOAD_MAX_BYTES = 16 * 1024;
const MEMBERS_MAX_ITEMS = 5000;
const VALID_WHILE_MAX_KEYS = 20;
const SCALAR_STRING_MAX_LENGTH = 500;

const nameString = (label: string) =>
	z
		.string()
		.min(1, `${label} is required`)
		.max(
			NAME_MAX_LENGTH,
			`${label} must be at most ${NAME_MAX_LENGTH} characters`
		);

const checkSchema = z.strictObject({
	name: nameString("name"),
	version: nameString("version"),
	scope: nameString("scope"),
	params: paramsBagSchema.optional(),
});

const valueSchema = z.union(
	[
		z.boolean(),
		z.string().max(SCALAR_STRING_MAX_LENGTH),
		z.strictObject({
			number: z.number().finite(),
			unit: z.string().max(100).nullable(),
		}),
		z.null(),
	],
	{
		error: "must be a boolean, a string, {number, unit} or null",
	}
);

const failedSubjectSchema = z.strictObject({
	kind: nameString("kind"),
	id: nameString("id"),
});

/**
 * `provenance`: `session` and `pipeline_version` are required, `run`,
 * `twin_version`, `members` and `failed_subjects` are typed when present,
 * and every other key is kept verbatim within the shared bounded-JSON
 * limits. `members` and `failed_subjects` carry their own, larger limits
 * because a population summary lists every member.
 */
// biome-ignore lint/plugin: provenance keys beyond the typed ones must be PRESERVED verbatim (.catchall()), the opposite of the usual silent-strip leniency; z.strictObject() would reject them.
const provenanceSchema = z
	.object({
		session: z
			.string()
			.min(1, "session is required")
			.max(BOUNDED_JSON_MAX_STRING_LENGTH),
		pipeline_version: z
			.string()
			.min(1, "pipeline_version is required")
			.max(BOUNDED_JSON_MAX_STRING_LENGTH),
		run: z.string().max(BOUNDED_JSON_MAX_STRING_LENGTH).optional(),
		twin_version: z.string().max(BOUNDED_JSON_MAX_STRING_LENGTH).optional(),
		members: z
			.array(uuidSchema)
			.max(MEMBERS_MAX_ITEMS, `must have at most ${MEMBERS_MAX_ITEMS} entries`)
			.optional(),
		failed_subjects: z
			.array(failedSubjectSchema)
			.max(MEMBERS_MAX_ITEMS, `must have at most ${MEMBERS_MAX_ITEMS} entries`)
			.optional(),
	})
	.catchall(boundedJsonValueSchema(BOUNDED_JSON_MAX_DEPTH - 1))
	.refine((obj) => Object.keys(obj).length <= BOUNDED_JSON_MAX_KEYS * 2, {
		message: `must have at most ${BOUNDED_JSON_MAX_KEYS * 2} keys`,
	});

const isNumber = (value: unknown): boolean =>
	typeof value === "number" && Number.isFinite(value);

const isFractionOrZero = (value: unknown): boolean =>
	isNumber(value) && (value as number) >= 0 && (value as number) <= 1;

const isQuantileMap = (value: unknown): boolean =>
	typeof value === "object" &&
	value !== null &&
	!Array.isArray(value) &&
	Object.keys(value).length > 0 &&
	Object.values(value).every(isNumber);

/** What `params` must carry for each kind of uncertainty; the message names the missing shape. */
const UNCERTAINTY_PARAM_CHECKS = {
	interval: {
		isValid: (params: Record<string, unknown>) =>
			isNumber(params.lower) && isNumber(params.upper),
		message: "must carry numeric lower and upper for an interval",
	},
	std: {
		isValid: (params: Record<string, unknown>) =>
			isNumber(params.std) && Number(params.std) >= 0,
		message: "must carry a non-negative numeric std",
	},
	quantiles: {
		isValid: (params: Record<string, unknown>) => isQuantileMap(params.q),
		message: "must carry q, an object of numeric quantiles",
	},
	probability: {
		isValid: (params: Record<string, unknown>) => isFractionOrZero(params.p),
		message: "must carry p, a number from 0 to 1",
	},
} as const;

const UNCERTAINTY_KINDS = Object.keys(UNCERTAINTY_PARAM_CHECKS) as [
	keyof typeof UNCERTAINTY_PARAM_CHECKS,
	...(keyof typeof UNCERTAINTY_PARAM_CHECKS)[],
];

const uncertaintySchema = z
	.strictObject({
		kind: z.enum(UNCERTAINTY_KINDS, {
			message: `must be one of ${UNCERTAINTY_KINDS.join(", ")}`,
		}),
		params: z.record(z.string().max(100), z.json()),
		level: z
			.number()
			.gt(0, "must be greater than 0")
			.max(1, "must be at most 1")
			.optional(),
		method: nameString("method"),
		validated: z.boolean().optional(),
		nature: z.enum(["predictive", "sampling"], {
			message: "must be predictive or sampling",
		}),
	})
	.superRefine((uncertainty, ctx) => {
		const check = UNCERTAINTY_PARAM_CHECKS[uncertainty.kind];
		if (!check.isValid(uncertainty.params)) {
			ctx.addIssue({
				code: "custom",
				path: ["params"],
				message: check.message,
			});
		}
	});

const judgedSchema = z.strictObject({
	statistic: nameString("statistic"),
	method: nameString("method"),
	value: z.union([
		z.number().finite(),
		z.string().max(SCALAR_STRING_MAX_LENGTH),
		z.boolean(),
	]),
});

const subjectSchema = z.strictObject({
	kind: nameString("kind"),
	id: nameString("id"),
});

const payloadSchema = z
	.record(z.string().max(200), z.json())
	.refine((obj) => serializedByteLength(obj) <= PAYLOAD_MAX_BYTES, {
		message: `must serialize to at most ${PAYLOAD_MAX_BYTES} bytes`,
	});

const validWhileSchema = z
	.record(
		z.string().min(1).max(NAME_MAX_LENGTH),
		z.string("must be a string").max(SCALAR_STRING_MAX_LENGTH)
	)
	.refine((obj) => Object.keys(obj).length <= VALID_WHILE_MAX_KEYS, {
		message: `must have at most ${VALID_WHILE_MAX_KEYS} keys`,
	});

const timestampSchema = z
	.string()
	.datetime({ message: "must be an ISO 8601 UTC timestamp" })
	.refine((text) => Date.parse(text) <= Date.now() + MAX_FUTURE_SKEW_MS, {
		message: "must not be more than five minutes ahead of the server clock",
	});

const recordObjectSchema = z.strictObject({
	format_version: z.literal(EVIDENCE_FORMAT_VERSION, {
		message: `must be "${EVIDENCE_FORMAT_VERSION}"`,
	}),
	record_id: uuidSchema,
	timestamp: timestampSchema,
	claim_ref: uuidSchema,
	check: checkSchema,
	rule: ruleSchema,
	reduction: reductionSchema.optional(),
	aggregation: aggregationSchema.optional(),
	value: valueSchema.optional(),
	verdict: z.enum(VERDICTS, {
		message: `must be one of ${VERDICTS.join(", ")}`,
	}),
	window: durationSchema,
	valid_for: validForSchema,
	valid_while: validWhileSchema.optional(),
	uncertainty: uncertaintySchema.optional(),
	judged: judgedSchema.optional(),
	subject: subjectSchema.optional(),
	provenance: provenanceSchema,
	payload: payloadSchema.optional(),
	comment: z
		.string()
		.max(COMMENT_MAX_LENGTH, `must be at most ${COMMENT_MAX_LENGTH} characters`)
		.optional(),
});

type RecordInput = z.infer<typeof recordObjectSchema>;
type IssueSink = (path: (string | number)[], message: string) => void;

function checkSummaryRules(record: RecordInput, fail: IssueSink): void {
	if (record.aggregation === undefined) {
		return;
	}
	if (!record.provenance.members?.length) {
		fail(
			["provenance", "members"],
			"is required and must not be empty on a summary (a record with an aggregation)"
		);
	}
	if (record.subject !== undefined) {
		fail(
			["subject"],
			"is not accepted on a summary (a record with an aggregation)"
		);
	}
	if (record.uncertainty && record.uncertainty.nature !== "sampling") {
		fail(["uncertainty", "nature"], "must be sampling on a summary");
	}
}

function checkValidWhile(record: RecordInput, fail: IssueSink): void {
	for (const key of Object.keys(record.valid_while ?? {})) {
		const carried = (record.provenance as Record<string, unknown>)[key];
		if (carried === undefined) {
			fail(["valid_while", key], "must name a key present in provenance");
		} else if (typeof carried !== "string") {
			fail(
				["valid_while", key],
				"must name a provenance key whose value is a string"
			);
		}
	}
}

function checkRecordConsistency(
	record: RecordInput,
	ctx: z.RefinementCtx
): void {
	const fail: IssueSink = (path, message) =>
		ctx.addIssue({ code: "custom", path, message });
	const indeterminate = record.verdict === "indeterminate";

	if (!indeterminate && (record.value === undefined || record.value === null)) {
		fail(["value"], "is required unless the verdict is indeterminate");
	}
	if (indeterminate && !record.comment?.trim()) {
		fail(["comment"], "is required when the verdict is indeterminate");
	}
	if (record.uncertainty && !record.judged) {
		fail(["judged"], "is required when uncertainty is present");
	}
	checkSummaryRules(record, fail);
	checkValidWhile(record, fail);
}

export const healthEvidenceRecordSchema = recordObjectSchema
	.superRefine(checkRecordConsistency)
	.transform((record) => {
		// A null value is stored as absent; the timestamp is re-serialised from
		// the parsed date so a stored record's hash recomputes from the row.
		const { value, ...rest } = record;
		return {
			...rest,
			...(value === undefined || value === null ? {} : { value }),
			timestamp: new Date(record.timestamp).toISOString(),
		};
	});

export type HealthEvidenceRecord = z.output<typeof healthEvidenceRecordSchema>;

/**
 * Names the offending field in a failed parse's first issue, in the form
 * `<path>: <message>`, plus a map of field path to message for every issue.
 */
export function describeEvidenceIssues(error: z.ZodError): {
	message: string;
	fieldErrors: Record<string, string>;
} {
	const fieldErrors: Record<string, string> = {};
	for (const issue of error.issues) {
		if (issue.code === "unrecognized_keys") {
			for (const key of issue.keys) {
				fieldErrors[[...issue.path, key].join(".")] ??=
					"is not a recognised field";
			}
			continue;
		}
		fieldErrors[issue.path.join(".") || "(record)"] ??= issue.message;
	}
	const [firstPath, firstMessage] = Object.entries(fieldErrors)[0] ?? [
		"(record)",
		"Invalid record",
	];
	return { message: `${firstPath}: ${firstMessage}`, fieldErrors };
}

// ---------------------------------------------------------------------------
// Requests from a signed-in person
// ---------------------------------------------------------------------------

const REVOCATION_CAUSE_VALUES = [
	"evidence-defect",
	"binding-defect",
	"duplicate",
	"superseded",
	"other",
] as const;

const reasonSchema = z
	.string()
	.trim()
	.min(1, "reason is required")
	.max(
		COMMENT_MAX_LENGTH,
		`reason must be at most ${COMMENT_MAX_LENGTH} characters`
	);

export const revocationRequestSchema = z.strictObject({
	cause: z.enum(REVOCATION_CAUSE_VALUES, {
		message: `cause must be one of ${REVOCATION_CAUSE_VALUES.join(", ")}`,
	}),
	reason: reasonSchema,
});

export const reinstatementRequestSchema = z.strictObject({
	reason: reasonSchema,
});

export const boundCheckRequestSchema = z.strictObject({
	name: z
		.string()
		.trim()
		.min(1, "name is required")
		.max(NAME_MAX_LENGTH, `name must be at most ${NAME_MAX_LENGTH} characters`),
	reason: reasonSchema,
});

/** Query parameters of the evidence list: page size and the `chain_sequence` to page back from. */
export const evidenceListQuerySchema = z.strictObject({
	limit: z.coerce.number().int().min(1).max(200).optional(),
	before: z.coerce.number().int().min(1).optional(),
});
