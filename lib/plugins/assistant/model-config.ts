import type { LanguageModel } from "ai";
import { chatModelFor } from "@/lib/models/adapters";
import type { TechniquesModelAccess } from "@/lib/plugins/assistant/techniques-models";
import {
	getConnectionForUse,
	getRoles,
} from "@/lib/services/model-connection-service";

/**
 * The assistant's models, from the signed-in user's own stored connections and
 * jobs. Each call reads them afresh, so a job or connection changed in
 * settings applies to the next request.
 */

type ChatModelResult = { model: LanguageModel } | { error: string };

const SETUP_HINT = "Set up AI models in Settings, Plugins.";

/**
 * The chat model for one request: the chat job's model on the connection it
 * names. A missing chat job, a connection that is missing, belongs to someone
 * else or cannot be read, or a connection of a type that cannot chat all give
 * an `error` that tells the user to set up AI models. The text never carries
 * a key or an address, so the route can return it as it is.
 */
export async function resolveChatModel(
	userId: string
): Promise<ChatModelResult> {
	const roles = await getRoles(userId);
	if ("error" in roles) {
		return {
			error:
				"Your AI model settings could not be read. Try again, or check them in Settings, Plugins.",
		};
	}
	const job = roles.data.chat;
	if (!job) {
		return { error: `No chat model is set up. ${SETUP_HINT}` };
	}
	const connection = await getConnectionForUse(userId, job.connectionId);
	if ("error" in connection) {
		return {
			error: `The connection for the chat model is not available. ${SETUP_HINT}`,
		};
	}
	try {
		return { model: chatModelFor(connection.data, job.model) };
	} catch {
		return {
			error: `The chat model cannot be used with its connection. ${SETUP_HINT}`,
		};
	}
}

/** The user's stored models as the techniques tool reads them, when it runs. */
export function modelAccessFor(userId: string): TechniquesModelAccess {
	return {
		roles: async () => {
			const roles = await getRoles(userId);
			return "data" in roles ? roles.data : null;
		},
		connection: async (connectionId) => {
			const connection = await getConnectionForUse(userId, connectionId);
			return "data" in connection ? connection.data : null;
		},
	};
}
