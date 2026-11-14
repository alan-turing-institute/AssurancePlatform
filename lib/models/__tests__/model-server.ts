import {
	createServer,
	type IncomingHttpHeaders,
	type Server,
	type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A local stand-in for a model server. A test puts its origin in
 * `TEA_MODELS_LOCAL_ADDRESSES`, so requests reach it through the real guard.
 */

export interface RecordedRequest {
	body: string;
	headers: IncomingHttpHeaders;
	method: string;
	/** The path and query. */
	url: string;
}

export type Responder = (
	request: RecordedRequest,
	response: ServerResponse
) => void;

export interface ModelServer {
	close(): Promise<void>;
	readonly origin: string;
	readonly requests: RecordedRequest[];
	/** What to answer with; replace it per test. */
	respond: Responder;
}

/** Answers with a JSON body. */
export function sendJson(
	response: ServerResponse,
	body: unknown,
	status = 200
): void {
	response.writeHead(status, { "content-type": "application/json" });
	response.end(JSON.stringify(body));
}

export async function startModelServer(
	respond: Responder = (_request, response) => sendJson(response, {}, 404)
): Promise<ModelServer> {
	const requests: RecordedRequest[] = [];
	const state = { respond };
	const server: Server = createServer((req, res) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => {
			const recorded: RecordedRequest = {
				method: req.method ?? "",
				url: req.url ?? "",
				headers: req.headers,
				body: Buffer.concat(chunks).toString("utf8"),
			};
			requests.push(recorded);
			state.respond(recorded, res);
		});
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	return {
		origin,
		requests,
		get respond() {
			return state.respond;
		},
		set respond(next: Responder) {
			state.respond = next;
		},
		close: () => {
			server.closeAllConnections();
			return new Promise<void>((resolve) => server.close(() => resolve()));
		},
	};
}
