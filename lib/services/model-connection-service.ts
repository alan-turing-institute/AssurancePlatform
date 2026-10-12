import {
	decryptToken,
	encryptToken,
	TokenEncryptionUnavailableError,
} from "@/lib/auth/token-encryption";
import { logger } from "@/lib/logger";
import {
	CONNECTION_TYPES,
	connectionTypeCanDo,
	isModelConnectionType,
	MODEL_JOBS,
	type ModelConnectionType,
	type ModelJob,
} from "@/lib/models/connection-types";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

/**
 * A user's stored model connections, and which connection and model does each
 * of their three jobs (chat, ranking, search).
 *
 * Keys are encrypted with the OAuth-token envelope before they reach the
 * database. Only `getConnectionForUse` returns one, decrypted, for the server
 * to use on that user's behalf; no other function returns a key, and nothing
 * here logs a key or its ciphertext. A connection id belonging to another user
 * gets the same "not found" answer as one that does not exist.
 *
 * Writes that need a key throw `TokenEncryptionUnavailableError` when
 * `TOKEN_ENCRYPTION_KEY` is missing or malformed, before anything is stored;
 * the caller maps it to a 503 as the single-key route does.
 */

const log = logger.child({ component: "model-connection-service" });

type Result<T> = Awaited<ServiceResult<T>>;
type Checked<T> = { value: T } | { error: string };

export const MAX_CONNECTIONS_PER_USER = 10;
const LABEL_MAX_LENGTH = 60;
const BASE_URL_MAX_LENGTH = 500;
const API_KEY_MAX_LENGTH = 2048;
const MODEL_MAX_LENGTH = 200;
const TRAILING_SLASHES = /\/+$/;

const NOT_FOUND = "Model connection not found";

// ============================================
// Types
// ============================================

/** A connection as every read except `getConnectionForUse` returns it. */
export interface ConnectionSummary {
	/** The address in use: the type's fixed address, or the one the user entered. */
	baseUrl: string | null;
	hasKey: boolean;
	id: string;
	label: string;
	type: ModelConnectionType;
}

/** A connection as the server uses it: the only shape that carries a key. */
export interface ConnectionForUse {
	apiKey: string | null;
	baseUrl: string;
	id: string;
	label: string;
	type: ModelConnectionType;
}

export interface CreateConnectionInput {
	apiKey?: string | null;
	/** Ignored for types whose address is fixed. */
	baseUrl?: string | null;
	label: string;
	type: ModelConnectionType;
}

export interface UpdateConnectionInput {
	/** A new key replaces the old one; `null` removes it; omitted leaves it. */
	apiKey?: string | null;
	/** Ignored for types whose address is fixed. */
	baseUrl?: string;
	label?: string;
}

export interface JobAssignment {
	connectionId: string;
	model: string;
}

export interface ModelRoles {
	chat: JobAssignment | null;
	ranking: JobAssignment | null;
	search: JobAssignment | null;
	/** The result of the search check; null until one has passed for the current search job. */
	searchCheck: { verifiedAt: Date; verifiedFor: string } | null;
}

/** All three jobs; null switches a job off. */
export type ModelRolesInput = Pick<ModelRoles, "chat" | "ranking" | "search">;

// ============================================
// Helpers
// ============================================

const SUMMARY_SELECT = {
	id: true,
	label: true,
	type: true,
	baseUrl: true,
	apiKeyEncrypted: true,
} as const;

interface SummaryRow {
	apiKeyEncrypted: string | null;
	baseUrl: string | null;
	id: string;
	label: string;
	type: ModelConnectionType;
}

function effectiveBaseUrl(
	type: ModelConnectionType,
	stored: string | null
): string | null {
	return CONNECTION_TYPES[type].baseUrl ?? stored;
}

function toSummary(row: SummaryRow): ConnectionSummary {
	return {
		id: row.id,
		label: row.label,
		type: row.type,
		baseUrl: effectiveBaseUrl(row.type, row.baseUrl),
		hasKey: row.apiKeyEncrypted !== null,
	};
}

/**
 * Turns an unexpected failure into the service's generic error. A missing
 * encryption key is rethrown for the caller to map. Only the error's class and
 * code are logged: a Prisma error message can echo the arguments of the failed
 * call, which include the encrypted key.
 */
function failure(action: string, error: unknown): { error: string } {
	if (error instanceof TokenEncryptionUnavailableError) {
		throw error;
	}
	log.error(`Failed to ${action}`, {
		errorName: error instanceof Error ? error.name : "unknown",
		errorCode:
			error instanceof Prisma.PrismaClientKnownRequestError
				? error.code
				: undefined,
	});
	return { error: `Failed to ${action}` };
}

function isForeignKeyViolation(error: unknown): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2003"
	);
}

function parseUrl(value: string): URL | null {
	try {
		return new URL(value);
	} catch {
		return null;
	}
}

// ============================================
// Shape checks (a second line behind the route's schemas)
// ============================================

function checkLabel(raw: string): Checked<string> {
	const value = raw.trim();
	if (value.length === 0 || value.length > LABEL_MAX_LENGTH) {
		return { error: `Label must be 1 to ${LABEL_MAX_LENGTH} characters` };
	}
	return { value };
}

function checkBaseUrl(raw: string): Checked<string> {
	const value = raw.trim().replace(TRAILING_SLASHES, "");
	if (value.length === 0 || value.length > BASE_URL_MAX_LENGTH) {
		return {
			error: `Base URL must be 1 to ${BASE_URL_MAX_LENGTH} characters`,
		};
	}
	const parsed = parseUrl(value);
	if (
		!parsed ||
		(parsed.protocol !== "http:" && parsed.protocol !== "https:")
	) {
		return { error: "Base URL must be a valid http or https address" };
	}
	if (parsed.username || parsed.password) {
		return { error: "Base URL must not contain a user name or password" };
	}
	return { value };
}

function checkApiKey(raw: string): Checked<string> {
	const value = raw.trim();
	if (value.length === 0) {
		return { error: "API key must not be empty" };
	}
	if (value.length > API_KEY_MAX_LENGTH) {
		return {
			error: `API key must be at most ${API_KEY_MAX_LENGTH} characters`,
		};
	}
	return { value };
}

function checkModel(raw: string): Checked<string> {
	const value = raw.trim();
	if (value.length === 0 || value.length > MODEL_MAX_LENGTH) {
		return { error: `Model name must be 1 to ${MODEL_MAX_LENGTH} characters` };
	}
	return { value };
}

interface NewConnectionFields {
	apiKeyEncrypted: string | null;
	baseUrl: string | null;
	label: string;
	type: ModelConnectionType;
}

/** Validates a new connection and encrypts its key; throws if encryption is unavailable. */
function prepareNewConnection(
	input: CreateConnectionInput
): Checked<NewConnectionFields> {
	if (!isModelConnectionType(input.type)) {
		return { error: "Unknown connection type" };
	}
	const spec = CONNECTION_TYPES[input.type];

	const label = checkLabel(input.label);
	if ("error" in label) {
		return label;
	}

	let baseUrl: string | null = null;
	if (spec.baseUrl === null) {
		if (!input.baseUrl) {
			return { error: "A base URL is required for this connection type" };
		}
		const checked = checkBaseUrl(input.baseUrl);
		if ("error" in checked) {
			return checked;
		}
		baseUrl = checked.value;
	}

	let apiKeyEncrypted: string | null = null;
	if (input.apiKey?.trim()) {
		const checked = checkApiKey(input.apiKey);
		if ("error" in checked) {
			return checked;
		}
		apiKeyEncrypted = encryptToken(checked.value);
	} else if (spec.keyRequired) {
		return { error: "An API key is required for this connection type" };
	}

	return {
		value: {
			label: label.value,
			type: input.type,
			baseUrl,
			apiKeyEncrypted,
		},
	};
}

interface PlannedUpdate {
	data: Prisma.UserModelConnectionUpdateInput;
	/** Whether the change moves the connection's address or key. */
	invalidatesCheck: boolean;
}

/** Validates an update against the stored connection and encrypts a new key. */
function planUpdate(
	existing: { baseUrl: string | null; type: ModelConnectionType },
	input: UpdateConnectionInput
): Checked<PlannedUpdate> {
	const spec = CONNECTION_TYPES[existing.type];
	const data: Prisma.UserModelConnectionUpdateInput = {};
	let invalidatesCheck = false;

	if (input.label !== undefined) {
		const label = checkLabel(input.label);
		if ("error" in label) {
			return label;
		}
		data.label = label.value;
	}

	if (input.baseUrl !== undefined && spec.baseUrl === null) {
		const baseUrl = checkBaseUrl(input.baseUrl);
		if ("error" in baseUrl) {
			return baseUrl;
		}
		data.baseUrl = baseUrl.value;
		invalidatesCheck = baseUrl.value !== existing.baseUrl;
	}

	if (input.apiKey === null) {
		if (spec.keyRequired) {
			return { error: "A key is required for this connection type" };
		}
		data.apiKeyEncrypted = null;
		invalidatesCheck = true;
	} else if (input.apiKey !== undefined) {
		const apiKey = checkApiKey(input.apiKey);
		if ("error" in apiKey) {
			return apiKey;
		}
		data.apiKeyEncrypted = encryptToken(apiKey.value);
		invalidatesCheck = true;
	}

	return { value: { data, invalidatesCheck } };
}

// ============================================
// Connections
// ============================================

/** The user's connections, oldest first. No key is returned, only whether one is set. */
export async function listConnections(
	userId: string
): ServiceResult<ConnectionSummary[]> {
	try {
		const rows = await prisma.userModelConnection.findMany({
			where: { userId },
			orderBy: [{ createdAt: "asc" }, { id: "asc" }],
			select: SUMMARY_SELECT,
		});
		return { data: rows.map(toSummary) };
	} catch (error) {
		return failure("list model connections", error);
	}
}

/**
 * One of the user's connections with its key decrypted. For server-side use
 * on the user's behalf only; never pass the result to a response or a log.
 */
export async function getConnectionForUse(
	userId: string,
	connectionId: string
): ServiceResult<ConnectionForUse> {
	try {
		const row = await prisma.userModelConnection.findFirst({
			where: { id: connectionId, userId },
			select: SUMMARY_SELECT,
		});
		if (!row) {
			return { error: NOT_FOUND };
		}
		const baseUrl = effectiveBaseUrl(row.type, row.baseUrl);
		if (!baseUrl) {
			return { error: "Model connection has no address" };
		}
		return {
			data: {
				id: row.id,
				label: row.label,
				type: row.type,
				baseUrl,
				apiKey:
					row.apiKeyEncrypted === null
						? null
						: decryptToken(row.apiKeyEncrypted),
			},
		};
	} catch (error) {
		return failure("read the model connection", error);
	}
}

/**
 * Adds a connection. At most `MAX_CONNECTIONS_PER_USER` per user; the count
 * and the insert run under a lock on the user's row so concurrent requests
 * cannot pass the limit together.
 */
export async function createConnection(
	userId: string,
	input: CreateConnectionInput
): ServiceResult<ConnectionSummary> {
	try {
		const prepared = prepareNewConnection(input);
		if ("error" in prepared) {
			return prepared;
		}
		const { value } = prepared;

		return await prisma.$transaction(
			async (tx): Promise<Result<ConnectionSummary>> => {
				await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
				const count = await tx.userModelConnection.count({ where: { userId } });
				if (count >= MAX_CONNECTIONS_PER_USER) {
					return {
						error: `You can have at most ${MAX_CONNECTIONS_PER_USER} model connections`,
					};
				}
				const row = await tx.userModelConnection.create({
					data: { ...value, userId },
					select: SUMMARY_SELECT,
				});
				return { data: toSummary(row) };
			}
		);
	} catch (error) {
		return failure("create the model connection", error);
	}
}

/**
 * Changes a connection's label, address or key. Moving the address or the key
 * clears the search check on every job that uses the connection for search,
 * in the same transaction.
 */
export async function updateConnection(
	userId: string,
	connectionId: string,
	input: UpdateConnectionInput
): ServiceResult<ConnectionSummary> {
	try {
		const existing = await prisma.userModelConnection.findFirst({
			where: { id: connectionId, userId },
			select: { baseUrl: true, type: true },
		});
		if (!existing) {
			return { error: NOT_FOUND };
		}
		const planned = planUpdate(existing, input);
		if ("error" in planned) {
			return planned;
		}
		const { data, invalidatesCheck } = planned.value;

		return await prisma.$transaction(
			async (tx): Promise<Result<ConnectionSummary>> => {
				const updated = await tx.userModelConnection.updateMany({
					where: { id: connectionId, userId },
					data,
				});
				if (updated.count === 0) {
					return { error: NOT_FOUND };
				}
				if (invalidatesCheck) {
					await tx.userModelRoles.updateMany({
						where: { embeddingConnectionId: connectionId },
						data: { embeddingVerifiedFor: null, embeddingVerifiedAt: null },
					});
				}
				const row = await tx.userModelConnection.findFirstOrThrow({
					where: { id: connectionId, userId },
					select: SUMMARY_SELECT,
				});
				return { data: toSummary(row) };
			}
		);
	} catch (error) {
		return failure("update the model connection", error);
	}
}

/**
 * Removes a connection. Every job that used it is emptied: the foreign key
 * clears its connection, and the model name and search check go with it.
 */
export async function deleteConnection(
	userId: string,
	connectionId: string
): ServiceResult<true> {
	try {
		return await prisma.$transaction(async (tx): Promise<Result<true>> => {
			const owned = await tx.userModelConnection.findFirst({
				where: { id: connectionId, userId },
				select: { id: true },
			});
			if (!owned) {
				return { error: NOT_FOUND };
			}
			await tx.userModelRoles.updateMany({
				where: { chatConnectionId: connectionId },
				data: { chatModel: null },
			});
			await tx.userModelRoles.updateMany({
				where: { decisionConnectionId: connectionId },
				data: { decisionModel: null },
			});
			await tx.userModelRoles.updateMany({
				where: { embeddingConnectionId: connectionId },
				data: {
					embeddingModel: null,
					embeddingVerifiedFor: null,
					embeddingVerifiedAt: null,
				},
			});
			await tx.userModelConnection.delete({ where: { id: connectionId } });
			return { data: true };
		});
	} catch (error) {
		return failure("delete the model connection", error);
	}
}

// ============================================
// Jobs
// ============================================

interface RolesRow {
	chatConnection: { userId: string } | null;
	chatConnectionId: string | null;
	chatModel: string | null;
	decisionConnection: { userId: string } | null;
	decisionConnectionId: string | null;
	decisionModel: string | null;
	embeddingConnection: { userId: string } | null;
	embeddingConnectionId: string | null;
	embeddingModel: string | null;
	embeddingVerifiedAt: Date | null;
	embeddingVerifiedFor: string | null;
}

/** A job counts as set only with a connection of the user's own and a model name. */
function readJob(
	userId: string,
	connectionId: string | null,
	model: string | null,
	connection: { userId: string } | null
): JobAssignment | null {
	if (!(connectionId && model && connection) || connection.userId !== userId) {
		return null;
	}
	return { connectionId, model };
}

function toRoles(userId: string, row: RolesRow | null): ModelRoles {
	if (!row) {
		return { chat: null, ranking: null, search: null, searchCheck: null };
	}
	const search = readJob(
		userId,
		row.embeddingConnectionId,
		row.embeddingModel,
		row.embeddingConnection
	);
	const checked =
		search && row.embeddingVerifiedFor && row.embeddingVerifiedAt
			? {
					verifiedFor: row.embeddingVerifiedFor,
					verifiedAt: row.embeddingVerifiedAt,
				}
			: null;
	return {
		chat: readJob(
			userId,
			row.chatConnectionId,
			row.chatModel,
			row.chatConnection
		),
		ranking: readJob(
			userId,
			row.decisionConnectionId,
			row.decisionModel,
			row.decisionConnection
		),
		search,
		searchCheck: checked,
	};
}

async function readRoles(userId: string): Promise<ModelRoles> {
	const row = await prisma.userModelRoles.findUnique({
		where: { userId },
		include: {
			chatConnection: { select: { userId: true } },
			decisionConnection: { select: { userId: true } },
			embeddingConnection: { select: { userId: true } },
		},
	});
	return toRoles(userId, row);
}

/**
 * The user's three jobs. A job whose connection belongs to someone else, or
 * that lacks a connection or model, reads as unset.
 */
export async function getRoles(userId: string): ServiceResult<ModelRoles> {
	try {
		return { data: await readRoles(userId) };
	} catch (error) {
		return failure("read the model jobs", error);
	}
}

/** Checks each assigned model name and returns the assignments with names trimmed. */
function checkAssignments(
	roles: ModelRolesInput
): Checked<Record<ModelJob, JobAssignment | null>> {
	const checked: Record<ModelJob, JobAssignment | null> = {
		chat: null,
		ranking: null,
		search: null,
	};
	for (const job of MODEL_JOBS) {
		const assigned = roles[job];
		if (assigned) {
			const model = checkModel(assigned.model);
			if ("error" in model) {
				return model;
			}
			checked[job] = {
				connectionId: assigned.connectionId,
				model: model.value,
			};
		}
	}
	return { value: checked };
}

/**
 * Confirms every assigned connection is the user's own and that its type can
 * do the job it is assigned to. A connection that is someone else's is
 * reported exactly as one that does not exist.
 */
async function refuseUnusableConnections(
	userId: string,
	assignments: Record<ModelJob, JobAssignment | null>
): Promise<{ error: string } | null> {
	const wanted = MODEL_JOBS.flatMap((job) => {
		const assigned = assignments[job];
		return assigned ? [assigned.connectionId] : [];
	});
	const owned = await prisma.userModelConnection.findMany({
		where: { userId, id: { in: wanted } },
		select: { id: true, type: true },
	});
	const typeById = new Map(owned.map((c) => [c.id, c.type]));
	for (const job of MODEL_JOBS) {
		const assigned = assignments[job];
		if (!assigned) {
			continue;
		}
		const type = typeById.get(assigned.connectionId);
		if (!type) {
			return { error: NOT_FOUND };
		}
		if (!connectionTypeCanDo(type, job)) {
			return { error: `This connection type cannot be used for ${job}` };
		}
	}
	return null;
}

/** Writes the three jobs; a changed search job also clears the search check. */
async function saveRoles(
	userId: string,
	{ chat, ranking, search }: Record<ModelJob, JobAssignment | null>
): Promise<void> {
	const jobs = {
		chatConnectionId: chat?.connectionId ?? null,
		chatModel: chat?.model ?? null,
		decisionConnectionId: ranking?.connectionId ?? null,
		decisionModel: ranking?.model ?? null,
		embeddingConnectionId: search?.connectionId ?? null,
		embeddingModel: search?.model ?? null,
	};
	await prisma.$transaction(async (tx) => {
		const current = await tx.userModelRoles.findUnique({
			where: { userId },
			select: { embeddingConnectionId: true, embeddingModel: true },
		});
		const searchChanged =
			(current?.embeddingConnectionId ?? null) !== jobs.embeddingConnectionId ||
			(current?.embeddingModel ?? null) !== jobs.embeddingModel;
		const data = searchChanged
			? { ...jobs, embeddingVerifiedFor: null, embeddingVerifiedAt: null }
			: jobs;
		await tx.userModelRoles.upsert({
			where: { userId },
			create: { userId, ...data },
			update: data,
		});
	});
}

/**
 * Replaces the user's three jobs. Every assigned connection must be the
 * user's own and its type must be able to do the job. A change to the search
 * job clears the search check; the check is never set here.
 */
export async function setRoles(
	userId: string,
	roles: ModelRolesInput
): ServiceResult<ModelRoles> {
	try {
		const assignments = checkAssignments(roles);
		if ("error" in assignments) {
			return assignments;
		}
		const refused = await refuseUnusableConnections(userId, assignments.value);
		if (refused) {
			return refused;
		}
		await saveRoles(userId, assignments.value);
		return { data: await readRoles(userId) };
	} catch (error) {
		if (isForeignKeyViolation(error)) {
			return { error: NOT_FOUND };
		}
		return failure("save the model jobs", error);
	}
}

/**
 * Records that the search check passed for `verifiedFor` (the catalogue model
 * and test sentences it was run against). Written only by the server after it
 * has run the check; refused when no search job is set.
 */
export async function recordEmbeddingCheck(
	userId: string,
	verifiedFor: string
): ServiceResult<true> {
	if (verifiedFor.length === 0) {
		return { error: "verifiedFor must not be empty" };
	}
	try {
		const updated = await prisma.userModelRoles.updateMany({
			where: {
				userId,
				embeddingConnectionId: { not: null },
				embeddingModel: { not: null },
			},
			data: {
				embeddingVerifiedFor: verifiedFor,
				embeddingVerifiedAt: new Date(),
			},
		});
		if (updated.count === 0) {
			return { error: "No search model is set" };
		}
		return { data: true };
	} catch (error) {
		return failure("record the search check", error);
	}
}

/** Clears the search check; a no-op when none is recorded. */
export async function clearEmbeddingCheck(userId: string): ServiceResult<true> {
	try {
		await prisma.userModelRoles.updateMany({
			where: { userId },
			data: { embeddingVerifiedFor: null, embeddingVerifiedAt: null },
		});
		return { data: true };
	} catch (error) {
		return failure("clear the search check", error);
	}
}
