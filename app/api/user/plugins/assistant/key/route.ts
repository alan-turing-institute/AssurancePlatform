import { z } from "zod";
import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { TokenEncryptionUnavailableError } from "@/lib/auth/token-encryption";
import { AppError } from "@/lib/errors";
import {
	deleteUserApiKey,
	hasUserApiKey,
	writeUserApiKey,
} from "@/lib/plugins/assistant/key-store";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";

const PLUGIN_ID = "tea.assistant";
const KEY_BODY_MAX_BYTES = 4 * 1024;

const putKeySchema = z.strictObject({
	key: z
		.string({ message: "key must be a string" })
		.trim()
		.min(1, "key is required")
		.max(2048, "key must be less than 2048 characters"),
});

const ENCRYPTION_UNAVAILABLE_MESSAGE =
	"This server cannot store keys: token encryption is not configured.";

/** Authenticates, then refuses unless the assistant plugin is on for the user. */
async function authorise(): Promise<string | Response> {
	const userId = await requireAuth();
	const enabled = await assertPluginEnabledForUser(PLUGIN_ID, userId);
	if ("error" in enabled) {
		return apiError(serviceErrorToAppError(enabled.error));
	}
	return userId;
}

/** GET /api/user/plugins/assistant/key — whether a key is stored; never the key. */
export async function GET() {
	try {
		const userId = await authorise();
		if (typeof userId !== "string") {
			return userId;
		}
		return apiSuccess({ hasKey: await hasUserApiKey(userId) });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/** PUT /api/user/plugins/assistant/key — stores or replaces the key (write-only). */
export async function PUT(req: Request) {
	try {
		const userId = await authorise();
		if (typeof userId !== "string") {
			return userId;
		}
		const { key } = await parseJsonBody(req, putKeySchema, {
			maxBytes: KEY_BODY_MAX_BYTES,
		});
		await writeUserApiKey(userId, key);
		return apiSuccess({ hasKey: true });
	} catch (error) {
		if (error instanceof TokenEncryptionUnavailableError) {
			return apiError(
				new AppError({
					code: "SERVICE_UNAVAILABLE",
					message: ENCRYPTION_UNAVAILABLE_MESSAGE,
				})
			);
		}
		return apiErrorFromUnknown(error);
	}
}

/** DELETE /api/user/plugins/assistant/key — removes the stored key. */
export async function DELETE() {
	try {
		// Auth only: a user who has turned the plugin off can still remove their secret.
		const userId = await requireAuth();
		await deleteUserApiKey(userId);
		return apiSuccess({ hasKey: false });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
