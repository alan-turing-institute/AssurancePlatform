import { HttpResponse, http } from "msw";
import {
	CONNECTION_TYPES,
	MODEL_CONNECTION_TYPES,
	MODEL_JOBS,
	type ModelConnectionType,
	type ModelJob,
} from "@/lib/models/connection-types";
import { server } from "@/src/__tests__/mocks/server";

/**
 * An in-memory stand-in for the routes under `/api/user/models`, installed
 * into the shared msw server. It keeps connections and jobs the way the real
 * routes do (never returning a key, only whether one is set) and records each
 * request, so a test can say what the screen sent.
 */

export interface FakeConnection {
	baseUrl: string | null;
	hasKey: boolean;
	id: string;
	label: string;
	type: ModelConnectionType;
}

export interface FakeJob {
	connectionId: string;
	model: string;
}

export interface FakeTestAnswer {
	message: string;
	models: Record<ModelJob, string[]>;
	ok: boolean;
}

export interface FakeRoles {
	chat: FakeJob | null;
	ranking: FakeJob | null;
	search: FakeJob | null;
	searchCheck: { verifiedAt: string; verifiedFor: string } | null;
}

export interface FakeRequest {
	body: unknown;
	method: string;
	path: string;
}

export interface FakeModels {
	connections: FakeConnection[];
	/** What the roles route answers for `searchCheck` when the search job is saved or re-checked. */
	nextSearchCheck:
		| { lowestCosine: number | null; ok: boolean }
		| { unavailable: true }
		| null;
	/** The recommended model per connection type and job, as production lists them; a test may empty one. */
	recommended: Record<ModelConnectionType, Record<ModelJob, string | null>>;
	requests: FakeRequest[];
	roles: FakeRoles;
	/** What `GET` answers for `roles.searchCheckCurrent`: whether the stored check is for the catalogue's current spec. */
	searchCheckCurrent: boolean;
	/** The test answer for each connection id; the default lists a few models. */
	testAnswers: Record<string, FakeTestAnswer>;
}

const RECOMMENDED: FakeModels["recommended"] = {
	OPENROUTER: {
		chat: "anthropic/claude-sonnet-5.5",
		ranking: "cloudflare/clef-flash",
		search: "qwen/qwen3-embedding-4b",
	},
	OLLAMA: {
		chat: null,
		ranking: "clef-flash",
		search: "qwen3-embedding:4b-fp16",
	},
	OPENAI_COMPATIBLE: { chat: null, ranking: null, search: null },
	ANTHROPIC: { chat: null, ranking: null, search: null },
};

const DEFAULT_TEST_ANSWER: FakeTestAnswer = {
	ok: true,
	message: "The connection works.",
	models: {
		chat: ["chat-alpha", "chat-beta"],
		ranking: ["rank-alpha"],
		search: ["embed-alpha"],
	},
};

export const connection = (
	overrides: Partial<FakeConnection> & { id: string }
): FakeConnection => {
	const type = overrides.type ?? "OLLAMA";
	return {
		label: `Connection ${overrides.id}`,
		type,
		baseUrl: CONNECTION_TYPES[type].baseUrl ?? "https://ollama.example.com",
		hasKey: false,
		...overrides,
	};
};

const connectionTypes = () =>
	MODEL_CONNECTION_TYPES.map((type) => ({ type, ...CONNECTION_TYPES[type] }));

const emptyRoles = (): FakeRoles => ({
	chat: null,
	ranking: null,
	search: null,
	searchCheck: null,
});

/** Installs the fake routes and returns the state a test can read and change. */
export function installModelRoutes(
	initial: Partial<Pick<FakeModels, "connections" | "roles">> = {}
): FakeModels {
	const state: FakeModels = {
		connections: initial.connections ?? [],
		roles: initial.roles ?? emptyRoles(),
		testAnswers: {},
		nextSearchCheck: null,
		recommended: structuredClone(RECOMMENDED),
		requests: [],
		searchCheckCurrent: true,
	};
	let counter = 0;
	const record = async (request: Request) => {
		const path = new URL(request.url).pathname;
		const text = await request.clone().text();
		state.requests.push({
			method: request.method,
			path,
			body: text ? JSON.parse(text) : undefined,
		});
	};
	/** Records a passed check as current, and leaves a failed one unrecorded. */
	const recordCheck = (outcome: FakeModels["nextSearchCheck"]) => {
		if (outcome && "ok" in outcome && outcome.ok) {
			state.roles.searchCheck = {
				verifiedAt: "2026-01-01T00:00:00.000Z",
				verifiedFor: "catalogue",
			};
			state.searchCheckCurrent = true;
		}
	};
	const emptyJobsOf = (connectionId: string) => {
		for (const job of MODEL_JOBS) {
			if (state.roles[job]?.connectionId === connectionId) {
				state.roles[job] = null;
				if (job === "search") {
					state.roles.searchCheck = null;
				}
			}
		}
	};

	server.use(
		http.get("/api/user/models", async ({ request }) => {
			await record(request);
			return HttpResponse.json({
				connections: state.connections,
				roles: {
					...state.roles,
					searchCheckCurrent: state.searchCheckCurrent,
				},
				recommended: state.recommended,
				connectionTypes: connectionTypes(),
			});
		}),
		http.post("/api/user/models/connections", async ({ request }) => {
			await record(request);
			const body = (await request.clone().json()) as {
				apiKey?: string;
				baseUrl?: string;
				label: string;
				type: ModelConnectionType;
			};
			counter += 1;
			const created = connection({
				id: `new-${counter}`,
				label: body.label,
				type: body.type,
				baseUrl: CONNECTION_TYPES[body.type].baseUrl ?? body.baseUrl ?? null,
				hasKey: Boolean(body.apiKey),
			});
			state.connections.push(created);
			return HttpResponse.json(created, { status: 201 });
		}),
		http.patch(
			"/api/user/models/connections/:id",
			async ({ params, request }) => {
				await record(request);
				const body = (await request.clone().json()) as {
					apiKey?: string | null;
					baseUrl?: string;
					label?: string;
				};
				const found = state.connections.find((item) => item.id === params.id);
				if (!found) {
					return HttpResponse.json(
						{ error: "Model connection not found", code: "NOT_FOUND" },
						{ status: 404 }
					);
				}
				const movesAddress =
					body.baseUrl !== undefined && body.baseUrl !== found.baseUrl;
				found.label = body.label ?? found.label;
				found.baseUrl = body.baseUrl ?? found.baseUrl;
				if (body.apiKey !== undefined) {
					found.hasKey = body.apiKey !== null;
				}
				// A new address or key clears the check of a search job that runs on the connection.
				if (
					state.roles.search?.connectionId === found.id &&
					(movesAddress || body.apiKey !== undefined)
				) {
					state.roles.searchCheck = null;
				}
				return HttpResponse.json(found);
			}
		),
		http.delete(
			"/api/user/models/connections/:id",
			async ({ params, request }) => {
				await record(request);
				const id = String(params.id);
				emptyJobsOf(id);
				state.connections = state.connections.filter((item) => item.id !== id);
				return HttpResponse.json({ success: true });
			}
		),
		http.post(
			"/api/user/models/connections/:id/test",
			async ({ params, request }) => {
				await record(request);
				return HttpResponse.json(
					state.testAnswers[String(params.id)] ?? DEFAULT_TEST_ANSWER
				);
			}
		),
		http.put("/api/user/models/roles", async ({ request }) => {
			await record(request);
			const { recheckSearch, ...body } = (await request.clone().json()) as Omit<
				FakeRoles,
				"searchCheck"
			> & { recheckSearch?: boolean };
			const searchChanged =
				body.search?.connectionId !== state.roles.search?.connectionId ||
				body.search?.model !== state.roles.search?.model;
			state.roles = { ...body, searchCheck: state.roles.searchCheck };
			if (searchChanged) {
				state.roles.searchCheck = null;
			}
			// The check runs for a changed search job, or when asked for.
			const ran =
				body.search !== null &&
				(searchChanged || recheckSearch === true) &&
				state.nextSearchCheck !== null;
			const searchCheck = ran ? state.nextSearchCheck : null;
			recordCheck(searchCheck);
			return HttpResponse.json({ roles: state.roles, searchCheck });
		}),
		http.post("/api/user/models/quick-setup", async ({ request }) => {
			await record(request);
			counter += 1;
			const created = connection({
				id: `new-${counter}`,
				label: "OpenRouter",
				type: "OPENROUTER",
				hasKey: true,
			});
			state.connections.push(created);
			const fill = (job: ModelJob) => {
				const model = state.recommended.OPENROUTER[job];
				return model ? { connectionId: created.id, model } : state.roles[job];
			};
			state.roles = {
				chat: fill("chat"),
				ranking: fill("ranking"),
				search: fill("search"),
				searchCheck: null,
			};
			const searchCheck = state.roles.search ? state.nextSearchCheck : null;
			recordCheck(searchCheck);
			return HttpResponse.json(
				{
					connection: created,
					roles: state.roles,
					searchCheck,
					unsetJobs: MODEL_JOBS.filter((job) => !state.roles[job]),
				},
				{ status: 201 }
			);
		})
	);
	return state;
}

/** The requests the screen sent to a route, in order. */
export const requestsTo = (
	state: FakeModels,
	method: string,
	pathEnd: string
) =>
	state.requests.filter(
		(request) => request.method === method && request.path.endsWith(pathEnd)
	);
