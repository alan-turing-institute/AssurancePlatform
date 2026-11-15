/**
 * The shared error answers of the published description. Every route sends
 * errors as `{ error, code, fieldErrors? }`; the generator writes only
 * `{ error }` and knows neither the "too large" (413) nor the "too many
 * requests" (429) answers.
 */

import { REQUEST_BODIES } from "./request-bodies";

type Json = Record<string, unknown>;

export const ERROR_SCHEMA = "ApiError";
const ERROR_REF = { $ref: `#/components/schemas/${ERROR_SCHEMA}` };
const JSON_TYPE = "application/json";
const MACHINE_OPERATION = /^\w+ \/machine\//;

/** The `code` values of the error body, one per kind of error the routes raise. */
export const ERROR_CODES = [
	"UNAUTHORISED",
	"FORBIDDEN",
	"NOT_FOUND",
	"VALIDATION",
	"CONFLICT",
	"UNPROCESSABLE",
	"RATE_LIMITED",
	"PAYLOAD_TOO_LARGE",
	"GATEWAY_TIMEOUT",
	"DB_UNAVAILABLE",
	"SERVICE_UNAVAILABLE",
	"INTERNAL",
];

/** The shared error body. */
export const API_ERROR_SCHEMA: Json = {
	type: "object",
	required: ["error", "code"],
	properties: {
		error: { type: "string", description: "A message a person can read" },
		code: { type: "string", enum: ERROR_CODES },
		fieldErrors: {
			type: "object",
			description:
				"For a rejected request body, the message for each field that failed, by field name",
			additionalProperties: { type: "string" },
		},
	},
};

export const PLAIN_ERROR_SCHEMA = "ErrorMessage";

/** The error body of the routes that send a message and no `code`. */
export const PLAIN_ERROR_BODY: Json = {
	type: "object",
	required: ["error"],
	properties: {
		error: { type: "string", description: "A message a person can read" },
	},
};

/** Operations whose error answers carry `{ error }` only. */
const PLAIN_ERROR_OPERATIONS = new Set([
	"GET /cases/{id}/events",
	"GET /auth/link/{provider}",
]);

const SHARED_RESPONSE_PREFIX = "#/components/responses/";

/** The operation's responses, with each shared error answer swapped for one that has the `{ error }` body. */
export function withPlainErrors(
	responses: Json,
	key: string,
	shared: Record<string, Json>
): Json {
	if (!PLAIN_ERROR_OPERATIONS.has(key)) {
		return responses;
	}
	return Object.fromEntries(
		Object.entries(responses).map(([code, response]) => {
			const target = (response as Json).$ref;
			if (
				typeof target !== "string" ||
				!target.startsWith(SHARED_RESPONSE_PREFIX)
			) {
				return [code, response];
			}
			return [
				code,
				{
					description: shared[code]?.description,
					content: {
						[JSON_TYPE]: {
							schema: { $ref: `#/components/schemas/${PLAIN_ERROR_SCHEMA}` },
						},
					},
				},
			];
		})
	);
}

const RETRY_AFTER = {
	description:
		"Seconds to wait before trying again; sent when the server knows how long that is",
	schema: { type: "integer" },
};

function errorResponse(code: string, response: Json): Json {
	const corrected: Json = {
		description: response.description,
		content: { [JSON_TYPE]: { schema: ERROR_REF } },
	};
	return code === "429"
		? { ...corrected, headers: { "Retry-After": RETRY_AFTER } }
		: corrected;
}

/** The shared answers: every one carries the shared error body, and 413 is added. */
export function correctErrorResponses(responses: unknown): Json {
	const found = (responses ?? {}) as Record<string, Json>;
	const all: Record<string, Json> = {
		...found,
		"413": found["413"] ?? { description: "Payload Too Large" },
		"429": found["429"] ?? { description: "Too Many Requests" },
	};
	return Object.fromEntries(
		Object.keys(all)
			.sort()
			.map((code) => [code, errorResponse(code, all[code] ?? {})])
	);
}

/** The error codes an operation adds to the generator's: 413 when it reads a body, 429 on a machine route. */
export function extraErrorCodes(key: string): string[] {
	return [
		...(key in REQUEST_BODIES ? ["413"] : []),
		...(MACHINE_OPERATION.test(key) ? ["429"] : []),
	];
}

/** The operation's responses with a shared-answer reference for each extra error code. */
export function withExtraErrors(responses: Json, key: string): Json {
	const added = Object.fromEntries(
		extraErrorCodes(key).map((code) => [
			code,
			{ $ref: `#/components/responses/${code}` },
		])
	);
	const merged = { ...added, ...responses };
	return Object.fromEntries(
		Object.keys(merged)
			.sort((a, b) => a.localeCompare(b))
			.map((code) => [code, merged[code]])
	);
}
