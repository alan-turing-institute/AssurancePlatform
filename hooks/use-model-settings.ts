"use client";

import { useCallback, useState } from "react";
import { z } from "zod";
import { parseErrorMessage, useFetchOnMount } from "@/hooks/use-fetch-on-mount";
import {
	MODEL_CONNECTION_TYPES,
	MODEL_JOBS,
	type ModelConnectionType,
	type ModelJob,
} from "@/lib/models/connection-types";

const MODELS_URL = "/api/user/models";
const GENERIC_FAILURE = "Something went wrong";
const RATE_LIMIT_MESSAGE = "Too many checks; try again in a few minutes.";

const connectionTypeSchema = z.enum(MODEL_CONNECTION_TYPES);
const jobSchema = z.enum(MODEL_JOBS);

const assignmentSchema = z.object({
	connectionId: z.string(),
	model: z.string(),
});

const connectionSchema = z.object({
	id: z.string(),
	label: z.string(),
	type: connectionTypeSchema,
	baseUrl: z.string().nullable(),
	hasKey: z.boolean(),
});

const rolesSchema = z.object({
	chat: assignmentSchema.nullable(),
	ranking: assignmentSchema.nullable(),
	search: assignmentSchema.nullable(),
	searchCheck: z
		.object({ verifiedAt: z.string(), verifiedFor: z.string() })
		.nullable(),
});

const settingsSchema = z.object({
	connections: z.array(connectionSchema),
	roles: rolesSchema,
	recommended: z.record(
		connectionTypeSchema,
		z.record(jobSchema, z.string().nullable())
	),
	connectionTypes: z.array(
		z.object({
			type: connectionTypeSchema,
			baseUrl: z.string().nullable(),
			jobs: z.array(jobSchema),
			keyRequired: z.boolean(),
		})
	),
});

const testSchema = z.object({
	ok: z.boolean(),
	message: z.string(),
	models: z.object({
		chat: z.array(z.string()),
		ranking: z.array(z.string()),
		search: z.array(z.string()),
	}),
});

/** What a search check found: the vectors compared (or not), or no way to run it. */
const searchOutcomeSchema = z.union([
	z.object({ ok: z.boolean(), lowestCosine: z.number().nullable() }),
	z.object({ unavailable: z.literal(true) }),
]);

const savedRolesSchema = z.object({
	roles: rolesSchema,
	searchCheck: searchOutcomeSchema.nullable(),
});

const quickSetupSchema = z.object({
	connection: connectionSchema,
	roles: rolesSchema,
	searchCheck: searchOutcomeSchema.nullable(),
	unsetJobs: z.array(jobSchema),
});

export type ModelConnection = z.infer<typeof connectionSchema>;
export type JobAssignment = z.infer<typeof assignmentSchema>;
export type ModelSettings = z.infer<typeof settingsSchema>;
export type TestOutcome = z.infer<typeof testSchema>;
export type SearchOutcome = z.infer<typeof searchOutcomeSchema>;

/** The three jobs as `PUT /api/user/models/roles` takes them: `null` switches a job off. */
export type RolesInput = Record<ModelJob, JobAssignment | null>;

export interface NewConnectionInput {
	apiKey?: string;
	baseUrl?: string;
	label: string;
	type: ModelConnectionType;
}

export interface ConnectionPatch {
	/** A new key replaces the old one; `null` removes it. */
	apiKey?: string | null;
	baseUrl?: string;
	label?: string;
}

/** The outcome of a request: a value, or the message to show the user. */
export type ActionResult<T = undefined> =
	| { ok: true; value: T }
	| { message: string; ok: false };

/** The last search check seen this session, and the search job it ran for. */
export interface RecordedSearchCheck {
	job: JobAssignment;
	outcome: SearchOutcome;
}

export interface UseModelSettingsResult {
	addConnection: (input: NewConnectionInput) => Promise<ActionResult>;
	error: string | null;
	/** The last search check this session ran, if any. */
	lastSearchCheck: RecordedSearchCheck | null;
	loading: boolean;
	quickSetup: (
		openRouterKey: string
	) => Promise<ActionResult<{ unsetJobs: ModelJob[] }>>;
	removeConnection: (id: string) => Promise<ActionResult>;
	saveJobs: (roles: RolesInput) => Promise<ActionResult>;
	settings: ModelSettings | null;
	testConnection: (id: string) => Promise<ActionResult<TestOutcome>>;
	/** Connection ids with a test in flight. */
	testing: readonly string[];
	/** Test results by connection id, kept for the session so each call counts once against the limit. */
	tests: Readonly<Record<string, TestOutcome>>;
	updateConnection: (
		id: string,
		patch: ConnectionPatch
	) => Promise<ActionResult>;
}

async function request<T>(
	url: string,
	schema: z.ZodType<T>,
	init?: RequestInit
): Promise<T> {
	const response = await fetch(url, init);
	if (response.status === 429) {
		throw new Error(RATE_LIMIT_MESSAGE);
	}
	if (!response.ok) {
		throw new Error(await parseErrorMessage(response));
	}
	const parsed = schema.safeParse(await response.json().catch(() => null));
	if (!parsed.success) {
		throw new Error(GENERIC_FAILURE);
	}
	return parsed.data;
}

function jsonInit(method: string, body?: unknown): RequestInit {
	return {
		method,
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	};
}

async function attempt<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
	try {
		return { ok: true, value: await run() };
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : GENERIC_FAILURE,
		};
	}
}

function fetchSettings(): Promise<ModelSettings> {
	return request(MODELS_URL, settingsSchema);
}

const connectionUrl = (id: string) =>
	`${MODELS_URL}/connections/${encodeURIComponent(id)}`;

/**
 * The AI models block's data: the user's connections, the three jobs, the
 * recommended models and the connection types on offer, fetched from
 * `/api/user/models`. Every change goes to its route and then fetches the
 * lot again, so the screen shows what the server holds. Connection test
 * results are kept per connection for the life of the hook, so listing a
 * connection's models costs one call against the server's limit however
 * often a picker opens. Nothing here holds a key after a request is sent:
 * the routes return only whether one is set.
 */
export function useModelSettings(): UseModelSettingsResult {
	const { data, loading, error, reload } = useFetchOnMount(fetchSettings);
	const [tests, setTests] = useState<Record<string, TestOutcome>>({});
	const [testing, setTesting] = useState<readonly string[]>([]);
	const [lastSearchCheck, setLastSearchCheck] =
		useState<RecordedSearchCheck | null>(null);

	const forgetTest = useCallback((id: string) => {
		setTests((current) =>
			Object.fromEntries(Object.entries(current).filter(([key]) => key !== id))
		);
	}, []);

	const testConnection = useCallback(async (id: string) => {
		setTesting((current) => [...current, id]);
		const result = await attempt(() =>
			request(`${connectionUrl(id)}/test`, testSchema, jsonInit("POST"))
		);
		setTesting((current) => current.filter((item) => item !== id));
		if (result.ok) {
			setTests((current) => ({ ...current, [id]: result.value }));
		}
		return result;
	}, []);

	const addConnection = useCallback(
		async (input: NewConnectionInput) => {
			const result = await attempt(() =>
				request(
					`${MODELS_URL}/connections`,
					connectionSchema,
					jsonInit("POST", input)
				)
			);
			if (!result.ok) {
				return result;
			}
			await reload();
			return { ok: true, value: undefined } as const;
		},
		[reload]
	);

	const updateConnection = useCallback(
		async (id: string, patch: ConnectionPatch) => {
			const result = await attempt(() =>
				request(connectionUrl(id), connectionSchema, jsonInit("PATCH", patch))
			);
			if (!result.ok) {
				return result;
			}
			forgetTest(id);
			await reload();
			return { ok: true, value: undefined } as const;
		},
		[forgetTest, reload]
	);

	const removeConnection = useCallback(
		async (id: string) => {
			const result = await attempt(() =>
				request(connectionUrl(id), z.object({}), jsonInit("DELETE"))
			);
			if (!result.ok) {
				return result;
			}
			forgetTest(id);
			await reload();
			return { ok: true, value: undefined } as const;
		},
		[forgetTest, reload]
	);

	const saveJobs = useCallback(
		async (roles: RolesInput) => {
			const result = await attempt(() =>
				request(`${MODELS_URL}/roles`, savedRolesSchema, jsonInit("PUT", roles))
			);
			if (!result.ok) {
				return result;
			}
			if (roles.search && result.value.searchCheck) {
				setLastSearchCheck({
					job: roles.search,
					outcome: result.value.searchCheck,
				});
			}
			await reload();
			return { ok: true, value: undefined } as const;
		},
		[reload]
	);

	const quickSetup = useCallback(
		async (openRouterKey: string) => {
			const result = await attempt(() =>
				request(
					`${MODELS_URL}/quick-setup`,
					quickSetupSchema,
					jsonInit("POST", { openRouterKey })
				)
			);
			if (!result.ok) {
				return result;
			}
			const { roles, searchCheck, unsetJobs } = result.value;
			if (roles.search && searchCheck) {
				setLastSearchCheck({ job: roles.search, outcome: searchCheck });
			}
			await reload();
			return { ok: true, value: { unsetJobs } } as const;
		},
		[reload]
	);

	return {
		settings: data,
		loading,
		error,
		tests,
		testing,
		lastSearchCheck,
		testConnection,
		addConnection,
		updateConnection,
		removeConnection,
		saveJobs,
		quickSetup,
	};
}
