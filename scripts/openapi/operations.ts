/**
 * The success answers of every operation in the published API description,
 * keyed "METHOD /path" as the description writes paths (without the /api
 * server prefix). The generator cannot express these: it writes 201 for
 * every POST, 204 for every DELETE and reads only the first `@response`
 * line. correct-openapi.ts replaces each operation's 2xx and 3xx answers
 * with the entry here, so the entry is the single place a route's success
 * answer is stated.
 *
 * A new or changed route needs an entry. The check in
 * lib/__tests__/openapi-matches-routes.test.ts compares every entry with
 * what the handler returns.
 *
 * Shapes here name the top-level fields only; they are not the full data
 * contract of the route.
 */

import { ANSWERS, answerSchemas } from "./answer-shapes";
import { DEFINITIONS, type Schema } from "./from-zod";
import { bodyComponentSchemas } from "./request-bodies";

export type { Schema } from "./from-zod";

export interface SuccessAnswer {
	/** Media type of the body; absent when the answer has no body. */
	contentType?: string;
	description: string;
	schema?: Schema;
	status: number;
}

const JSON_TYPE = "application/json";
const STREAM_TYPE = "text/event-stream";
const IMAGE_TYPE = "image/*";

const STRING: Schema = { type: "string" };
const BOOLEAN: Schema = { type: "boolean" };
const OBJECT: Schema = { type: "object" };
const ARRAY: Schema = { type: "array", items: { type: "object" } };
const BINARY: Schema = { type: "string", format: "binary" };

function ref(name: string): Schema {
	return { $ref: `#/components/schemas/${name}` };
}

function obj(properties: Record<string, Schema>): Schema {
	return { type: "object", properties };
}

function json(
	status: number,
	description: string,
	schema: Schema = OBJECT
): SuccessAnswer {
	return { status, description, contentType: JSON_TYPE, schema };
}

function flag(description = "Done"): SuccessAnswer[] {
	return [json(200, description, ref("SuccessFlag"))];
}

function object(description: string, status = 200): SuccessAnswer[] {
	return [json(status, description)];
}

function list(description: string): SuccessAnswer[] {
	return [json(200, description, ARRAY)];
}

function fields(
	description: string,
	properties: Record<string, Schema>,
	status = 200
): SuccessAnswer[] {
	return [json(status, description, obj(properties))];
}

function stream(description: string): SuccessAnswer[] {
	return [
		{ status: 200, description, contentType: STREAM_TYPE, schema: STRING },
	];
}

function image(description: string): SuccessAnswer[] {
	return [
		{ status: 200, description, contentType: IMAGE_TYPE, schema: BINARY },
		{
			status: 304,
			description: "The image has not changed since the caller's cached copy",
		},
	];
}

/** Named schemas the entries below refer to; added to the document's components. */
const NAMED_SCHEMAS: Record<string, Schema> = {
	SuccessFlag: obj({ success: BOOLEAN }),
	ConnectedFlag: obj({ connected: BOOLEAN }),
};

const ANSWER_SCHEMAS = answerSchemas();
const BODY_SCHEMAS = bodyComponentSchemas();

/** Named schemas the entries here and in request-bodies.ts refer to; added to the document's components. */
export const SCHEMAS: Record<string, Schema> = {
	...NAMED_SCHEMAS,
	...ANSWER_SCHEMAS,
	...BODY_SCHEMAS,
	...DEFINITIONS,
};

export interface QueryParameter {
	description: string;
	name: string;
	required?: boolean;
	schema: Schema;
}

function query(
	name: string,
	description: string,
	schema: Schema = STRING,
	required = false
): QueryParameter {
	return { name, description, schema, required };
}

const DRY_RUN = query(
	"dryRun",
	"`1` or `true` works out what would happen and changes nothing; `0`, `false` or no parameter does the work",
	{ type: "string", enum: ["1", "true", "0", "false"] }
);

/**
 * Query parameters of the operations that read any. The generator reads them
 * only from a tag form the routes do not use, so they are stated here.
 */
export const QUERY_PARAMETERS: Record<string, QueryParameter[]> = {
	"GET /auth/reset-password": [
		query("token", "The reset token from the email", STRING, true),
	],
	"DELETE /cases/{id}": [
		query(
			"archive",
			"`true` keeps the case's published copy as an archived copy; anything else removes it",
			{ type: "string", enum: ["true", "false"] }
		),
	],
	"GET /cases/{id}/changes": [
		query("includeDetails", "`true` includes a summary of the changes", {
			type: "string",
			enum: ["true", "false"],
		}),
	],
	"GET /cases/export": [
		query("id", "The case to export", STRING, true),
		query(
			"includeComments",
			"`false` leaves the comments out; anything else includes them",
			{ type: "string", enum: ["true", "false"] }
		),
	],
	"POST /cron/health-evidence-thinning": [
		DRY_RUN,
		query(
			"now",
			"An ISO 8601 date-time the cut-off is measured from, held to no later than the server's own time",
			{ type: "string", format: "date-time" }
		),
	],
	"POST /cron/retention-sweep": [DRY_RUN],
	"DELETE /cases/{id}/permissions/{permissionId}": [
		query(
			"type",
			"`team` removes a team's permission; anything else removes a user's",
			{ type: "string", enum: ["team", "user"] }
		),
	],
	"GET /machine/health/elements/{id}/evidence": [
		query("limit", "Page size, from 1 to 200", {
			type: "integer",
			minimum: 1,
			maximum: 200,
		}),
		query("before", "Returns records older than this `chain_sequence`", {
			type: "integer",
			minimum: 1,
		}),
		query(
			"live",
			"`true` returns only records that are not revoked and whose validity has not run out",
			{
				type: "string",
				enum: ["true", "false"],
			}
		),
	],
};

const CLAIM_STATUS = ref("ClaimHealthStatus");

const INTEGRATION = fields("The integration", { integration: OBJECT });
const CRITERIA = object("The claim's evidence settings");

export const OPERATIONS: Record<string, SuccessAnswer[]> = {
	"POST /auth/forgot-password": fields(
		"The same answer whether or not the account exists",
		{ success: BOOLEAN, message: STRING }
	),
	"GET /auth/reset-password": fields("The token is valid", {
		valid: BOOLEAN,
		email: STRING,
	}),
	"POST /auth/reset-password": fields("The password was reset", {
		success: BOOLEAN,
		message: STRING,
	}),
	"GET /auth/link/{provider}": [
		{
			status: 307,
			description:
				"Redirects to the provider's sign-in page, or to the login page when there is no session",
		},
	],

	"GET /cases/{id}": object("The case with its nested elements"),
	"PUT /cases/{id}": object("The updated case"),
	"DELETE /cases/{id}": flag("The case was moved to Trash"),
	"GET /cases/export": [
		json(
			200,
			"The case in the export format, sent as a file download named after the case",
			ref("CaseExport")
		),
	],
	"POST /cases/import": [json(200, "The imported case", ref("ImportResult"))],
	"PUT /cases/import": [
		json(200, "The preview of an import", {
			type: "object",
			required: [
				"isValid",
				"version",
				"caseName",
				"elementCount",
				"evidenceLinkCount",
				"warnings",
			],
			properties: {
				isValid: BOOLEAN,
				version: {
					type: "string",
					nullable: true,
					enum: ["nested", "flat", null],
					description:
						"The format found in the file, or null when none matched",
				},
				caseName: STRING,
				elementCount: { type: "integer" },
				evidenceLinkCount: { type: "integer" },
				warnings: { type: "array", items: STRING },
			},
		}),
	],
	"GET /cases/trash": list("The caller's cases in Trash"),
	"GET /cases/trash/archived": list("The caller's archived copies"),
	"DELETE /cases/trash/archived/{publishedId}": flag(
		"The archived copy was deleted"
	),
	"POST /cases/backup/gdrive": fields("The backup file", {
		success: BOOLEAN,
		fileId: STRING,
		fileName: STRING,
		webViewLink: STRING,
	}),
	"GET /cases/backup/gdrive": [
		json(200, "Whether Google Drive is connected", ref("ConnectedFlag")),
	],
	"POST /cases/import/gdrive": [
		json(200, "The imported case", ref("ImportResultFromDrive")),
	],
	"GET /cases/import/gdrive": fields(
		"Whether Google Drive is connected, and the files that can be imported",
		{ connected: BOOLEAN, files: ARRAY }
	),
	"POST /cases/import/github": [
		json(200, "The imported case", ref("ImportResultFromGitHub")),
	],
	"GET /cases/import/github": [
		json(200, "Whether GitHub is connected", ref("ConnectedFlag")),
	],

	"POST /cases/{id}/assistant": stream(
		"The assistant's reply as a stream of messages"
	),
	"POST /cases/{id}/batch": fields("A summary of the changes made", {
		success: BOOLEAN,
		summary: OBJECT,
	}),
	"GET /cases/{id}/changes": object(
		"What changed since the case was published"
	),
	"GET /cases/{id}/comments": list("The case's comments"),
	"POST /cases/{id}/comments": object("The new comment", 201),
	"POST /cases/{id}/elements": object("The new element", 201),
	"GET /cases/{id}/events": stream(
		"Server-sent events for changes to the case"
	),
	"GET /cases/{id}/health/checks": list(
		"The checks bound to the case's claims"
	),
	"GET /cases/{id}/health/evidence-nodes": list(
		"The case's evidence nodes with their claims"
	),
	"GET /cases/{id}/health/hygiene": object("Counts of claims set up weakly"),
	"GET /cases/{id}/image": object("The case's image"),
	"POST /cases/{id}/image": object(
		"The saved image, or a notice that the upload was throttled"
	),
	"POST /cases/{id}/information/image": fields("The feature image's address", {
		featureImageUrl: STRING,
	}),
	"DELETE /cases/{id}/information/image": flag("The feature image was removed"),
	"GET /cases/{id}/information": [
		json(
			200,
			"The case information, or null if none exists",
			ANSWERS.caseInformation
		),
	],
	"PUT /cases/{id}/information": object("The saved case information"),
	"GET /cases/{id}/media/feature": image("The feature image"),
	"GET /cases/{id}/media/screenshot": image("The screenshot"),
	"PATCH /cases/{id}/permissions/{permissionId}": object(
		"The updated permission"
	),
	"DELETE /cases/{id}/permissions/{permissionId}": flag(
		"The permission was removed"
	),
	"GET /cases/{id}/permissions": object(
		"Who has access to the case, directly and through teams"
	),
	"POST /cases/{id}/permissions": [
		json(200, "The user already has access"),
		json(
			201,
			"The user's or team's permission, or an invite link when the user has no account"
		),
	],
	"GET /cases/{id}/publish": fields("The case's publication state", {
		is_published: BOOLEAN,
		published_id: STRING,
		published_at: STRING,
	}),
	"POST /cases/{id}/publish": fields("The case was published", {
		published_id: STRING,
		published_at: STRING,
	}),
	"DELETE /cases/{id}/publish": flag("The case was unpublished"),
	"DELETE /cases/{id}/purge": flag("The case was deleted for good"),
	"POST /cases/{id}/restore": flag("The case was restored from Trash"),
	"GET /cases/{id}/sandbox": list("The elements in the case's sandbox"),
	"GET /cases/{id}/status": object("The case's publication status"),
	"PATCH /cases/{id}/status": fields("The status was changed", {
		success: BOOLEAN,
		newStatus: STRING,
		publishedId: STRING,
		publishedAt: STRING,
	}),
	"POST /cases/{id}/update-ids": fields("The identifiers were reset", {
		message: STRING,
	}),

	"DELETE /comments/{id}": object("The deleted comment"),
	"PUT /comments/{id}": object("The updated comment"),
	"PATCH /comments/{id}": object("The updated comment"),

	"POST /cron/health-evidence-thinning": [
		json(
			200,
			"What the run removed; `dryRun` echoes the query and `more` says whether another call is needed",
			ANSWERS.evidenceThinning
		),
	],
	"POST /cron/health-staleness-sweep": [
		json(
			200,
			"How many claims and cases were newly notified",
			ANSWERS.stalenessSweep
		),
	],
	"POST /cron/purge-trash": [
		json(
			200,
			"The cut-off date and how many cases were purged",
			ANSWERS.purgeTrash
		),
	],
	"POST /cron/retention-sweep": [
		json(
			200,
			"How many accounts were warned and deleted; with `dryRun` the counts are what would happen",
			ANSWERS.retentionSweep
		),
	],

	"GET /public/discover/{slug}": [
		json(
			200,
			"The current published version of the item, with its frozen snapshot",
			ref("PublishedItem")
		),
	],
	"GET /public/discover/{slug}/image/{versionId}": image(
		"The published case's feature image"
	),

	"GET /elements/{id}": object("The element"),
	"PUT /elements/{id}": object("The updated element"),
	"DELETE /elements/{id}": flag("The element was deleted"),
	"POST /elements/{id}/attach": flag("The element was attached"),
	"GET /elements/{id}/comments": list("The element's comments"),
	"POST /elements/{id}/comments": object("The new comment", 201),
	"POST /elements/{id}/detach": flag("The element was detached"),
	"POST /elements/{id}/move": flag("The element was moved"),
	"POST /elements/{id}/restore": flag("The element was restored"),
	"GET /elements/{id}/health": [
		json(200, "The claim's status, or null", ref("ClaimHealthStatus")),
	],
	"PUT /elements/{id}/health/bound-check": [
		json(200, "The claim's status", CLAIM_STATUS),
	],
	"GET /elements/{id}/health/criteria": CRITERIA,
	"PUT /elements/{id}/health/criteria": CRITERIA,
	"POST /elements/{id}/health/criteria/retirement": CRITERIA,
	"POST /elements/{id}/health/evidence-node": CRITERIA,
	"POST /elements/{id}/health/records/{recordId}/reinstatement": [
		json(
			200,
			"The claim's status after the record was reinstated",
			CLAIM_STATUS
		),
	],
	"POST /elements/{id}/health/records/{recordId}/revocation": fields(
		"The revocation and the claim's status",
		{ revocation: OBJECT, status: OBJECT },
		201
	),

	"GET /health": object("The service is healthy"),

	"GET /integrations": fields("The caller's integrations", {
		integrations: ARRAY,
	}),
	"POST /integrations": fields(
		"The new integration, without a token",
		{ integration: OBJECT },
		201
	),
	"PATCH /integrations/{id}": INTEGRATION,
	"DELETE /integrations/{id}": flag("The integration was deleted"),
	"GET /integrations/{id}/case-grants": fields(
		"The cases the integration may read",
		{
			grants: ARRAY,
		}
	),
	"POST /integrations/{id}/case-grants": [
		json(200, "The grant already had this permission level"),
		json(201, "A new grant, or a grant whose permission level changed"),
	],
	"DELETE /integrations/{id}/case-grants/{caseId}": flag(
		"The grant was removed"
	),
	"POST /integrations/{id}/reactivate": INTEGRATION,
	"POST /integrations/{id}/revoke": INTEGRATION,
	"POST /integrations/{id}/suspend": INTEGRATION,
	"POST /integrations/{id}/tokens": fields(
		"The new token and its secret, shown once",
		{ secret: STRING, token: OBJECT },
		201
	),
	"DELETE /integrations/{id}/tokens/{tokenId}": flag("The token was revoked"),
	"POST /integrations/{id}/tokens/{tokenId}/rotate": fields(
		"The new token and its secret, shown once",
		{
			secret: STRING,
			token: OBJECT,
			oldTokenId: STRING,
			overlapUntil: STRING,
		}
	),

	"POST /invites/{token}/accept": fields("The invite was accepted", {
		success: BOOLEAN,
		case_id: STRING,
		redirect_url: STRING,
	}),

	"GET /machine/whoami": [
		json(200, "The integration the token belongs to", ANSWERS.whoami),
	],
	"PUT /machine/health/checks": [
		json(
			200,
			"How many checks were stored, and a warning for each recommendation that would not pass as evidence settings",
			ANSWERS.publishedChecks
		),
	],
	"GET /machine/health/cases/{id}/criteria": [
		json(
			200,
			"The evidence settings accepted for the case's claims",
			ANSWERS.caseCriteria
		),
	],
	"GET /machine/health/cases/{id}/status": [
		json(
			200,
			"The status of each claim in the case that has one",
			ANSWERS.caseStatuses
		),
	],
	"GET /machine/health/elements/{id}/criteria": [
		json(200, "The claim's accepted evidence settings", ref("MachineCriteria")),
	],
	"GET /machine/health/elements/{id}/evidence": [
		json(
			200,
			"The claim's evidence records, newest first; `next_before` is the value to pass as `before` for the next page, or null on the last page",
			ANSWERS.evidencePage
		),
	],
	"POST /machine/health/elements/{id}/evidence": [
		json(
			201,
			"The stored record and the claim's status",
			ANSWERS.appendedEvidence
		),
	],
	"GET /machine/health/elements/{id}/status": [
		json(200, "The claim's status, or null", CLAIM_STATUS),
	],

	"GET /teams": list("The caller's teams"),
	"POST /teams": object("The new team", 201),
	"GET /teams/{id}": object("The team"),
	"PATCH /teams/{id}": object("The updated team"),
	"DELETE /teams/{id}": flag("The team was deleted"),
	"POST /teams/{id}/leave": flag("The caller left the team"),
	"GET /teams/{id}/members": list("The team's members"),
	"POST /teams/{id}/members": [
		json(200, "The user is already a member, or has no account"),
		json(201, "The new member"),
	],
	"PATCH /teams/{id}/members/{userId}": object("The updated member"),
	"DELETE /teams/{id}/members/{userId}": flag("The member was removed"),

	"GET /templates": fields("The available templates", {
		newTemplates: ARRAY,
		defaultCase: OBJECT,
	}),

	"GET /user/models": fields("The caller's model connections and jobs", {
		connections: ARRAY,
		roles: OBJECT,
		recommended: OBJECT,
		connectionTypes: ARRAY,
	}),
	"POST /user/models/connections": object("The new connection", 201),
	"PATCH /user/models/connections/{id}": object("The updated connection"),
	"DELETE /user/models/connections/{id}": flag("The connection was deleted"),
	"POST /user/models/connections/{id}/test": object("The result of the test"),
	"POST /user/models/quick-setup": fields(
		"The new connection and the jobs it was assigned to",
		{
			connection: OBJECT,
			roles: OBJECT,
			searchCheck: OBJECT,
			unsetJobs: { type: "array", items: STRING },
		},
		201
	),
	"PUT /user/models/roles": fields("The saved jobs", {
		roles: OBJECT,
		searchCheck: OBJECT,
	}),
	"GET /user/plugins": fields("The plugins and whether each is enabled", {
		plugins: ARRAY,
	}),
	"PATCH /user/plugins": fields("The plugin's new state", {
		pluginId: STRING,
		enabled: BOOLEAN,
		settings: OBJECT,
	}),
	"GET /user/plugins/{pluginId}/consequences": object(
		"What turning the plugin off would affect"
	),
	"GET /user/tours": fields("The tours the caller has completed", {
		completedTours: { type: "array", items: STRING },
	}),
	"PATCH /user/tours": fields("The tours the caller has completed", {
		completedTours: { type: "array", items: STRING },
	}),

	"GET /users/me": object("The caller's profile"),
	"PATCH /users/me": object("The updated profile"),
	"DELETE /users/me": flag("The account was deleted"),
	"POST /users/me/migration-notice": flag("The notice was dismissed"),
	"PUT /users/me/password": flag("The password was changed"),
	"POST /users/register": object("The new account", 201),
};
