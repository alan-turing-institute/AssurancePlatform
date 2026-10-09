import {
	convertToModelMessages,
	stepCountIs,
	streamText,
	type UIMessage,
} from "ai";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api-request";
import { apiErrorFromUnknown, requireAuth } from "@/lib/api-response";
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
	buildSystemPrompt,
	createCaseTools,
} from "@/lib/plugins/assistant/tools";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";

const log = logger.child({ component: "assistant-route" });

/** Chat history carries earlier tool results (whole case trees), so the cap is generous. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_MESSAGES = 100;
const MAX_STEPS = 8;
/** Bounds on one model call: tokens written and provider retries (wall time: ASSISTANT_MODEL_TIMEOUT_MS). */
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
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const enabled = await assertPluginEnabledForUser(
			ASSISTANT_PLUGIN_ID,
			userId
		);
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

		const body = await parseJsonBody(request, bodySchema, {
			maxBytes: MAX_BODY_BYTES,
		});

		const resolved = await resolveProviderConfig(userId);
		if ("error" in resolved) {
			throw new AppError({ code: "CONFLICT", message: resolved.error });
		}

		const selection = body.selectedElementId
			? `\n\nThe user currently has the element with id ${body.selectedElementId} selected on the canvas.`
			: "";

		const tools = createCaseTools(userId, caseId);
		const result = streamText({
			model: createAssistantModel(resolved.config),
			system: buildSystemPrompt(Object.keys(tools)) + selection,
			messages: await convertToModelMessages(body.messages as UIMessage[]),
			tools,
			stopWhen: stepCountIs(MAX_STEPS),
			abortSignal: request.signal,
			timeout: modelTimeoutMs(),
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
