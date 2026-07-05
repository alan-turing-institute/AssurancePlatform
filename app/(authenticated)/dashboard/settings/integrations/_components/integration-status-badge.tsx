import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { IntegrationStatus } from "@/lib/schemas/integration";

const STATUS_VARIANT: Record<IntegrationStatus, BadgeProps["variant"]> = {
	ACTIVE: "default",
	SUSPENDED: "secondary",
	REVOKED: "destructive",
};

const STATUS_LABEL: Record<IntegrationStatus, string> = {
	ACTIVE: "Active",
	SUSPENDED: "Suspended",
	REVOKED: "Revoked",
};

/**
 * An integration's lifecycle status — label text carries the meaning (not
 * colour alone), the badge variant reinforces it.
 */
export function IntegrationStatusBadge({
	status,
}: {
	status: IntegrationStatus;
}) {
	return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
