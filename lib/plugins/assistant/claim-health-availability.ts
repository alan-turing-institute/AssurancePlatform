import { HEALTH_PLUGIN_ID } from "@/lib/services/health-claim-access";
import { caseHasHealthStatus } from "@/lib/services/health-status-service";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";

/**
 * What the assistant can do with claim health for one user and case:
 * `available` when the health plugin is on and a claim in the case has a bound
 * check or a record, `no-results` when the plugin is on and none does, and
 * `plugin-off` when the deployment withholds the plugin or the user has
 * switched it off.
 */
export type ClaimHealthAvailability = "available" | "no-results" | "plugin-off";

/**
 * Whether `read_claim_health` is offered for this case. The caller has
 * already established that `userId` can view the case. The plugin is checked
 * first, so a user who has it off causes no query on the claim tables.
 */
export async function claimHealthAvailability(
	userId: string,
	caseId: string
): Promise<ClaimHealthAvailability> {
	const enabled = await assertPluginEnabledForUser(HEALTH_PLUGIN_ID, userId);
	if ("error" in enabled) {
		return "plugin-off";
	}
	return (await caseHasHealthStatus(caseId)) ? "available" : "no-results";
}
