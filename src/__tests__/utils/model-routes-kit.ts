import { NextRequest } from "next/server";
import {
	type ModelServer,
	type Responder,
	sendJson,
	startModelServer,
} from "@/lib/models/__tests__/model-server";
import type { EmbeddingSpec } from "@/lib/models/embedding-check";
import { mockAuth } from "./auth-helpers";
import { createTestPluginState, createTestUser } from "./prisma-factories";

/**
 * Shared set-up for the model route tests: a signed-in user with the
 * assistant plugin on, request builders, and local stand-ins for a model
 * server and the techniques service. Nothing here reaches the internet.
 */

export const SECRET = "sk-test-secret-value-123";

/** The catalogue's published embedding spec, as the techniques stub serves it. */
export const SPEC: EmbeddingSpec = {
	modelId: "catalogue-model",
	dimensions: 4,
	queryPrefix: "query: ",
	documentFormat: "title. summary",
	dataVersion: "1",
	probes: [
		{ text: "explain the model", vector: [1, 0, 0, 0] },
		{ text: "check the fairness of the outputs", vector: [0, 1, 0, 0] },
		{ text: "a long probe sentence", vector: [0, 0, 1, 0] },
	],
};

/** The vectors the catalogue published, so the search check passes. */
const exactVectors = (probe: number): number[] =>
	SPEC.probes[probe]?.vector ?? [];

/** Vectors at right angles to the published ones, so the search check fails. */
export const wrongVectors = (probe: number): number[] =>
	SPEC.probes[(probe + 1) % SPEC.probes.length]?.vector ?? [];

export interface StubBehaviour {
	/** Whether the stub accepts the key on OpenRouter's key check. */
	keyAccepted: boolean;
	/** Holds the embedding answer: call `send` to let it through. */
	onEmbeddings?: (send: () => void) => void;
	/** The vector the stub gives for the probe at this index. */
	vectorFor: (probe: number) => number[];
}

export function stubBehaviour(): StubBehaviour {
	return { keyAccepted: true, vectorFor: exactVectors };
}

/**
 * Answers as an Ollama or OpenRouter server would: model lists, OpenRouter's
 * key check and embeddings of the probe sentences.
 */
export function modelResponder(behaviour: StubBehaviour): Responder {
	return (request, response) => {
		const path = request.url.split("?")[0] ?? "";
		if (path === "/api/tags") {
			sendJson(response, { models: [{ name: "llama3" }, { name: "embed" }] });
		} else if (path === "/api/v1/key") {
			if (behaviour.keyAccepted) {
				sendJson(response, { data: { label: "key" } });
			} else {
				sendJson(response, { error: "no" }, 401);
			}
		} else if (path === "/api/v1/embeddings/models") {
			sendJson(response, { data: [{ id: "vendor/embed-model" }] });
		} else if (path === "/api/v1/models") {
			sendJson(response, { data: [{ id: "vendor/chat-model" }] });
		} else if (request.method === "POST" && path.endsWith("/embeddings")) {
			const { input } = JSON.parse(request.body) as { input: string[] };
			const send = () =>
				sendJson(response, {
					object: "list",
					model: "m",
					data: input.map((text, index) => ({
						object: "embedding",
						index,
						embedding: behaviour.vectorFor(
							SPEC.probes.findIndex((probe) => text.endsWith(probe.text))
						),
					})),
					usage: { prompt_tokens: 1, total_tokens: 1 },
				});
			if (behaviour.onEmbeddings) {
				behaviour.onEmbeddings(send);
			} else {
				send();
			}
		} else {
			sendJson(response, {}, 404);
		}
	};
}

/** A stand-in for the techniques service that serves `/embedding-spec`, or fails when `spec` is null. */
export function startTechniquesStub(
	spec: EmbeddingSpec | null = SPEC
): Promise<ModelServer> {
	return startModelServer((request, response) => {
		if (spec && request.url === "/embedding-spec") {
			sendJson(response, spec);
		} else {
			sendJson(response, {}, 404);
		}
	});
}

/** A user with the assistant plugin on, signed in for the route handlers. */
export async function signedInUserWithModels() {
	const user = await createTestUser();
	await createTestPluginState(user.id, {
		pluginId: "tea.assistant",
		enabled: true,
	});
	await mockAuth(user.id, user.username, user.email);
	return user;
}

/** A request to a model route. */
export function modelRequest(
	method: string,
	path: string,
	body?: unknown
): NextRequest {
	return new NextRequest(`http://localhost:3000/api/user/models${path}`, {
		method,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

/** The second argument of a route handler with an `[id]` segment. */
export function idParams(id: string) {
	return { params: Promise.resolve({ id }) };
}
