import {
	createUIMessageStreamResponse,
	stepCountIs,
	streamText,
	type UIMessage,
} from "ai";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api-request";
import {
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
} from "@/lib/api-response";
import { AppError, notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { canAccessCase } from "@/lib/permissions";
import { ASSISTANT_PLUGIN_ID } from "@/lib/plugins/assistant/constants";
import {
	modelAccessFor,
	resolveChatModel,
} from "@/lib/plugins/assistant/model-config";
import { modelHistory } from "@/lib/plugins/assistant/model-history";
import { modelTimeoutMs } from "@/lib/plugins/assistant/model-timeout";
import { noDownload } from "@/lib/plugins/assistant/no-download";
import { providerErrorMessage } from "@/lib/plugins/assistant/provider-message";
import { replyNotices } from "@/lib/plugins/assistant/reply-notices";
import {
	resolveSelectedElement,
	selectionPrompt,
} from "@/lib/plugins/assistant/selected-element";
import { techniquesPrompt } from "@/lib/plugins/assistant/techniques-tool";
import {
	buildSystemPrompt,
	createCaseTools,
} from "@/lib/plugins/assistant/tools";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";

const log = logger.child({ component: "assistant-route" });

/** Chat history carries earlier tool results (whole case trees), so the cap is generous. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_MESSAGES = 100;
const MAX_STEPS = 8;
/**
 * Bounds on one model call: tokens written and provider retries. The cap on
 * tokens is room for the answer to a request such as a case lint, which has
 * the model apply a long list of rules, and for a reasoning model's thinking
 * before it; it is a request to the model server, and the cap on the size of
 * the response in `lib/models/adapters.ts` is what holds regardless. The wall
 * time of the whole reply is ASSISTANT_MODEL_TIMEOUT_MS. The SDK retries only
 * errors the provider marks retryable; a failure the network guard reports as
 * `request-failed` reaches it as a plain error and is not retried, so one
 * retry is the most a reply makes.
 */
const MAX_OUTPUT_TOKENS = 8192;
const MAX_RETRIES = 1;

/**
 * What is logged about a failed stream: the error's class, and the HTTP status
 * when the provider answered with one. The error's message is the provider's
 * own text, which can quote the key or the address, so it is never logged.
 */
function describeStreamError(error: unknown): {
	errorName: string;
	httpStatus?: number;
} {
	const status =
		typeof error === "object" && error !== null && "statusCode" in error
			? error.statusCode
			: undefined;
	return {
		errorName: error instanceof Error ? error.name : "unknown",
		httpStatus: typeof status === "number" ? status : undefined,
	};
}

/** Whether a message part is a file part, whatever its role or contents. */
function isFilePart(part: unknown): boolean {
	return (
		typeof part === "object" &&
		part !== null &&
		"type" in part &&
		part.type === "file"
	);
}

const messageSchema = z.looseObject({
	id: z.string().max(200),
	role: z.enum(["user", "assistant"]),
	parts: z
		.array(z.unknown())
		.max(200)
		.refine((parts) => !parts.some(isFilePart), "File parts are not accepted"),
});

const bodySchema = z.object({
	messages: z.array(messageSchema).min(1).max(MAX_MESSAGES),
	selectedElementId: z.uuid().optional(),
});

/**
 * The checks every assistant handler makes before it does anything else, in
 * this order: session (401), plugin enablement, case id format and VIEW
 * permission. A disabled plugin, a malformed id, a missing case and a case the
 * user cannot view all give the same 404.
 */
async function authorise(params: Promise<{ id: string }>) {
	const userId = await requireAuth();
	const { id: caseId } = await params;

	const enabled = await assertPluginEnabledForUser(ASSISTANT_PLUGIN_ID, userId);
	if ("error" in enabled) {
		throw notFound("Case");
	}
	if (
		!(
			z.uuid().safeParse(caseId).success &&
			(await canAccessCase({ userId, caseId }, "VIEW"))
		)
	) {
		throw notFound("Case");
	}
	return { userId, caseId };
}

/**
 * POST /api/cases/[id]/assistant
 *
 * Streams the case assistant's reply. Order matters: session, plugin
 * enablement, case VIEW permission, and only then the body is read. A missing
 * case and a case the user cannot view are both 404.
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId, caseId } = await authorise(params);

		const body = await parseJsonBody(request, bodySchema, {
			maxBytes: MAX_BODY_BYTES,
		});

		const [resolved, selection] = await Promise.all([
			resolveChatModel(userId),
			resolveSelectedElement(userId, caseId, body.selectedElementId),
		]);
		if ("error" in resolved) {
			throw new AppError({ code: "CONFLICT", message: resolved.error });
		}

		// The limit covers the whole reply, tool calls included; tools get the
		// moment it ends so that they can keep their own waits inside it.
		const timeoutMs = modelTimeoutMs();
		const replyDeadline = Date.now() + timeoutMs;
		const tools = createCaseTools(
			userId,
			caseId,
			selection,
			replyDeadline,
			modelAccessFor(userId)
		);
		const result = streamText({
			model: resolved.model,
			system:
				buildSystemPrompt(Object.keys(tools)) +
				selectionPrompt(selection) +
				techniquesPrompt(),
			messages: await modelHistory(body.messages as UIMessage[]),
			tools,
			// Files never reach the model call through the schema above; this
			// keeps the SDK from fetching a URL itself should one get through.
			experimental_download: noDownload,
			stopWhen: stepCountIs(MAX_STEPS),
			abortSignal: request.signal,
			timeout: timeoutMs,
			maxOutputTokens: MAX_OUTPUT_TOKENS,
			providerOptions: resolved.providerOptions,
			maxRetries: MAX_RETRIES,
			// Replaces the SDK's default console logging, which prints the whole
			// request (prompt, history, case trees) with the provider error.
			onError: ({ error }) => {
				log.error("Assistant stream failed", describeStreamError(error));
			},
		});

		// The provider's own message is shown to the user, cleaned of the key and
		// address; it is not logged (see `onError` above).
		return createUIMessageStreamResponse({
			stream: result
				.toUIMessageStream({
					onError: (error) => providerErrorMessage(error, resolved.secrets),
				})
				.pipeThrough(replyNotices(MAX_STEPS)),
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * GET /api/cases/[id]/assistant
 *
 * The names of the tools the assistant has for this case, so the chat panel can
 * offer prompts that match them. The checks are the same as for POST, and a
 * missing case and a case the user cannot view are both 404. It is a helper for
 * the panel, not an integration point.
 *
 * @ignore
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId, caseId } = await authorise(params);
		return apiSuccess({ tools: Object.keys(createCaseTools(userId, caseId)) });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
