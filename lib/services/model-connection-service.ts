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
	MODEL_FIELD_LIMITS,
	MODEL_JOBS,
	type ModelConnectionType,
	type ModelJob,
} from "@/lib/models/connection-types";
import {
	hasControlCharacter,
	isPrintableAscii,
} from "@/lib/models/key-characters";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma";

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
 *
 * Every refusal carries a `code` beside its message, so a caller can choose a
 * response without reading the message. A failure the user did not cause (the
 * database, say) has a message and no code.
 */

const log = logger.child({ component: "model-connection-service" });

/** Why the service refused a request. */
export type ModelServiceErrorCode =
	| "VALIDATION"
	| "NOT_FOUND"
	| "LIMIT_REACHED"
	| "JOB_NOT_SUPPORTED";

interface Refusal {
	code: ModelServiceErrorCode;
	error: string;
}

/** A refusal (with its code) or an unexpected failure (without one). */
export interface ModelServiceError {
	code?: ModelServiceErrorCode;
	error: string;
}

/** The client a `prisma.$transaction` callback receives. */
type TransactionClient = Parameters<
	Parameters<typeof prisma.$transaction>[0]
>[0];

type ModelResult<T> = Promise<{ data: T } | ModelServiceError>;
type Result<T> = Awaited<ModelResult<T>>;
type Checked<T> = { value: T } | Refusal;

function invalid(error: string): Refusal {
	return { error, code: "VALIDATION" };
}

export const MAX_CONNECTIONS_PER_USER = 10;
const LABEL_MAX_LENGTH = MODEL_FIELD_LIMITS.label;
const BASE_URL_MAX_LENGTH = MODEL_FIELD_LIMITS.baseUrl;
const API_KEY_MAX_LENGTH = MODEL_FIELD_LIMITS.apiKey;
const MODEL_MAX_LENGTH = MODEL_FIELD_LIMITS.model;
const TRAILING_SLASHES = /\/+$/;

const NOT_FOUND = "Model connection not found";

function notFound(): Refusal {
	return { error: NOT_FOUND, code: "NOT_FOUND" };
}

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

/** The model to give each job a new connection is to do; a job left out is not touched. */
export type NewJobModels = Partial<Record<ModelJob, string>>;

/** The stored columns `createConnectionWithJobs` can write. */
interface NewJobColumns {
	chatConnectionId?: string;
	chatModel?: string;
	decisionConnectionId?: string;
	decisionModel?: string;
	embeddingConnectionId?: string;
	embeddingModel?: string;
	embeddingVerifiedAt?: null;
	embeddingVerifiedFor?: null;
}

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
function failure(action: string, error: unknown): ModelServiceError {
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
		return invalid(`Label must be 1 to ${LABEL_MAX_LENGTH} characters`);
	}
	if (hasControlCharacter(value)) {
		return invalid("Label must not contain control characters");
	}
	return { value };
}

function checkBaseUrl(raw: string): Checked<string> {
	const value = raw.trim().replace(TRAILING_SLASHES, "");
	if (value.length === 0 || value.length > BASE_URL_MAX_LENGTH) {
		return invalid(`Base URL must be 1 to ${BASE_URL_MAX_LENGTH} characters`);
	}
	const parsed = parseUrl(value);
	if (
		!parsed ||
		(parsed.protocol !== "http:" && parsed.protocol !== "https:")
	) {
		return invalid("Base URL must be a valid http or https address");
	}
	if (parsed.username || parsed.password) {
		return invalid("Base URL must not contain a user name or password");
	}
	// Checked on the text, not the parsed URL: a lone "?" or "#" parses to an
	// empty query or fragment, yet it still lets the path the SDK appends be
	// read as part of the query or fragment instead.
	if (value.includes("?") || value.includes("#")) {
		return invalid("Base URL must not contain a query string or fragment");
	}
	return { value };
}

function checkApiKey(raw: string): Checked<string> {
	const value = raw.trim();
	if (value.length === 0) {
		return invalid("API key must not be empty");
	}
	if (value.length > API_KEY_MAX_LENGTH) {
		return invalid(`API key must be at most ${API_KEY_MAX_LENGTH} characters`);
	}
	if (hasControlCharacter(value)) {
		return invalid("API key must not contain control characters");
	}
	if (!isPrintableAscii(value)) {
		return invalid("API key must contain only printable ASCII characters");
	}
	return { value };
}

function checkModel(raw: string): Checked<string> {
	const value = raw.trim();
	if (value.length === 0 || value.length > MODEL_MAX_LENGTH) {
		return invalid(`Model name must be 1 to ${MODEL_MAX_LENGTH} characters`);
	}
	if (hasControlCharacter(value)) {
		return invalid("Model name must not contain control characters");
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
		return invalid("Unknown connection type");
	}
	const spec = CONNECTION_TYPES[input.type];

	const label = checkLabel(input.label);
	if ("error" in label) {
		return label;
	}

	let baseUrl: string | null = null;
	if (spec.baseUrl === null) {
		if (!input.baseUrl) {
			return invalid("A base URL is required for this connection type");
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
		return invalid("An API key is required for this connection type");
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
			return invalid("A key is required for this connection type");
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
): ModelResult<ConnectionSummary[]> {
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

/** A stored row as the server uses it, with its key decrypted. */
function toConnectionForUse(row: SummaryRow): Result<ConnectionForUse> {
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
				row.apiKeyEncrypted === null ? null : decryptToken(row.apiKeyEncrypted),
		},
	};
}

/**
 * One of the user's connections with its key decrypted. For server-side use
 * on the user's behalf only; never pass the result to a response or a log.
 */
export async function getConnectionForUse(
	userId: string,
	connectionId: string
): ModelResult<ConnectionForUse> {
	try {
		const row = await prisma.userModelConnection.findFirst({
			where: { id: connectionId, userId },
			select: SUMMARY_SELECT,
		});
		return row ? toConnectionForUse(row) : notFound();
	} catch (error) {
		return failure("read the model connection", error);
	}
}

/**
 * A connection's address and key as stored. They change only when the user
 * edits the connection, so a copy taken before a long call tells afterwards
 * whether the call ran against what is stored now.
 */
export interface StoredConnectionState {
	apiKeyEncrypted: string | null;
	baseUrl: string | null;
}

/**
 * Like `getConnectionForUse`, and also the stored state the connection was
 * read in, from the same read. Pass the state to `recordEmbeddingCheck` so a
 * check that ran against an address or key since changed is not recorded. The
 * same rules apply: for server-side use only, and never logged.
 */
export async function getConnectionWithStoredState(
	userId: string,
	connectionId: string
): ModelResult<{
	connection: ConnectionForUse;
	stored: StoredConnectionState;
}> {
	try {
		const row = await prisma.userModelConnection.findFirst({
			where: { id: connectionId, userId },
			select: SUMMARY_SELECT,
		});
		if (!row) {
			return notFound();
		}
		const connection = toConnectionForUse(row);
		return "error" in connection
			? connection
			: {
					data: {
						connection: connection.data,
						stored: {
							baseUrl: row.baseUrl,
							apiKeyEncrypted: row.apiKeyEncrypted,
						},
					},
				};
	} catch (error) {
		return failure("read the model connection", error);
	}
}

/**
 * Inserts a connection, within a transaction, under a lock on the user's row
 * so concurrent requests cannot pass `MAX_CONNECTIONS_PER_USER` together.
 */
async function insertConnection(
	tx: TransactionClient,
	userId: string,
	value: NewConnectionFields
): Promise<{ data: SummaryRow } | Refusal> {
	await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
	const count = await tx.userModelConnection.count({ where: { userId } });
	if (count >= MAX_CONNECTIONS_PER_USER) {
		return {
			error: `You can have at most ${MAX_CONNECTIONS_PER_USER} model connections`,
			code: "LIMIT_REACHED",
		};
	}
	const row = await tx.userModelConnection.create({
		data: { ...value, userId },
		select: SUMMARY_SELECT,
	});
	return { data: row };
}

/** Adds a connection. At most `MAX_CONNECTIONS_PER_USER` per user. */
export async function createConnection(
	userId: string,
	input: CreateConnectionInput
): ModelResult<ConnectionSummary> {
	try {
		const prepared = prepareNewConnection(input);
		if ("error" in prepared) {
			return prepared;
		}
		const { value } = prepared;

		return await prisma.$transaction(
			async (tx): Promise<Result<ConnectionSummary>> => {
				const added = await insertConnection(tx, userId, value);
				return "error" in added ? added : { data: toSummary(added.data) };
			}
		);
	} catch (error) {
		return failure("create the model connection", error);
	}
}

/**
 * Checks the model names to assign alongside a new connection: each job named
 * must be one the connection's type can do.
 */
function checkNewJobs(
	type: ModelConnectionType,
	models: NewJobModels
): Checked<NewJobModels> {
	const checked: NewJobModels = {};
	for (const job of MODEL_JOBS) {
		const requested = models[job];
		if (requested === undefined) {
			continue;
		}
		const model = checkModel(requested);
		if ("error" in model) {
			return model;
		}
		if (!connectionTypeCanDo(type, job)) {
			return {
				error: `This connection type cannot be used for ${job}`,
				code: "JOB_NOT_SUPPORTED",
			};
		}
		checked[job] = model.value;
	}
	return { value: checked };
}

/** Points the named jobs at a new connection, within a transaction; other jobs are left as they are. */
async function assignNewJobs(
	tx: TransactionClient,
	userId: string,
	connectionId: string,
	models: NewJobModels
): Promise<void> {
	const data: NewJobColumns = {};
	if (models.chat) {
		data.chatConnectionId = connectionId;
		data.chatModel = models.chat;
	}
	if (models.ranking) {
		data.decisionConnectionId = connectionId;
		data.decisionModel = models.ranking;
	}
	if (models.search) {
		data.embeddingConnectionId = connectionId;
		data.embeddingModel = models.search;
		data.embeddingVerifiedFor = null;
		data.embeddingVerifiedAt = null;
	}
	if (Object.keys(data).length === 0) {
		return;
	}
	await tx.userModelRoles.upsert({
		where: { userId },
		create: { userId, ...data },
		update: data,
	});
}

/**
 * Adds a connection and points the named jobs at it, in one transaction: if
 * either step fails, neither is stored. A job that is not named keeps what it
 * had. Naming the search job clears any search check, because the job now
 * points at a new connection.
 */
export async function createConnectionWithJobs(
	userId: string,
	input: CreateConnectionInput,
	models: NewJobModels
): ModelResult<{ connection: ConnectionSummary; roles: ModelRoles }> {
	try {
		const prepared = prepareNewConnection(input);
		if ("error" in prepared) {
			return prepared;
		}
		const jobs = checkNewJobs(prepared.value.type, models);
		if ("error" in jobs) {
			return jobs;
		}

		const added = await prisma.$transaction(
			async (tx): Promise<Awaited<ReturnType<typeof insertConnection>>> => {
				const inserted = await insertConnection(tx, userId, prepared.value);
				if ("error" in inserted) {
					return inserted;
				}
				await assignNewJobs(tx, userId, inserted.data.id, jobs.value);
				return inserted;
			}
		);
		if ("error" in added) {
			return added;
		}
		return {
			data: {
				connection: toSummary(added.data),
				roles: await readRoles(userId),
			},
		};
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
): ModelResult<ConnectionSummary> {
	try {
		const existing = await prisma.userModelConnection.findFirst({
			where: { id: connectionId, userId },
			select: { baseUrl: true, type: true },
		});
		if (!existing) {
			return notFound();
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
					return notFound();
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
): ModelResult<true> {
	try {
		return await prisma.$transaction(async (tx): Promise<Result<true>> => {
			const owned = await tx.userModelConnection.findFirst({
				where: { id: connectionId, userId },
				select: { id: true },
			});
			if (!owned) {
				return notFound();
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
export async function getRoles(userId: string): ModelResult<ModelRoles> {
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
): Promise<Refusal | null> {
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
			return notFound();
		}
		if (!connectionTypeCanDo(type, job)) {
			return {
				error: `This connection type cannot be used for ${job}`,
				code: "JOB_NOT_SUPPORTED",
			};
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

/** The assignments with names trimmed, once every connection is the user's own and can do its job. */
async function usableAssignments(
	userId: string,
	roles: ModelRolesInput
): Promise<Checked<Record<ModelJob, JobAssignment | null>>> {
	const assignments = checkAssignments(roles);
	if ("error" in assignments) {
		return assignments;
	}
	return (
		(await refuseUnusableConnections(userId, assignments.value)) ?? assignments
	);
}

/**
 * Whether `roles` could be saved for the user, without saving anything: the
 * model names are acceptable, every connection is the user's own, and its type
 * can do the job. Refuses with the same errors `setRoles` would give.
 */
export async function checkRoles(
	userId: string,
	roles: ModelRolesInput
): ModelResult<true> {
	try {
		const usable = await usableAssignments(userId, roles);
		return "error" in usable ? usable : { data: true };
	} catch (error) {
		return failure("check the model jobs", error);
	}
}

/**
 * Replaces the user's three jobs. Every assigned connection must be the
 * user's own and its type must be able to do the job. A change to the search
 * job clears the search check; the check is never set here.
 */
export async function setRoles(
	userId: string,
	roles: ModelRolesInput
): ModelResult<ModelRoles> {
	try {
		const usable = await usableAssignments(userId, roles);
		if ("error" in usable) {
			return usable;
		}
		await saveRoles(userId, usable.value);
		return { data: await readRoles(userId) };
	} catch (error) {
		if (isForeignKeyViolation(error)) {
			return notFound();
		}
		return failure("save the model jobs", error);
	}
}

/**
 * Records that the search check passed for `verifiedFor` (the catalogue model
 * and test sentences it was run against). Written only by the server after it
 * has run the check, and only if the user's search job is still `expected`,
 * the connection and model the check ran against: the write is one conditional
 * update, so a search job changed since the check began is left unmarked.
 * When `stored` is given, the connection's address and key must also still be
 * what they were when the check began, so an edit made while the check ran
 * leaves it unmarked too. Returns whether the check was recorded.
 */
export async function recordEmbeddingCheck(
	userId: string,
	verifiedFor: string,
	expected: JobAssignment,
	stored?: StoredConnectionState
): ModelResult<boolean> {
	if (verifiedFor.length === 0) {
		return invalid("verifiedFor must not be empty");
	}
	try {
		const updated = await prisma.userModelRoles.updateMany({
			where: {
				userId,
				embeddingConnectionId: expected.connectionId,
				embeddingModel: expected.model,
				embeddingConnection: {
					userId,
					...(stored
						? {
								baseUrl: stored.baseUrl,
								apiKeyEncrypted: stored.apiKeyEncrypted,
							}
						: {}),
				},
			},
			data: {
				embeddingVerifiedFor: verifiedFor,
				embeddingVerifiedAt: new Date(),
			},
		});
		return { data: updated.count > 0 };
	} catch (error) {
		return failure("record the search check", error);
	}
}

/** Clears the search check; a no-op when none is recorded. */
export async function clearEmbeddingCheck(userId: string): ModelResult<true> {
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
