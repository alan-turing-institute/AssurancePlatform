import type { ModelConnectionType } from "@/lib/models/connection-types";
import {
	createConnection,
	setRoles,
} from "@/lib/services/model-connection-service";

/**
 * Gives a user a stored model connection and puts the chat job on it, through
 * the connection service as the settings routes do. Returns the connection's
 * id. The address is only used by tests that let the real chat model call it.
 */
export async function giveChatJob(
	userId: string,
	{
		apiKey = null,
		baseUrl = "http://localhost:11434",
		model = "small-model",
		type = "OLLAMA",
	}: {
		apiKey?: string | null;
		baseUrl?: string;
		model?: string;
		type?: ModelConnectionType;
	} = {}
): Promise<string> {
	const connection = await createConnection(userId, {
		label: "Test connection",
		type,
		baseUrl,
		apiKey,
	});
	if (!("data" in connection)) {
		throw new Error(`Could not seed a connection: ${connection.error}`);
	}
	const roles = await setRoles(userId, {
		chat: { connectionId: connection.data.id, model },
		ranking: null,
		search: null,
	});
	if (!("data" in roles)) {
		throw new Error(`Could not seed the jobs: ${roles.error}`);
	}
	return connection.data.id;
}
