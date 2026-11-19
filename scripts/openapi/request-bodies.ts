/**
 * The request body of every operation that reads one, keyed "METHOD /path"
 * like the table in operations.ts. Each JSON body is the Zod schema the
 * handler validates with, converted by from-zod.ts; `sources` names what the
 * handler passes to its body reader, and the check in
 * lib/__tests__/openapi-matches-routes.test.ts compares it with the route.
 *
 * correct-openapi.ts replaces every operation's request body with the entry
 * here and removes the body from an operation with no entry.
 */

import type { z } from "zod";
import { updateAssuranceCaseSchema } from "../../lib/schemas/assurance-case";
import {
	changePasswordSchema,
	forgotPasswordSchema,
	resetPasswordSchema,
} from "../../lib/schemas/auth";
import { batchUpdateRequestSchema } from "../../lib/schemas/batch-update";
import {
	CaseExportNestedSchema,
	CaseExportV2Schema,
} from "../../lib/schemas/case-export";
import { caseImageUploadSchema } from "../../lib/schemas/case-image";
import { upsertCaseInformationSchema } from "../../lib/schemas/case-information";
import {
	createCommentSchema,
	createElementCommentSchema,
	resolveCommentSchema,
	updateCommentSchema,
} from "../../lib/schemas/comment";
import {
	attachElementSchema,
	createElementSchema,
	moveElementSchema,
	updateElementSchema,
} from "../../lib/schemas/element";
import { GitHubImportSchema } from "../../lib/schemas/github-import";
import {
	backupToDriveSchema,
	importFromDriveSchema,
} from "../../lib/schemas/google-drive";
import { healthCheckListSchema } from "../../lib/schemas/health-checks";
import {
	criteriaRetirementRequestSchema,
	criteriaSaveRequestSchema,
} from "../../lib/schemas/health-criteria";
import {
	boundCheckRequestSchema,
	reinstatementRequestSchema,
	revocationRequestSchema,
} from "../../lib/schemas/health-evidence";
import {
	grantCaseAccessSchema,
	issueTokenSchema,
	registerIntegrationSchema,
	updateIntegrationSchema,
} from "../../lib/schemas/integration";
import {
	createConnectionSchema,
	quickSetupSchema,
	setRolesSchema,
	updateConnectionSchema,
} from "../../lib/schemas/models";
import {
	shareByEmailSchema,
	shareWithTeamSchema,
	updatePermissionSchema,
} from "../../lib/schemas/permission";
import { pluginToggleSchema } from "../../lib/schemas/plugin";
import { publishCaseBodySchema } from "../../lib/schemas/publish";
import { updateCaseStatusSchema } from "../../lib/schemas/status";
import {
	addTeamMemberSchema,
	createTeamSchema,
	updateMemberRoleSchema,
	updateTeamSchema,
} from "../../lib/schemas/team";
import { tourCompletionSchema } from "../../lib/schemas/tour";
import {
	deleteAccountSchema,
	registerUserSchema,
	updateUserProfileSchema,
} from "../../lib/schemas/user";
import { fromZod, type Schema } from "./from-zod";

export interface RequestBody {
	contentType: string;
	/** False when the handler accepts an empty body. */
	required: boolean;
	schema: Schema;
	/** What the handler passes to its body reader: schema names, or the import functions. */
	sources: string[];
}

const JSON_TYPE = "application/json";
const MULTIPART_TYPE = "multipart/form-data";

/** The schema name the case export and import bodies refer to. */
export const CASE_EXPORT_SCHEMA = "CaseExport";
/** The flat (version 2.0) export format, which the import routes also accept. */
export const CASE_EXPORT_FLAT_SCHEMA = "CaseExportFlat";
const CASE_TREE_NODE = "CaseTreeNode";

function json(source: string, schema: z.ZodType): RequestBody {
	return {
		contentType: JSON_TYPE,
		required: true,
		schema: fromZod(schema),
		sources: [source],
	};
}

/** A JSON body the handler accepts empty. */
function optionalJson(source: string, schema: z.ZodType): RequestBody {
	return { ...json(source, schema), required: false };
}

/** A JSON body described by a named component schema. */
function namedBody(source: string, schemaName: string): RequestBody {
	return {
		contentType: JSON_TYPE,
		required: true,
		schema: { $ref: `#/components/schemas/${schemaName}` },
		sources: [source],
	};
}

/** The import body: the nested export (version 1.0 or 1.1) or the flat one (version 2.0). */
function importBody(source: string): RequestBody {
	return {
		contentType: JSON_TYPE,
		required: true,
		schema: {
			oneOf: [
				{ $ref: `#/components/schemas/${CASE_EXPORT_SCHEMA}` },
				{ $ref: `#/components/schemas/${CASE_EXPORT_FLAT_SCHEMA}` },
			],
		},
		sources: [source],
	};
}

/** The share body: a team by id, or a person by email. */
function shareBody(): RequestBody {
	return {
		contentType: JSON_TYPE,
		required: true,
		schema: {
			oneOf: [fromZod(shareWithTeamSchema), fromZod(shareByEmailSchema)],
		},
		sources: ["shareWithTeamSchema", "shareByEmailSchema"],
	};
}

/** The assistant's chat body, which its route declares itself. */
function assistantBody(): RequestBody {
	return {
		contentType: JSON_TYPE,
		required: true,
		sources: ["bodySchema"],
		schema: {
			type: "object",
			required: ["messages"],
			properties: {
				messages: {
					type: "array",
					minItems: 1,
					maxItems: 100,
					items: {
						type: "object",
						required: ["id", "role", "parts"],
						properties: {
							id: { type: "string", maxLength: 200 },
							role: { type: "string", enum: ["user", "assistant"] },
							parts: { type: "array", maxItems: 200, items: {} },
						},
					},
				},
				selectedElementId: { type: "string", format: "uuid" },
				suggestionOutcomes: {
					type: "object",
					additionalProperties: {
						type: "string",
						enum: ["applied", "dismissed", "changed"],
					},
				},
			},
		},
	};
}

function imageUploadBody(): RequestBody {
	return {
		contentType: MULTIPART_TYPE,
		required: true,
		sources: ["readFormDataWithLimit"],
		schema: {
			type: "object",
			required: ["image"],
			properties: { image: { type: "string", format: "binary" } },
		},
	};
}

/** The schemas the bodies above refer to by name. */
export function bodyComponentSchemas(): Record<string, Schema> {
	return {
		[CASE_EXPORT_SCHEMA]: fromZod(CaseExportNestedSchema, [CASE_TREE_NODE]),
		[CASE_EXPORT_FLAT_SCHEMA]: fromZod(CaseExportV2Schema),
	};
}

export const REQUEST_BODIES: Record<string, RequestBody> = {
	"POST /auth/forgot-password": json(
		"forgotPasswordSchema",
		forgotPasswordSchema
	),
	"POST /auth/reset-password": json("resetPasswordSchema", resetPasswordSchema),

	"PUT /cases/{id}": json(
		"updateAssuranceCaseSchema",
		updateAssuranceCaseSchema
	),
	"POST /cases/import": importBody("importCase"),
	"PUT /cases/import": importBody("validateImportData"),
	"POST /cases/backup/gdrive": json("backupToDriveSchema", backupToDriveSchema),
	"POST /cases/import/gdrive": json(
		"importFromDriveSchema",
		importFromDriveSchema
	),
	"POST /cases/import/github": json("GitHubImportSchema", GitHubImportSchema),

	"POST /cases/{id}/assistant": assistantBody(),
	"POST /cases/{id}/batch": json(
		"batchUpdateRequestSchema",
		batchUpdateRequestSchema
	),
	"POST /cases/{id}/comments": json("createCommentSchema", createCommentSchema),
	"POST /cases/{id}/elements": json("createElementSchema", createElementSchema),
	"POST /cases/{id}/image": json(
		"caseImageUploadSchema",
		caseImageUploadSchema
	),
	"POST /cases/{id}/information/image": imageUploadBody(),
	"PUT /cases/{id}/information": json(
		"upsertCaseInformationSchema",
		upsertCaseInformationSchema
	),
	"POST /cases/{id}/permissions": shareBody(),
	"PATCH /cases/{id}/permissions/{permissionId}": json(
		"updatePermissionSchema",
		updatePermissionSchema
	),
	"POST /cases/{id}/publish": optionalJson(
		"publishCaseBodySchema",
		publishCaseBodySchema
	),
	"PATCH /cases/{id}/status": json(
		"updateCaseStatusSchema",
		updateCaseStatusSchema
	),

	"PUT /comments/{id}": json("updateCommentSchema", updateCommentSchema),
	"PATCH /comments/{id}": json("resolveCommentSchema", resolveCommentSchema),

	"PUT /elements/{id}": json("updateElementSchema", updateElementSchema),
	"POST /elements/{id}/attach": json(
		"attachElementSchema",
		attachElementSchema
	),
	"POST /elements/{id}/comments": json(
		"createElementCommentSchema",
		createElementCommentSchema
	),
	"POST /elements/{id}/move": json("moveElementSchema", moveElementSchema),
	"PUT /elements/{id}/health/bound-check": json(
		"boundCheckRequestSchema",
		boundCheckRequestSchema
	),
	"PUT /elements/{id}/health/criteria": json(
		"criteriaSaveRequestSchema",
		criteriaSaveRequestSchema
	),
	"POST /elements/{id}/health/criteria/retirement": json(
		"criteriaRetirementRequestSchema",
		criteriaRetirementRequestSchema
	),
	"POST /elements/{id}/health/records/{recordId}/reinstatement": json(
		"reinstatementRequestSchema",
		reinstatementRequestSchema
	),
	"POST /elements/{id}/health/records/{recordId}/revocation": json(
		"revocationRequestSchema",
		revocationRequestSchema
	),

	"POST /integrations": json(
		"registerIntegrationSchema",
		registerIntegrationSchema
	),
	"PATCH /integrations/{id}": json(
		"updateIntegrationSchema",
		updateIntegrationSchema
	),
	"POST /integrations/{id}/case-grants": optionalJson(
		"grantCaseAccessSchema",
		grantCaseAccessSchema
	),
	"POST /integrations/{id}/tokens": optionalJson(
		"issueTokenSchema",
		issueTokenSchema
	),

	"PUT /machine/health/checks": json(
		"healthCheckListSchema",
		healthCheckListSchema
	),
	"POST /machine/health/elements/{id}/evidence": namedBody(
		"healthEvidenceRecordSchema",
		"HealthEvidenceRecord"
	),

	"POST /teams": json("createTeamSchema", createTeamSchema),
	"PATCH /teams/{id}": json("updateTeamSchema", updateTeamSchema),
	"POST /teams/{id}/members": json("addTeamMemberSchema", addTeamMemberSchema),
	"PATCH /teams/{id}/members/{userId}": json(
		"updateMemberRoleSchema",
		updateMemberRoleSchema
	),

	"POST /user/models/connections": json(
		"createConnectionSchema",
		createConnectionSchema
	),
	"PATCH /user/models/connections/{id}": json(
		"updateConnectionSchema",
		updateConnectionSchema
	),
	"POST /user/models/quick-setup": json("quickSetupSchema", quickSetupSchema),
	"PUT /user/models/roles": json("setRolesSchema", setRolesSchema),
	"PATCH /user/plugins": json("pluginToggleSchema", pluginToggleSchema),
	"PATCH /user/tours": json("tourCompletionSchema", tourCompletionSchema),

	"PATCH /users/me": json("updateUserProfileSchema", updateUserProfileSchema),
	"DELETE /users/me": optionalJson("deleteAccountSchema", deleteAccountSchema),
	"PUT /users/me/password": json("changePasswordSchema", changePasswordSchema),
	"POST /users/register": json("registerUserSchema", registerUserSchema),
};
