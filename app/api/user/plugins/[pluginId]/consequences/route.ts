import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { getPluginDisableConsequences } from "@/lib/services/plugin-consequences-service";

/**
 * GET /api/user/plugins/[pluginId]/consequences
 *
 * The off-switch confirmation dialog's data source (TEA — Plugin management
 * surface D3): how much of the session user's own data the plugin holds,
 * and which active integrations are still writing to it. Read-only — never
 * changes enablement state.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ pluginId: string }> }
) {
	try {
		const userId = await requireAuth();
		const { pluginId } = await params;

		const result = await getPluginDisableConsequences(pluginId, userId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
