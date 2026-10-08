import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { listAllowedBaseUrls } from "@/lib/plugins/assistant/allowed-base-urls";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";

/** GET /api/user/plugins/assistant/options — the base URLs the deployment allows. */
export async function GET() {
	try {
		const userId = await requireAuth();
		const enabled = await assertPluginEnabledForUser("tea.assistant", userId);
		if ("error" in enabled) {
			return apiError(serviceErrorToAppError(enabled.error));
		}
		return apiSuccess({ baseUrls: listAllowedBaseUrls() });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
