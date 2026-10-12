import prisma from "@/lib/prisma";
import {
	type ConnectionSummary,
	type CreateConnectionInput,
	createConnection,
} from "@/lib/services/model-connection-service";
import { mockAuth } from "./auth-helpers";
import { createTestPluginState, createTestUser } from "./prisma-factories";

/**
 * Calls the routes under /api/user/models the way the framework would, and
 * sets up users, plugin state and connections for them. Only the session is
 * mocked; the database is real.
 */

const ASSISTANT_PLUGIN = "tea.assistant";
const BASE = "http://localhost:3000/api/user/models";

export interface Answer {
	/** The parsed body, or null when it is not JSON. */
	json: Record<string, unknown> | null;
	status: number;
	text: string;
}

async function answer(response: Response): Promise<Answer> {
	const text = await response.text();
	let parsed: Record<string, unknown> | null = null;
	try {
		parsed = JSON.parse(text) as Record<string, unknown>;
	} catch {
		parsed = null;
	}
	return { status: response.status, text, json: parsed };
}

function request(method: string, path: string, body?: unknown): Request {
	return new Request(`${BASE}${path}`, {
		method,
		headers: { "content-type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

function raw(method: string, path: string, body: string): Request {
	return new Request(`${BASE}${path}`, {
		method,
		headers: { "content-type": "application/json" },
		body,
	});
}

export async function routes() {
	const [index, connections, connection, test, roles, quick] =
		await Promise.all([
			import("@/app/api/user/models/route"),
			import("@/app/api/user/models/connections/route"),
			import("@/app/api/user/models/connections/[id]/route"),
			import("@/app/api/user/models/connections/[id]/test/route"),
			import("@/app/api/user/models/roles/route"),
			import("@/app/api/user/models/quick-setup/route"),
		]);
	const params = (id: string) => ({ params: Promise.resolve({ id }) });
	return {
		list: async () => answer(await index.GET()),
		create: async (body: unknown) =>
			answer(await connections.POST(request("POST", "/connections", body))),
		createRaw: async (body: string) =>
			answer(await connections.POST(raw("POST", "/connections", body))),
		patch: async (id: string, body: unknown) =>
			answer(
				await connection.PATCH(
					request("PATCH", `/connections/${id}`, body),
					params(id)
				)
			),
		remove: async (id: string) =>
			answer(
				await connection.DELETE(
					request("DELETE", `/connections/${id}`),
					params(id)
				)
			),
		test: async (id: string) =>
			answer(
				await test.POST(request("POST", `/connections/${id}/test`), params(id))
			),
		setRoles: async (body: unknown) =>
			answer(await roles.PUT(request("PUT", "/roles", body))),
		quickSetup: async (body: unknown) =>
			answer(await quick.POST(request("POST", "/quick-setup", body))),
		quickSetupRaw: async (body: string) =>
			answer(await quick.POST(raw("POST", "/quick-setup", body))),
	};
}

export type Routes = Awaited<ReturnType<typeof routes>>;

/** A user whose Case Assistant is on, signed in as the session user when `signIn` is true. */
export async function makeUser(options: { enabled?: boolean } = {}) {
	const user = await createTestUser();
	if (options.enabled !== false) {
		await createTestPluginState(user.id, {
			pluginId: ASSISTANT_PLUGIN,
			enabled: true,
		});
	}
	return user;
}

export async function signInAs(user: {
	email: string;
	id: string;
	username: string;
}) {
	await mockAuth(user.id, user.username, user.email);
}

export async function addConnection(
	userId: string,
	overrides: Partial<CreateConnectionInput> = {}
): Promise<ConnectionSummary> {
	const result = await createConnection(userId, {
		label: "Local",
		type: "OLLAMA",
		baseUrl: "http://localhost:11434",
		...overrides,
	});
	if ("error" in result) {
		throw new Error(`could not add a connection: ${result.error}`);
	}
	return result.data;
}

export async function rolesRow(userId: string) {
	return await prisma.userModelRoles.findUnique({ where: { userId } });
}

export async function connectionRows(userId?: string) {
	return await prisma.userModelConnection.findMany({
		where: userId ? { userId } : undefined,
		orderBy: { createdAt: "asc" },
	});
}
