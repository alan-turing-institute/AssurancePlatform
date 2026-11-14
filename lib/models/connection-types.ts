/**
 * The kinds of model connection a user can add, and what each can do.
 * Plain data with no server imports, so both server code and screens can read
 * it. The values here are the single source for which jobs a type may be
 * given, whether its address is fixed, and whether it needs a key.
 */

export const MODEL_CONNECTION_TYPES = [
	"OPENROUTER",
	"OLLAMA",
	"OPENAI_COMPATIBLE",
	"ANTHROPIC",
	"OPENAI",
] as const;

/** The most characters stored for each value a user enters. */
export const MODEL_FIELD_LIMITS = {
	label: 60,
	baseUrl: 500,
	apiKey: 2048,
	model: 200,
} as const;

export type ModelConnectionType = (typeof MODEL_CONNECTION_TYPES)[number];

/** The three jobs a user assigns a connection and model to. */
export const MODEL_JOBS = ["chat", "ranking", "search"] as const;

export type ModelJob = (typeof MODEL_JOBS)[number];

export interface ConnectionTypeSpec {
	/**
	 * The address every connection of this type uses, or null when the user
	 * enters one.
	 */
	readonly baseUrl: string | null;
	/** The jobs a connection of this type can be given. */
	readonly jobs: readonly ModelJob[];
	/** Whether a connection of this type cannot be saved without a key. */
	readonly keyRequired: boolean;
}

/**
 * What the server needs to call a connection: its type, the address in use
 * and the decrypted key. The connection service's `ConnectionForUse` has this
 * shape.
 */
export interface ModelConnectionAccess {
	readonly apiKey: string | null;
	readonly baseUrl: string;
	readonly type: ModelConnectionType;
}

export const CONNECTION_TYPES: Readonly<
	Record<ModelConnectionType, ConnectionTypeSpec>
> = {
	OPENROUTER: {
		jobs: ["chat", "ranking", "search"],
		baseUrl: "https://openrouter.ai",
		keyRequired: true,
	},
	OLLAMA: {
		jobs: ["chat", "ranking", "search"],
		baseUrl: null,
		keyRequired: false,
	},
	OPENAI_COMPATIBLE: {
		jobs: ["chat", "search"],
		baseUrl: null,
		keyRequired: false,
	},
	ANTHROPIC: {
		jobs: ["chat"],
		baseUrl: "https://api.anthropic.com",
		keyRequired: true,
	},
	OPENAI: {
		jobs: ["chat"],
		baseUrl: "https://api.openai.com/v1",
		keyRequired: true,
	},
};

/** Narrows an untrusted string to a known connection type. */
export function isModelConnectionType(
	value: unknown
): value is ModelConnectionType {
	return (
		typeof value === "string" &&
		(MODEL_CONNECTION_TYPES as readonly string[]).includes(value)
	);
}

/** Whether a connection of `type` can be given `job`. */
export function connectionTypeCanDo(
	type: ModelConnectionType,
	job: ModelJob
): boolean {
	return CONNECTION_TYPES[type].jobs.includes(job);
}
