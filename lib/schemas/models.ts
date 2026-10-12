import { z } from "zod";
import {
	MODEL_CONNECTION_TYPES,
	MODEL_FIELD_LIMITS,
} from "@/lib/models/connection-types";
import {
	hasControlCharacter,
	isPrintableAscii,
} from "@/lib/models/key-characters";

/**
 * Request bodies for the model routes under `/api/user/models`. They check
 * types, lengths and the characters a key may hold; the connection service
 * checks the same limits again and also reads addresses and job rules.
 * The acting user is never part of a body: routes take it from the session.
 */

const labelSchema = z
	.string({ message: "label must be a string" })
	.trim()
	.min(1, "label is required")
	.max(
		MODEL_FIELD_LIMITS.label,
		`label must be at most ${MODEL_FIELD_LIMITS.label} characters`
	);

const baseUrlSchema = z
	.string({ message: "baseUrl must be a string" })
	.trim()
	.min(1, "baseUrl must not be empty")
	.max(
		MODEL_FIELD_LIMITS.baseUrl,
		`baseUrl must be at most ${MODEL_FIELD_LIMITS.baseUrl} characters`
	);

/** A provider key: printable ASCII only, so no space, control character or letter outside ASCII. */
const apiKeySchema = z
	.string({ message: "apiKey must be a string" })
	.trim()
	.min(1, "apiKey must not be empty")
	.max(
		MODEL_FIELD_LIMITS.apiKey,
		`apiKey must be at most ${MODEL_FIELD_LIMITS.apiKey} characters`
	)
	.refine(
		(key) => !hasControlCharacter(key),
		"apiKey must not contain control characters"
	)
	.refine(
		isPrintableAscii,
		"apiKey must contain only printable ASCII characters"
	);

const modelSchema = z
	.string({ message: "model must be a string" })
	.trim()
	.min(1, "model is required")
	.max(
		MODEL_FIELD_LIMITS.model,
		`model must be at most ${MODEL_FIELD_LIMITS.model} characters`
	);

const connectionIdSchema = z
	.string({ message: "connectionId must be a string" })
	.min(1, "connectionId is required")
	.max(100, "connectionId must be at most 100 characters");

/** Body for `POST /api/user/models/connections`. */
export const createConnectionSchema = z.strictObject({
	label: labelSchema,
	type: z.enum(MODEL_CONNECTION_TYPES, {
		message: `type must be one of ${MODEL_CONNECTION_TYPES.join(", ")}`,
	}),
	baseUrl: baseUrlSchema.optional(),
	apiKey: apiKeySchema.optional(),
});

/** Body for `PATCH /api/user/models/connections/[id]`: `apiKey: null` removes the key. */
export const updateConnectionSchema = z
	.strictObject({
		label: labelSchema.optional(),
		baseUrl: baseUrlSchema.optional(),
		apiKey: apiKeySchema.nullable().optional(),
	})
	.refine((body) => Object.keys(body).length > 0, {
		message: "Give at least one of label, baseUrl or apiKey",
	});

const jobSchema = z
	.strictObject({ connectionId: connectionIdSchema, model: modelSchema })
	.nullable();

/** Body for `PUT /api/user/models/roles`: all three jobs, `null` switching one off. */
export const setRolesSchema = z.strictObject({
	chat: jobSchema,
	ranking: jobSchema,
	search: jobSchema,
});

/** Body for `POST /api/user/models/quick-setup`. */
export const quickSetupSchema = z.strictObject({
	openRouterKey: apiKeySchema,
});
