/**
 * A stand-in for OpenAI's Responses API at the network edge, and recorded-style
 * event streams for it.
 *
 * The streams are built from the AI SDK's own parser, not from recordings: the
 * installed `@ai-sdk/openai` ships no captured streams. Each event carries
 * the fields that `openaiResponsesChunkSchema`
 * (`src/responses/openai-responses-api.ts`) requires for its type, and the
 * order follows what `doStream` in `openai-responses-language-model.ts` reads:
 * `response.created`, then per output item an `output_item.added` and an
 * `output_item.done` (a reasoning item carries its `encrypted_content` on the
 * `done` event only), `function_call_arguments.*` for a tool call and
 * `output_text.delta` for text, ending in `response.completed`. The SDK
 * rejects an event of a modelled type that fails that schema, so a malformed
 * event here fails the test that sends it.
 *
 * `routeFetch` wraps undici's `fetch`, which the network guard calls. A request
 * to OpenAI's host is recorded and answered from the queue; one to a loopback
 * address goes on to the real `fetch` (for the local model servers); any other
 * host is recorded and refused, so a stray request cannot leave the machine.
 */

type Event = Record<string, unknown>;
type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const OPENAI_HOST = "api.openai.com";

interface WireRequest {
	/** The request body parsed as JSON. */
	readonly body: Record<string, unknown>;
	readonly headers: Headers;
	readonly method: string;
	readonly rawBody: string;
	readonly url: string;
}

/** Every request that reached the network edge, in order. */
export const wire = {
	requests: [] as WireRequest[],
	/** Replies for OpenAI's host, used first in, first out. */
	replies: [] as (() => Response)[],
	reset(): void {
		this.requests.length = 0;
		this.replies.length = 0;
	},
	/** The requests that went to OpenAI's host. */
	get toOpenAi(): WireRequest[] {
		return this.requests.filter(
			(request) => new URL(request.url).hostname === OPENAI_HOST
		);
	},
};

function record(input: string, init?: RequestInit): WireRequest {
	const rawBody = typeof init?.body === "string" ? init.body : "";
	let body: Record<string, unknown> = {};
	try {
		body = JSON.parse(rawBody) as Record<string, unknown>;
	} catch {
		// Not a JSON request; leave the parsed body empty.
	}
	const request = {
		url: input,
		method: init?.method ?? "GET",
		headers: new Headers(init?.headers),
		rawBody,
		body,
	};
	wire.requests.push(request);
	return request;
}

/** The `fetch` to put in place of undici's. */
export function routeFetch(realFetch: Fetch): Fetch {
	return (input, init) => {
		record(input, init);
		const { hostname } = new URL(input);
		if (hostname === OPENAI_HOST) {
			const reply = wire.replies.shift();
			return Promise.resolve(
				reply
					? reply()
					: Response.json(
							{ error: { message: "no reply queued" } },
							{ status: 500 }
						)
			);
		}
		if (hostname === "127.0.0.1") {
			return realFetch(input, init);
		}
		return Promise.reject(new TypeError("fetch failed"));
	};
}

/**
 * A server-sent event stream as OpenAI writes it: an `event:` line and a `data:`
 * line for each event, every event numbered in order.
 */
export function eventStream(events: Event[]): Response {
	const text = events
		.map((event, index): Event => ({ sequence_number: index, ...event }))
		.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
		.join("");
	return new Response(text, {
		status: 200,
		headers: { "content-type": "text/event-stream" },
	});
}

const USAGE = {
	input_tokens: 40,
	output_tokens: 12,
	output_tokens_details: { reasoning_tokens: 6 },
	total_tokens: 52,
};

function created(id: string): Event {
	return {
		type: "response.created",
		response: { id, created_at: 1_700_000_000, model: "m" },
	};
}

function completed(incompleteReason?: string): Event {
	return incompleteReason
		? {
				type: "response.incomplete",
				response: {
					incomplete_details: { reason: incompleteReason },
					usage: USAGE,
				},
			}
		: {
				type: "response.completed",
				response: { incomplete_details: null, usage: USAGE },
			};
}

export interface ReasoningItem {
	readonly encrypted: string;
	readonly id: string;
	/** Summary texts; none when the request did not ask for a summary. */
	readonly summaries?: readonly string[];
}

/** The events of one reasoning item at `index`. */
function reasoningEvents(item: ReasoningItem, index: number): Event[] {
	const summaries = item.summaries ?? [];
	return [
		{
			type: "response.output_item.added",
			output_index: index,
			item: { type: "reasoning", id: item.id, encrypted_content: null },
		},
		...summaries.flatMap((text, summaryIndex) => [
			{
				type: "response.reasoning_summary_part.added",
				item_id: item.id,
				summary_index: summaryIndex,
			},
			{
				type: "response.reasoning_summary_text.delta",
				item_id: item.id,
				summary_index: summaryIndex,
				delta: text,
			},
			{
				type: "response.reasoning_summary_part.done",
				item_id: item.id,
				summary_index: summaryIndex,
			},
		]),
		{
			type: "response.output_item.done",
			output_index: index,
			item: {
				type: "reasoning",
				id: item.id,
				encrypted_content: item.encrypted,
			},
		},
	];
}

export interface ToolCallItem {
	readonly arguments?: string;
	readonly callId: string;
	readonly id: string;
	readonly name: string;
}

/** The events of one function call at `index`. */
function toolCallEvents(call: ToolCallItem, index: number): Event[] {
	const args = call.arguments ?? "{}";
	return [
		{
			type: "response.output_item.added",
			output_index: index,
			item: {
				type: "function_call",
				id: call.id,
				call_id: call.callId,
				name: call.name,
				arguments: "",
			},
		},
		{
			type: "response.function_call_arguments.delta",
			item_id: call.id,
			output_index: index,
			delta: args,
		},
		{
			type: "response.function_call_arguments.done",
			item_id: call.id,
			output_index: index,
			arguments: args,
		},
		{
			type: "response.output_item.done",
			output_index: index,
			item: {
				type: "function_call",
				id: call.id,
				call_id: call.callId,
				name: call.name,
				arguments: args,
				status: "completed",
			},
		},
	];
}

/** The events of one text message at `index`. */
function messageEvents(id: string, text: string, index: number): Event[] {
	return [
		{
			type: "response.output_item.added",
			output_index: index,
			item: { type: "message", id },
		},
		// Events the SDK does not model; a real stream carries them.
		{
			type: "response.content_part.added",
			item_id: id,
			output_index: index,
			content_index: 0,
			part: { type: "output_text", text: "", annotations: [] },
		},
		{ type: "response.output_text.delta", item_id: id, delta: text },
		{
			type: "response.output_text.done",
			item_id: id,
			output_index: index,
			content_index: 0,
			text,
		},
		{
			type: "response.output_item.done",
			output_index: index,
			item: { type: "message", id },
		},
	];
}

export interface ReplyParts {
	/** Ends the response as incomplete for this reason, as when the output limit is reached. */
	readonly incompleteReason?: string;
	readonly reasoning?: ReasoningItem;
	readonly text?: { id: string; text: string };
	readonly toolCalls?: readonly ToolCallItem[];
}

/** One Responses stream: optional reasoning, then any tool calls, then optional text. */
export function reply(parts: ReplyParts, responseId = "resp_1"): Response {
	const events: Event[] = [
		created(responseId),
		{ type: "response.in_progress", response: { id: responseId } },
	];
	let index = 0;
	if (parts.reasoning) {
		events.push(...reasoningEvents(parts.reasoning, index));
		index += 1;
	}
	for (const call of parts.toolCalls ?? []) {
		events.push(...toolCallEvents(call, index));
		index += 1;
	}
	if (parts.text) {
		events.push(...messageEvents(parts.text.id, parts.text.text, index));
	}
	events.push(completed(parts.incompleteReason));
	return eventStream(events);
}
