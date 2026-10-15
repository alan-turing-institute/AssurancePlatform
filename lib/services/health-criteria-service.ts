import { canonicalJSON } from "@/lib/health-canonical-json";
import { evidenceNodeText } from "@/lib/health-evidence-node-text";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	checkListIssues,
	computeSource,
	countersOf,
	type EchoDifference,
	echoAgainst,
	type HealthCriteriaSettings,
	issuesToFieldErrors,
	nextCounters,
	type ServedSettings,
	type SettingsSource,
	servedFromStored,
	servedSettings,
} from "@/lib/schemas/health-criteria";
import type { HealthEvidenceRecord } from "@/lib/schemas/health-evidence";
import {
	createElementWithin,
	deleteElementWithin,
	type ElementResponse,
	unlinkEvidenceWithin,
	updateElementWithin,
} from "@/lib/services/element-service";
import { loadOfferedChecks } from "@/lib/services/health-check-catalogue-service";
import {
	DELETED_USER_NAME,
	guardCaseAccess,
	guardClaimAccess,
	usernamesById,
} from "@/lib/services/health-claim-access";
import {
	applyBoundCheck,
	type HealthTransaction,
} from "@/lib/services/health-evidence-service";
import {
	type EvidenceNodeView,
	readClaimEvidenceNode,
} from "@/lib/services/health-status-service";
import {
	type PluginHealthCriteria,
	type PluginHealthCriteriaAction,
	type PluginHealthCriteriaState,
	Prisma,
} from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ component: "health-criteria-service" });

/**
 * A claim's evidence settings (`plugin_health_criteria`) and their history
 * (`plugin_health_criteria_revisions`). Every write takes the claim's
 * element-row lock first, the same lock an arriving result takes, so a save
 * cannot interleave with a result being compared with the settings. A row is
 * never deleted while its claim exists: stopping the use of settings sets the
 * state to inactive, so the revision number and the version counters carry
 * on. The history is append-only: nothing here updates or deletes a row of it.
 */

/** The same 400 for an unknown integration, one without access, and a check it does not offer. */
const CHECK_NOT_OFFERED = "Check not offered for this case";
const ACCEPTED_CANNOT_SUGGEST =
	"Accepted settings cannot be saved as a suggestion";
const CHANGED_BY_SOMEONE_ELSE = "These settings were changed by someone else";
const ALREADY_INACTIVE = "These settings are already inactive";
const SETTINGS_NOT_FOUND = "Settings not found";
const CLAIM_NOT_FOUND = "Claim not found";
const SETTINGS_NOT_ACCEPTED = "These settings are not accepted";
const LIVE_NODE_EXISTS = "This claim already has a live evidence node";

/**
 * A change to an element that a request made as well as the settings change,
 * for the route to announce to open browsers after the transaction commits.
 * `element` is absent when the element itself did not change (a node taken off
 * one claim but kept for another).
 */
export interface ElementEvent {
	element?: ElementResponse;
	elementId: string;
	elementName: string | null;
	kind: "created" | "deleted" | "updated";
}

/** A failed validation that names the offending fields. */
export interface InvalidSettings {
	fieldErrors: Record<string, string>;
	message: string;
}

export type CriteriaResult<T> = Promise<
	{ data: T } | { error: string } | { invalid: InvalidSettings }
>;

type StateWire = "suggested" | "accepted" | "inactive";
type ActionWire = "suggested" | "accepted" | "edited" | "retired" | "discarded";

const STATE_TO_WIRE: Record<PluginHealthCriteriaState, StateWire> = {
	SUGGESTED: "suggested",
	ACCEPTED: "accepted",
	INACTIVE: "inactive",
};

const ACTION_TO_WIRE: Record<PluginHealthCriteriaAction, ActionWire> = {
	SUGGESTED: "suggested",
	ACCEPTED: "accepted",
	EDITED: "edited",
	RETIRED: "retired",
	DISCARDED: "discarded",
};

function invalid(field: string, message: string): { invalid: InvalidSettings } {
	return {
		invalid: {
			message: `${field}: ${message}`,
			fieldErrors: { [field]: message },
		},
	};
}

function lockClaim(tx: HealthTransaction, claimId: string) {
	return tx.$queryRaw<
		{ deleted_at: Date | null; id: string }[]
	>`SELECT id, deleted_at FROM assurance_elements WHERE id = ${claimId} FOR UPDATE`;
}

/** What a change to a claim's settings gives back: the settings as read after it, and the element change to announce. */
export interface CriteriaChange {
	caseId: string;
	elementEvent?: ElementEvent;
	view: CriteriaView;
}

/** Retry message for every failure that means another change to the case got in first. */
const CASE_CHANGED = "The case changed while you were saving. Try again.";

/** Prisma codes for: unique index, foreign key, record not found, write conflict or deadlock. */
const COLLISION_CODES = new Set(["P2002", "P2003", "P2025", "P2034"]);

/** A row this transaction read was removed by another writer before it could be locked. */
class RowVanishedError extends Error {}

/** What the database driver reported underneath a Prisma error, when it reported anything. */
function driverCauseOf(
	error: Prisma.PrismaClientKnownRequestError
): { kind?: string; originalCode?: string } | undefined {
	const meta = error.meta as
		| {
				driverAdapterError?: {
					cause?: { kind?: string; originalCode?: string };
				};
		  }
		| undefined;
	return meta?.driverAdapterError?.cause;
}

/**
 * Whether a failure inside a health transaction means a concurrent change to
 * the case got in first: a deadlock (Postgres 40P01, which a raw query such as
 * the row lock reports as P2010 with the driver's code underneath), a record
 * that went missing, or a unique index (the node pointer or the evidence link)
 * taken by another writer. Retrying the request is the right response to each.
 */
export function isConcurrentChange(error: unknown): boolean {
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		const cause = driverCauseOf(error);
		return (
			COLLISION_CODES.has(error.code) ||
			cause?.originalCode === "40P01" ||
			cause?.kind === "TransactionWriteConflict"
		);
	}
	return error instanceof RowVanishedError;
}

/**
 * Takes the evidence node's row lock. Every write that needs it takes the
 * claim's lock first, so the order is always claim and then node. The node
 * was read as the claim's a moment ago, so a row that is gone by the time the
 * lock is granted was removed by a concurrent change, which ends the
 * transaction with the retry message.
 */
async function lockEvidenceNode(
	tx: HealthTransaction,
	nodeId: string
): Promise<void> {
	const rows = await tx.$queryRaw<
		{ id: string }[]
	>`SELECT id FROM assurance_elements WHERE id = ${nodeId} FOR UPDATE`;
	if (rows.length === 0) {
		throw new RowVanishedError(nodeId);
	}
}

/**
 * The error a failed transaction gives back: the retry message when another
 * change to the case got in first, otherwise `fallback`.
 */
function failedWith(
	error: unknown,
	logMessage: string,
	fallback: string
): { error: string } {
	if (isConcurrentChange(error)) {
		log.warn(`${logMessage}: another change to the case got in first`, {
			error,
		});
		return { error: CASE_CHANGED };
	}
	log.error(logMessage, { error });
	return { error: fallback };
}

/** The success a change to a claim's settings gives back. */
async function changed(
	claimId: string,
	caseId: string,
	elementEvent: ElementEvent | undefined
): Promise<{ data: CriteriaChange }> {
	return {
		data: {
			caseId,
			view: await buildCriteriaView(claimId, caseId),
			elementEvent,
		},
	};
}

/** Whether `integrationId` still names an active integration; the row cannot be deleted until the transaction ends. */
async function integrationIsActive(
	tx: HealthTransaction,
	integrationId: string
): Promise<boolean> {
	const rows = await tx.$queryRaw<
		{ status: string }[]
	>`SELECT status FROM integrations WHERE id = ${integrationId} FOR KEY SHARE`;
	return rows[0]?.status === "ACTIVE";
}

// ---------------------------------------------------------------------------
// What is served
// ---------------------------------------------------------------------------

export type ServedCriteria = ServedSettings & {
	accepted_at: string | null;
	revision: number;
	source: SettingsSource;
	state: StateWire;
	updated_at: string;
};

function servedCriteria(row: PluginHealthCriteria): ServedCriteria {
	return {
		state: STATE_TO_WIRE[row.state],
		revision: row.revision,
		...servedFromStored(row),
		source: row.source as unknown as SettingsSource,
		accepted_at: row.acceptedAt?.toISOString() ?? null,
		updated_at: row.updatedAt.toISOString(),
	};
}

export type CheckOffer = "current" | "newer-version" | "not-offered";

export interface CriteriaView {
	accepted_by: { name: string; owns_integration: boolean } | null;
	/** The check's entry in the check list as it was when the check was last found there; null when the claim has no settings. */
	check_description: HealthCheck | null;
	check_offer: CheckOffer | null;
	criteria: ServedCriteria | null;
	/** The evidence element added under the claim when its settings were accepted, and where it is now; null when the claim has none. */
	evidence_node: EvidenceNodeView | null;
	integration: { id: string; name: string } | null;
	last_change: {
		action: ActionWire;
		at: string;
		by_name: string;
		reason: string | null;
	} | null;
	latest_result: { differences: EchoDifference[]; record_id: string } | null;
	pipeline_read: { at: string; revision: number | null } | null;
}

const NO_CRITERIA: CriteriaView = {
	criteria: null,
	evidence_node: null,
	check_description: null,
	integration: null,
	accepted_by: null,
	last_change: null,
	pipeline_read: null,
	check_offer: null,
	latest_result: null,
};

async function checkOfferOf(
	row: PluginHealthCriteria,
	caseId: string
): Promise<CheckOffer> {
	if (!row.integrationId) {
		return "not-offered";
	}
	const offered = await loadOfferedChecks(row.integrationId, caseId);
	const named = offered?.checks.filter((check) => check.name === row.checkName);
	if (!named || named.length === 0) {
		return "not-offered";
	}
	const version = (row.settings as { check: { version: string } }).check
		.version;
	return named.some((check) => check.version === version)
		? "current"
		: "newer-version";
}

async function latestResultOf(
	row: PluginHealthCriteria
): Promise<CriteriaView["latest_result"]> {
	if (row.state !== "ACCEPTED") {
		return null;
	}
	const current = await prisma.pluginHealthEvidence.findFirst({
		where: {
			claimId: row.claimId,
			revocations: { none: { reinstatedAt: null } },
		},
		orderBy: [{ recordTimestamp: "desc" }, { chainSequence: "desc" }],
		select: { recordId: true, record: true },
	});
	if (!current) {
		return null;
	}
	const echo = echoAgainst(
		current.record as unknown as HealthEvidenceRecord,
		row
	);
	return { record_id: current.recordId, differences: echo.differences ?? [] };
}

async function buildCriteriaView(
	claimId: string,
	caseId: string
): Promise<CriteriaView> {
	const row = await prisma.pluginHealthCriteria.findUnique({
		where: { claimId },
	});
	if (!row) {
		return NO_CRITERIA;
	}
	const [integration, newest, offer, latest, node] = await Promise.all([
		row.integrationId
			? prisma.integration.findUnique({
					where: { id: row.integrationId },
					select: { id: true, name: true },
				})
			: null,
		prisma.pluginHealthCriteriaRevision.findFirst({
			where: { claimId },
			orderBy: { revision: "desc" },
		}),
		row.state === "INACTIVE" ? null : checkOfferOf(row, caseId),
		latestResultOf(row),
		readClaimEvidenceNode(claimId),
	]);
	const names = await usernamesById(
		[row.acceptedById, newest?.actorId].filter(
			(id): id is string => typeof id === "string"
		)
	);
	const nameOf = (id: string) => names.get(id) ?? DELETED_USER_NAME;
	return {
		criteria: servedCriteria(row),
		evidence_node: node?.node ?? null,
		check_description: row.checkDescription as unknown as HealthCheck,
		integration,
		accepted_by:
			row.state === "ACCEPTED" && row.acceptedById
				? {
						name: nameOf(row.acceptedById),
						owns_integration: row.acceptedByOwnsIntegration,
					}
				: null,
		last_change: newest
			? {
					action: ACTION_TO_WIRE[newest.action],
					by_name: nameOf(newest.actorId),
					at: newest.createdAt.toISOString(),
					reason: newest.reason,
				}
			: null,
		pipeline_read: row.lastReadAt
			? { at: row.lastReadAt.toISOString(), revision: row.lastReadRevision }
			: null,
		check_offer: offer,
		latest_result: latest,
	};
}

/**
 * One claim's evidence settings with everything a person needs to read them:
 * who accepted them, the newest change, whether and when the pipeline read
 * them, whether the check is still offered, and how the claim's current result
 * compares. Requires VIEW.
 */
export async function readCriteria(
	actingUserId: string,
	claimId: string
): ServiceResult<CriteriaView> {
	const guard = await guardClaimAccess(actingUserId, claimId, "VIEW");
	if ("error" in guard) {
		return { error: guard.error };
	}
	try {
		return { data: await buildCriteriaView(claimId, guard.caseId) };
	} catch (error) {
		log.error("Failed to read health criteria", { error });
		return { error: "Failed to read evidence settings" };
	}
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

export interface SaveCriteriaInput {
	accept: boolean;
	/** Add an evidence node under the claim; only when the save moves settings to accepted from not accepted. */
	add_evidence_node?: boolean;
	/** When present, the stored revision (null for none) the save is allowed to replace. */
	expected_revision?: number | null;
	integration_id: string;
	settings: HealthCriteriaSettings;
	/** Rewrite the live node's text to name the new check; only when the check changes and the node is live. */
	update_evidence_node_text?: boolean;
}

type SaveOutcome =
	| { kind: "saved"; change?: ElementEvent }
	| { kind: "refused"; error: string }
	| { kind: "invalid"; invalid: InvalidSettings };

interface SaveContext {
	caseId: string;
	/** The check's entry in the list as published now, or null when the check is no longer listed. */
	check: HealthCheck | null;
	/** The entry the save is judged against and stores: the listed one, or the stored copy. */
	description: HealthCheck;
	input: SaveCriteriaInput;
	integrationName: string;
	ownerId: string;
	pipeline: string;
	userId: string;
}

type SaveBase = Omit<SaveContext, "check" | "description">;

function checkCore(settings: HealthCriteriaSettings) {
	const { name, version, params } = settings.check;
	return { name, version, params: params ?? {} };
}

/** The settings with the check's scope filled in from the list (or kept from the previous save). */
function withScope(
	settings: HealthCriteriaSettings,
	scope: string | undefined
): HealthCriteriaSettings {
	return scope === undefined
		? settings
		: { ...settings, check: { ...settings.check, scope } };
}

/** The state a save leaves and the history action it is recorded as. */
function stateAndAction(
	previous: PluginHealthCriteriaState | undefined,
	accept: boolean
): { action: PluginHealthCriteriaAction; state: PluginHealthCriteriaState } {
	if (previous === "ACCEPTED") {
		return { state: "ACCEPTED", action: "EDITED" };
	}
	if (accept) {
		return { state: "ACCEPTED", action: "ACCEPTED" };
	}
	return {
		state: "SUGGESTED",
		action: previous === "SUGGESTED" ? "EDITED" : "SUGGESTED",
	};
}

/** Who accepted and when: set on acceptance, kept on a later edit, cleared on a suggestion. */
function acceptanceColumns(
	state: PluginHealthCriteriaState,
	previous: PluginHealthCriteria | null,
	who: { integrationId: string; ownerId: string; userId: string },
	now: Date
) {
	if (state === "SUGGESTED") {
		return {
			acceptedById: null,
			acceptedAt: null,
			acceptedByOwnsIntegration: false,
		};
	}
	if (previous?.state === "ACCEPTED") {
		return previous.integrationId === who.integrationId
			? {}
			: { acceptedByOwnsIntegration: previous.acceptedById === who.ownerId };
	}
	return {
		acceptedById: who.userId,
		acceptedAt: now,
		acceptedByOwnsIntegration: who.ownerId === who.userId,
	};
}

async function writeSave(
	tx: HealthTransaction,
	claimId: string,
	context: SaveContext,
	previous: PluginHealthCriteria | null,
	settings: HealthCriteriaSettings,
	nodeId?: string
): Promise<void> {
	const { input, userId } = context;
	const previousSettings = previous
		? (previous.settings as unknown as HealthCriteriaSettings)
		: null;
	const counters = nextCounters(
		previous && previousSettings
			? { counters: countersOf(previous), settings: previousSettings }
			: null,
		settings
	);
	const source = computeSource(
		settings,
		context.check,
		previous && previousSettings
			? {
					settings: previousSettings,
					source: previous.source as unknown as SettingsSource,
				}
			: null
	);
	const { state, action } = stateAndAction(previous?.state, input.accept);
	const now = new Date();
	const revision = (previous?.revision ?? 0) + 1;
	const acceptance = acceptanceColumns(
		state,
		previous,
		{
			userId,
			ownerId: context.ownerId,
			integrationId: input.integration_id,
		},
		now
	);
	const data = {
		integrationId: input.integration_id,
		state,
		checkName: settings.check.name,
		settings: settings as unknown as Prisma.InputJsonObject,
		ruleVersion: counters.rule,
		reductionVersion: counters.reduction,
		aggregationVersion: counters.aggregation,
		source: source as unknown as Prisma.InputJsonObject,
		checkDescription: context.description as unknown as Prisma.InputJsonObject,
		revision,
		updatedById: userId,
		updatedAt: now,
		...acceptance,
		...(nodeId ? { evidenceElementId: nodeId } : {}),
	};
	if (previous) {
		await tx.pluginHealthCriteria.update({ where: { claimId }, data });
	} else {
		await tx.pluginHealthCriteria.create({ data: { claimId, ...data } });
	}
	await tx.pluginHealthCriteriaRevision.create({
		data: {
			claimId,
			revision,
			action,
			declaration: servedSettings(
				settings,
				counters
			) as unknown as Prisma.InputJsonObject,
			integrationName: context.integrationName,
			pipelineName: context.pipeline,
			actorId: userId,
		},
	});
	if (state === "ACCEPTED") {
		await applyBoundCheck(tx, {
			claimId,
			name: settings.check.name,
			source: "DECLARATION",
			changedById: userId,
		});
	}
}

function findOffered(
	offered: HealthCheck[],
	settings: HealthCriteriaSettings
): HealthCheck | null {
	const { name, version } = settings.check;
	return (
		offered.find((entry) => entry.name === name && entry.version === version) ??
		null
	);
}

/** Whether the check's name, version and own settings are the same in both. Key order does not matter. */
function sameCheck(
	before: HealthCriteriaSettings,
	after: HealthCriteriaSettings
): boolean {
	return canonicalJSON(checkCore(before)) === canonicalJSON(checkCore(after));
}

/**
 * The stored copy of the check's entry, when `input` names the same check
 * (name and version) and the same integration and the settings are not
 * inactive: the only case in which a check that has left the list may still
 * be saved against.
 */
function storedCheckCopy(
	input: SaveCriteriaInput,
	previous: PluginHealthCriteria | null
): HealthCheck | null {
	if (
		!previous ||
		previous.state === "INACTIVE" ||
		previous.integrationId !== input.integration_id
	) {
		return null;
	}
	const before = (previous.settings as unknown as HealthCriteriaSettings).check;
	return before.name === input.settings.check.name &&
		before.version === input.settings.check.version
		? (previous.checkDescription as unknown as HealthCheck)
		: null;
}

/**
 * Why `input` cannot be saved against `description`, or null. The check must
 * be in the list when it is first chosen, when the integration or the check
 * changes, or when settings start again after being inactive. Other edits are
 * judged against the copy of the check's entry stored with the settings, so
 * they meet the same checks even if the check has since left the list.
 */
function settingsRefusal(
	input: SaveCriteriaInput,
	description: HealthCheck
): InvalidSettings | null {
	const issues = checkListIssues(input.settings, description).map((issue) => ({
		...issue,
		path: ["settings", ...issue.path],
	}));
	const fieldErrors = issuesToFieldErrors(issues);
	const [field, message] = Object.entries(fieldErrors)[0] ?? ["", ""];
	return issues.length > 0
		? { message: `${field}: ${message}`, fieldErrors }
		: null;
}

/** Whether the save names a revision other than the stored one (null when nothing is stored). */
function isStaleSave(
	input: SaveCriteriaInput,
	previous: { revision: number } | null
): boolean {
	return (
		input.expected_revision !== undefined &&
		input.expected_revision !== (previous?.revision ?? null)
	);
}

/** Whether the save changes which check, or whose pipeline, the settings name. */
function checkChanges(
	input: SaveCriteriaInput,
	previous: PluginHealthCriteria | null
): boolean {
	return (
		previous !== null &&
		(previous.checkName !== input.settings.check.name ||
			previous.integrationId !== input.integration_id)
	);
}

/**
 * The 400 for a node option the save cannot use: `add_evidence_node` needs a
 * save that moves settings to accepted from not accepted, and
 * `update_evidence_node_text` needs accepted settings whose check changes.
 */
function nodeOptionRefusal(
	input: SaveCriteriaInput,
	previous: PluginHealthCriteria | null
): { invalid: InvalidSettings } | null {
	if (
		input.add_evidence_node &&
		!(input.accept && previous?.state !== "ACCEPTED")
	) {
		return invalid(
			"add_evidence_node",
			"can only be used when accepting settings that are not yet accepted"
		);
	}
	if (
		input.update_evidence_node_text &&
		!(previous?.state === "ACCEPTED" && checkChanges(input, previous))
	) {
		return invalid(
			"update_evidence_node_text",
			"can only be used when the check of accepted settings changes"
		);
	}
	return null;
}

type NodeStep =
	| { kind: "none" }
	| { kind: "invalid"; invalid: InvalidSettings }
	| { kind: "refused"; error: string }
	| { kind: "done"; change?: ElementEvent; nodeId?: string };

/**
 * Adds the evidence node for settings being accepted, or reuses the claim's
 * live one. A pointer to a node that is not live is replaced by the new node.
 * Runs under the claim lock; the existing node's row is locked next and read
 * again before it is trusted.
 */
async function addNodeOnAccept(
	tx: HealthTransaction,
	claimId: string,
	context: SaveContext,
	previous: PluginHealthCriteria | null,
	check: HealthCheck
): Promise<NodeStep> {
	if (previous?.evidenceElementId) {
		await lockEvidenceNode(tx, previous.evidenceElementId);
		const current = await readClaimEvidenceNode(claimId, tx);
		if (current?.node.state === "live") {
			return { kind: "done" };
		}
	}
	const created = await createElementWithin(tx, context.userId, {
		caseId: context.caseId,
		elementType: "EVIDENCE",
		parentId: claimId,
		description: evidenceNodeText(check, context.pipeline),
	});
	if ("error" in created) {
		return { kind: "refused", error: created.error };
	}
	return {
		kind: "done",
		nodeId: created.data.id,
		change: {
			kind: "created",
			element: created.data,
			elementId: created.data.id,
			elementName: created.data.name,
		},
	};
}

/** Rewrites the live node's description to name the new check. Refused (400) when the node is not live. */
async function rewriteNodeText(
	tx: HealthTransaction,
	claimId: string,
	context: SaveContext,
	previous: PluginHealthCriteria | null,
	check: HealthCheck
): Promise<NodeStep> {
	const notLive = invalid(
		"update_evidence_node_text",
		"needs a live evidence node under this claim"
	);
	if (!previous?.evidenceElementId) {
		return { kind: "invalid", invalid: notLive.invalid };
	}
	await lockEvidenceNode(tx, previous.evidenceElementId);
	const current = await readClaimEvidenceNode(claimId, tx);
	if (!current?.live) {
		return { kind: "invalid", invalid: notLive.invalid };
	}
	const updated = await updateElementWithin(
		tx,
		previous.evidenceElementId,
		context.caseId,
		{ description: evidenceNodeText(check, context.pipeline) }
	);
	return {
		kind: "done",
		change: {
			kind: "updated",
			element: updated,
			elementId: updated.id,
			elementName: updated.name,
		},
	};
}

/** Does what the save asked for with the claim's evidence node, if anything. */
function evidenceNodeStep(
	tx: HealthTransaction,
	claimId: string,
	context: SaveContext,
	previous: PluginHealthCriteria | null,
	check: HealthCheck
): Promise<NodeStep> {
	if (context.input.add_evidence_node) {
		return addNodeOnAccept(tx, claimId, context, previous, check);
	}
	if (context.input.update_evidence_node_text) {
		return rewriteNodeText(tx, claimId, context, previous, check);
	}
	return Promise.resolve({ kind: "none" });
}

/** The refusals that come before the check list is consulted; null when the save may go on. */
async function refuseBeforeList(
	tx: HealthTransaction,
	context: SaveBase,
	previous: PluginHealthCriteria | null
): Promise<SaveOutcome | null> {
	const { input } = context;
	if (isStaleSave(input, previous)) {
		return { kind: "refused", error: CHANGED_BY_SOMEONE_ELSE };
	}
	if (!(await integrationIsActive(tx, input.integration_id))) {
		return {
			kind: "invalid",
			invalid: invalid("settings.check.name", CHECK_NOT_OFFERED).invalid,
		};
	}
	if (previous?.state === "ACCEPTED" && !input.accept) {
		return { kind: "refused", error: ACCEPTED_CANNOT_SUGGEST };
	}
	const optionRefusal = nodeOptionRefusal(input, previous);
	return optionRefusal
		? { kind: "invalid", invalid: optionRefusal.invalid }
		: null;
}

/**
 * Finds the check's entry the save is judged against (the listed one, or the
 * stored copy) and refuses a save the check list does not allow.
 */
function judgeAgainstList(
	input: SaveCriteriaInput,
	previous: PluginHealthCriteria | null,
	offered: HealthCheck[]
):
	| { check: HealthCheck | null; description: HealthCheck }
	| { refusal: SaveOutcome } {
	const check = findOffered(offered, input.settings);
	const description = check ?? storedCheckCopy(input, previous);
	const notOffered = {
		refusal: {
			kind: "invalid",
			invalid: invalid("settings.check.name", CHECK_NOT_OFFERED).invalid,
		},
	} as const;
	// Starting to accept settings needs the check in the live list; the stored
	// copy only stands in for later edits of settings that are already accepted.
	if (
		!description ||
		(!check && input.accept && previous?.state !== "ACCEPTED")
	) {
		return notOffered;
	}
	const refusal = settingsRefusal(input, description);
	if (refusal) {
		return { refusal: { kind: "invalid", invalid: refusal } };
	}
	// Without the list, the check's own settings must be exactly the saved ones.
	if (
		!check &&
		previous &&
		!sameCheck(
			previous.settings as unknown as HealthCriteriaSettings,
			input.settings
		)
	) {
		return notOffered;
	}
	return { check, description };
}

/** Validates and stores one save under the claim lock; see `saveCriteria`. */
async function saveUnderLock(
	tx: HealthTransaction,
	claimId: string,
	context: SaveBase,
	offered: HealthCheck[]
): Promise<SaveOutcome> {
	const [claimRow] = await lockClaim(tx, claimId);
	if (!claimRow || claimRow.deleted_at) {
		return { kind: "refused", error: CLAIM_NOT_FOUND };
	}
	const { input } = context;
	const previous = await tx.pluginHealthCriteria.findUnique({
		where: { claimId },
	});
	const early = await refuseBeforeList(tx, context, previous);
	if (early) {
		return early;
	}
	const judged = judgeAgainstList(input, previous, offered);
	if ("refusal" in judged) {
		return judged.refusal;
	}
	const { check, description } = judged;
	const settings = withScope(input.settings, description.scope);
	const saveContext = { ...context, check, description };
	const step = await evidenceNodeStep(
		tx,
		claimId,
		saveContext,
		previous,
		description
	);
	if (step.kind === "invalid" || step.kind === "refused") {
		return step;
	}
	await writeSave(
		tx,
		claimId,
		saveContext,
		previous,
		settings,
		step.kind === "done" ? step.nodeId : undefined
	);
	return {
		kind: "saved",
		change: step.kind === "done" ? step.change : undefined,
	};
}

/**
 * Creates or changes a claim's evidence settings. With `accept` false they
 * are stored as a suggestion; with `accept` true they are accepted, recording
 * who and when. A later save on accepted settings keeps them accepted, and a
 * save as a suggestion over accepted settings is refused. Saving over
 * inactive settings starts again, with revision numbers and version counters
 * continuing. The integration must be active, hold EDIT on the case and have
 * published a check list; the checks run only after the access check, so a
 * person without access learns nothing about what an integration offers.
 * Accepted settings bind the claim to their check. Requires EDIT.
 */
export async function saveCriteria(
	actingUserId: string,
	claimId: string,
	input: SaveCriteriaInput
): CriteriaResult<CriteriaChange> {
	const guard = await guardClaimAccess(actingUserId, claimId, "EDIT");
	if ("error" in guard) {
		return { error: guard.error };
	}
	const { caseId } = guard;

	try {
		const offered = await loadOfferedChecks(input.integration_id, caseId);
		if (!offered) {
			return invalid("settings.check.name", CHECK_NOT_OFFERED);
		}
		const context: SaveBase = {
			caseId,
			input,
			integrationName: offered.integration.name,
			ownerId: offered.integration.ownerId,
			pipeline: offered.pipeline,
			userId: actingUserId,
		};
		const outcome = await prisma.$transaction((tx) =>
			saveUnderLock(tx, claimId, context, offered.checks)
		);
		if (outcome.kind === "refused") {
			return { error: outcome.error };
		}
		if (outcome.kind === "invalid") {
			return { invalid: outcome.invalid };
		}
		return await changed(claimId, caseId, outcome.change);
	} catch (error) {
		return failedWith(
			error,
			"Failed to save health criteria",
			"Failed to save evidence settings"
		);
	}
}

// ---------------------------------------------------------------------------
// Retiring
// ---------------------------------------------------------------------------

type RetireOutcome =
	| { error: string }
	| { invalid: InvalidSettings }
	| { change?: ElementEvent; ok: true };

/**
 * Takes a live node off the claim being retired: trashes it, or only removes
 * this claim's evidence link when the node supports another claim too.
 * Returns what happened, or null when the node is not live for the claim, in
 * which case nothing is touched. Runs under the claim lock; the node's row is
 * locked next and read again before it is acted on.
 */
async function removeLiveNode(
	tx: HealthTransaction,
	claimId: string,
	caseId: string,
	nodeId: string,
	actingUserId: string
): Promise<ElementEvent | null> {
	await lockEvidenceNode(tx, nodeId);
	const current = await readClaimEvidenceNode(claimId, tx);
	if (!current?.live) {
		return null;
	}
	const sharedWith = await tx.evidenceLink.count({
		where: { evidenceId: nodeId, claimId: { not: claimId } },
	});
	if (sharedWith > 0) {
		await unlinkEvidenceWithin(tx, nodeId, claimId, caseId);
		return {
			kind: "updated",
			elementId: nodeId,
			elementName: current.node.name,
		};
	}
	await deleteElementWithin(tx, actingUserId, nodeId, caseId);
	return { kind: "deleted", elementId: nodeId, elementName: current.node.name };
}

/**
 * Stops the use of a claim's settings: accepted settings are retired (a reason
 * is required) and a suggestion is discarded (a reason is optional). Both set
 * the state to inactive and add a history row. `evidence_node` says what
 * happens to the claim's live evidence node: `keep` (the default) leaves it as
 * ordinary evidence, `remove` trashes it and forgets it, or only removes this
 * claim's link to it when it supports another claim too. The choice does
 * nothing when the claim has no live node. Requires EDIT.
 */
export async function retireCriteria(
	actingUserId: string,
	claimId: string,
	input: { evidence_node?: "keep" | "remove"; reason?: string }
): CriteriaResult<CriteriaChange> {
	const guard = await guardClaimAccess(actingUserId, claimId, "EDIT");
	if ("error" in guard) {
		return { error: guard.error };
	}
	const { caseId } = guard;

	try {
		const outcome = await prisma.$transaction(
			async (tx): Promise<RetireOutcome> => {
				await lockClaim(tx, claimId);
				const row = await tx.pluginHealthCriteria.findUnique({
					where: { claimId },
				});
				if (!row) {
					return { error: SETTINGS_NOT_FOUND };
				}
				if (row.state === "INACTIVE") {
					return { error: ALREADY_INACTIVE };
				}
				if (row.state === "ACCEPTED" && !input.reason) {
					return invalid(
						"reason",
						"is required to stop using accepted settings"
					);
				}
				const removed =
					input.evidence_node === "remove" &&
					row.state === "ACCEPTED" &&
					row.evidenceElementId
						? await removeLiveNode(
								tx,
								claimId,
								caseId,
								row.evidenceElementId,
								actingUserId
							)
						: null;
				const integration = row.integrationId
					? await tx.integration.findUnique({
							where: { id: row.integrationId },
							select: {
								name: true,
								pluginHealthCheckCatalogue: { select: { pipeline: true } },
							},
						})
					: null;
				const revision = row.revision + 1;
				await tx.pluginHealthCriteria.update({
					where: { claimId },
					data: {
						state: "INACTIVE",
						revision,
						updatedById: actingUserId,
						updatedAt: new Date(),
						...(removed ? { evidenceElementId: null } : {}),
					},
				});
				await tx.pluginHealthCriteriaRevision.create({
					data: {
						claimId,
						revision,
						action: row.state === "ACCEPTED" ? "RETIRED" : "DISCARDED",
						declaration: servedFromStored(
							row
						) as unknown as Prisma.InputJsonObject,
						reason: input.reason,
						integrationName: integration?.name,
						pipelineName: integration?.pluginHealthCheckCatalogue?.pipeline,
						actorId: actingUserId,
					},
				});
				return { ok: true, change: removed ?? undefined };
			}
		);
		if ("error" in outcome) {
			return { error: outcome.error };
		}
		if ("invalid" in outcome) {
			return { invalid: outcome.invalid };
		}
		return await changed(claimId, caseId, outcome.change);
	} catch (error) {
		return failedWith(
			error,
			"Failed to retire health criteria",
			"Failed to stop using the evidence settings"
		);
	}
}

// ---------------------------------------------------------------------------
// Adding the evidence node afterwards
// ---------------------------------------------------------------------------

/** The pipeline's display name for the node's text: the check list's own, or the one recorded when the settings were last saved. */
async function pipelineNameOf(
	tx: HealthTransaction,
	row: PluginHealthCriteria
): Promise<string> {
	const catalogue = row.integrationId
		? await tx.pluginHealthCheckCatalogue.findUnique({
				where: { integrationId: row.integrationId },
				select: { pipeline: true },
			})
		: null;
	if (catalogue) {
		return catalogue.pipeline;
	}
	const recorded = await tx.pluginHealthCriteriaRevision.findFirst({
		where: { claimId: row.claimId, pipelineName: { not: null } },
		orderBy: { revision: "desc" },
		select: { pipelineName: true },
	});
	return recorded?.pipelineName ?? "its pipeline";
}

/**
 * Adds the evidence node for a claim whose settings were accepted without
 * one: refused (409) when the settings are not accepted or the claim already
 * has a live node. A pointer to a node that is not live is replaced. The
 * settings and their history are not changed. Requires EDIT.
 */
export async function addEvidenceNode(
	actingUserId: string,
	claimId: string
): CriteriaResult<CriteriaChange> {
	const guard = await guardClaimAccess(actingUserId, claimId, "EDIT");
	if ("error" in guard) {
		return { error: guard.error };
	}
	const { caseId } = guard;

	try {
		const outcome = await prisma.$transaction(
			async (tx): Promise<{ error: string } | { change: ElementEvent }> => {
				const [claimRow] = await lockClaim(tx, claimId);
				if (!claimRow || claimRow.deleted_at) {
					return { error: CLAIM_NOT_FOUND };
				}
				const row = await tx.pluginHealthCriteria.findUnique({
					where: { claimId },
				});
				if (!row || row.state !== "ACCEPTED") {
					return { error: SETTINGS_NOT_ACCEPTED };
				}
				if (row.evidenceElementId) {
					await lockEvidenceNode(tx, row.evidenceElementId);
					const current = await readClaimEvidenceNode(claimId, tx);
					if (current?.live) {
						return { error: LIVE_NODE_EXISTS };
					}
				}
				const check = row.checkDescription as unknown as HealthCheck;
				const created = await createElementWithin(tx, actingUserId, {
					caseId,
					elementType: "EVIDENCE",
					parentId: claimId,
					description: evidenceNodeText(check, await pipelineNameOf(tx, row)),
				});
				if ("error" in created) {
					return { error: created.error };
				}
				await tx.pluginHealthCriteria.update({
					where: { claimId },
					data: { evidenceElementId: created.data.id },
				});
				return {
					change: {
						kind: "created",
						element: created.data,
						elementId: created.data.id,
						elementName: created.data.name,
					},
				};
			}
		);
		if ("error" in outcome) {
			return { error: outcome.error };
		}
		return await changed(claimId, caseId, outcome.change);
	} catch (error) {
		return failedWith(
			error,
			"Failed to add the evidence node",
			"Failed to add the evidence node"
		);
	}
}

// ---------------------------------------------------------------------------
// Read-back for the pipeline
// ---------------------------------------------------------------------------

export type MachineCriteria = ServedSettings & {
	accepted_at: string | null;
	claim_ref: string;
	revision: number;
	source: SettingsSource;
	state: "accepted";
	updated_at: string;
};

interface ReadRow {
	accepted_at: Date | null;
	aggregation_version: number;
	claim_id: string;
	reduction_version: number;
	revision: number;
	rule_version: number;
	settings: unknown;
	source: unknown;
	updated_at: Date;
}

function toMachineCriteria(row: ReadRow): MachineCriteria {
	const stored = {
		settings: row.settings,
		ruleVersion: row.rule_version,
		reductionVersion: row.reduction_version,
		aggregationVersion: row.aggregation_version,
		revision: row.revision,
		state: "ACCEPTED" as const,
	};
	return {
		claim_ref: row.claim_id,
		state: "accepted",
		revision: row.revision,
		...servedFromStored(stored),
		source: row.source as SettingsSource,
		accepted_at: row.accepted_at?.toISOString() ?? null,
		updated_at: row.updated_at.toISOString(),
	};
}

/**
 * Records the read and returns the rows it touched in one statement, so the
 * revision recorded is the revision served. Only accepted settings whose
 * check came from `integrationId`'s list, on claims that are not deleted.
 * `updated_at` is untouched: a read is not an edit.
 */
async function recordReads(
	integrationId: string,
	scope: { caseId: string } | { claimId: string }
): Promise<MachineCriteria[]> {
	const now = new Date();
	const where =
		"caseId" in scope
			? Prisma.sql`e.case_id = ${scope.caseId}`
			: Prisma.sql`e.id = ${scope.claimId}`;
	const rows = await prisma.$queryRaw<ReadRow[]>`
		UPDATE plugin_health_criteria c
		SET last_read_at = ${now}, last_read_revision = c.revision
		FROM assurance_elements e
		WHERE e.id = c.claim_id
			AND e.deleted_at IS NULL
			AND c.state = 'ACCEPTED'
			AND c.integration_id = ${integrationId}
			AND ${where}
		RETURNING c.claim_id, c.revision, c.settings, c.rule_version,
			c.reduction_version, c.aggregation_version, c.source,
			c.accepted_at, c.updated_at
	`;
	return rows
		.map(toMachineCriteria)
		.sort((a, b) => a.claim_ref.localeCompare(b.claim_ref));
}

/**
 * The accepted settings in `caseId` whose check came from the calling
 * integration's list, recording the read. A second pipeline on the same case
 * gets only its own. Requires VIEW for the integration's system user.
 */
export async function readCaseCriteriaForPipeline(
	principal: { integrationId: string; systemUserId: string },
	caseId: string
): ServiceResult<MachineCriteria[]> {
	const guard = await guardCaseAccess(principal.systemUserId, caseId, "VIEW");
	if ("error" in guard) {
		return { error: guard.error };
	}
	try {
		return { data: await recordReads(principal.integrationId, { caseId }) };
	} catch (error) {
		log.error("Failed to read criteria for the pipeline", { error });
		return { error: "Failed to read evidence settings" };
	}
}

/** One claim's accepted settings for the calling integration, recording the read; "Settings not found" when there are none to serve. */
export async function readClaimCriteriaForPipeline(
	principal: { integrationId: string; systemUserId: string },
	claimId: string
): ServiceResult<MachineCriteria> {
	const guard = await guardClaimAccess(principal.systemUserId, claimId, "VIEW");
	if ("error" in guard) {
		return { error: guard.error };
	}
	try {
		const [item] = await recordReads(principal.integrationId, { claimId });
		return item ? { data: item } : { error: SETTINGS_NOT_FOUND };
	} catch (error) {
		log.error("Failed to read criteria for the pipeline", { error });
		return { error: "Failed to read evidence settings" };
	}
}

// ---------------------------------------------------------------------------
// Case hygiene
// ---------------------------------------------------------------------------

export interface HygieneFigure {
	count: number;
	of: number;
}

export interface HealthHygiene {
	/** Checks with at least one such claim, out of checks in use. */
	checks_without_time_limit: HygieneFigure;
	/** Claims whose current result has no time limit, out of claims with a current result. */
	claims_without_time_limit: HygieneFigure;
	/** Settings accepted exactly as the pipeline recommended, out of accepted settings. */
	settings_as_recommended: HygieneFigure;
}

/**
 * Three counts for one case, each "k of n". A claim's current result is the
 * one that colours its badge: the latest by timestamp that is not revoked.
 * Requires VIEW.
 */
export async function readHealthHygiene(
	actingUserId: string,
	caseId: string
): ServiceResult<HealthHygiene> {
	const guard = await guardCaseAccess(actingUserId, caseId, "VIEW");
	if ("error" in guard) {
		return { error: guard.error };
	}
	try {
		const [results, accepted] = await Promise.all([
			prisma.$queryRaw<Array<{ check_name: string; valid_for: string }>>`
				SELECT DISTINCT ON (e.claim_id) e.check_name, e.valid_for
				FROM plugin_health_evidence e
				JOIN assurance_elements ae ON ae.id = e.claim_id
				WHERE ae.case_id = ${caseId}
					AND ae.deleted_at IS NULL
					AND NOT EXISTS (
						SELECT 1 FROM plugin_health_revocations r
						WHERE r.evidence_id = e.id AND r.reinstated_at IS NULL
					)
				ORDER BY e.claim_id, e.record_timestamp DESC, e.chain_sequence DESC
			`,
			prisma.pluginHealthCriteria.findMany({
				where: { state: "ACCEPTED", claim: { caseId, deletedAt: null } },
				select: { source: true },
			}),
		]);
		const unlimited = results.filter((row) => row.valid_for === "indefinite");
		return {
			data: {
				claims_without_time_limit: {
					count: unlimited.length,
					of: results.length,
				},
				checks_without_time_limit: {
					count: new Set(unlimited.map((row) => row.check_name)).size,
					of: new Set(results.map((row) => row.check_name)).size,
				},
				settings_as_recommended: {
					count: accepted.filter(
						(row) => (row.source as { kind?: string }).kind === "recommended"
					).length,
					of: accepted.length,
				},
			},
		};
	} catch (error) {
		log.error("Failed to read health hygiene", { error });
		return { error: "Failed to read the case's evidence health" };
	}
}
