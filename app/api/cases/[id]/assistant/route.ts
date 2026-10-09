import {
	convertToModelMessages,
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
import { createAssistantModel } from "@/lib/plugins/assistant/model";
import { modelTimeoutMs } from "@/lib/plugins/assistant/model-timeout";
import {
	ASSISTANT_PLUGIN_ID,
	resolveProviderConfig,
} from "@/lib/plugins/assistant/provider-config";
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
/** Bounds on one model call: tokens written and provider retries. The wall time of the whole reply is ASSISTANT_MODEL_TIMEOUT_MS. */
const MAX_OUTPUT_TOKENS = 2048;
const MAX_RETRIES = 1;

const messageSchema = z.looseObject({
	id: z.string().max(200),
	role: z.enum(["user", "assistant"]),
	parts: z.array(z.unknown()).max(200),
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
			resolveProviderConfig(userId),
			resolveSelectedElement(userId, caseId, body.selectedElementId),
		]);
		if ("error" in resolved) {
			throw new AppError({ code: "CONFLICT", message: resolved.error });
		}

		// The limit covers the whole reply, tool calls included; tools get the
		// moment it ends so that they can keep their own waits inside it.
		const timeoutMs = modelTimeoutMs();
		const replyDeadline = Date.now() + timeoutMs;
		const tools = createCaseTools(userId, caseId, selection, replyDeadline);
		const result = streamText({
			model: createAssistantModel(resolved.config),
			system:
				buildSystemPrompt(Object.keys(tools)) +
				selectionPrompt(selection) +
				techniquesPrompt(),
			messages: await convertToModelMessages(body.messages as UIMessage[]),
			tools,
			stopWhen: stepCountIs(MAX_STEPS),
			abortSignal: request.signal,
			timeout: timeoutMs,
			maxOutputTokens: MAX_OUTPUT_TOKENS,
			maxRetries: MAX_RETRIES,
			// Replaces the SDK's default console logging, which prints the whole
			// request (prompt, history, case trees) with the provider error.
			onError: ({ error }) => {
				log.error("Assistant stream failed", { error });
			},
		});

		return result.toUIMessageStreamResponse({
			onError: () => "The model provider returned an error.",
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
