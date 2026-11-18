import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { logger } from "@/lib/logger";
import type { ShareByEmailSchemaInput } from "@/lib/schemas/permission";
import { toastError } from "@/lib/toast";
import type {
	Team,
	TeamPermission,
	UserPermission,
} from "./permission-components";
import { useSharedItemName } from "./shared-item-name";

const log = logger.child({ component: "use-case-permissions" });

export { shareByEmailSchema as shareFormSchema } from "@/lib/schemas/permission";
export type ShareFormValues = ShareByEmailSchemaInput;

export const PERMISSION_LEVELS = ["VIEW", "COMMENT", "EDIT", "ADMIN"] as const;

export interface PermissionsData {
	owner: {
		id: string;
		username: string;
		email: string;
	};
	teamPermissions: TeamPermission[];
	userPermissions: UserPermission[];
}

const ALREADY_HAS_ACCESS = "User already has access to this case";

const LEVEL_LABELS: Record<string, string> = {
	VIEW: "Can view",
	COMMENT: "Can comment",
	EDIT: "Can edit",
	ADMIN: "Admin",
};

/**
 * Words the answer to sharing with someone who already has access, from the
 * permissions the dialog has loaded. Returns null when the email matches
 * nobody on the list.
 */
function describeExistingAccess(
	permissions: PermissionsData | null,
	email: string,
	itemName: string
): string | null {
	const typed = email.trim().toLowerCase();
	if (!(permissions && typed)) {
		return null;
	}
	if (permissions.owner.email.toLowerCase() === typed) {
		return `${permissions.owner.username} owns this ${itemName}.`;
	}
	const held = permissions.userPermissions.find(
		(up) => up.user.email.toLowerCase() === typed
	);
	if (!held) {
		return null;
	}
	const label = LEVEL_LABELS[held.permission] ?? held.permission;
	return `${held.user.username} already has access (${label}). To change it, use the menu beside their name below.`;
}

interface UseCasePermissionsParams {
	caseId: string | null;
	form: UseFormReturn<ShareFormValues>;
	isOpen: boolean;
}

interface UseCasePermissionsResult {
	availableTeams: Team[];
	clearInviteUrl: () => void;
	copied: boolean;
	copyInviteUrl: () => void;
	error: string | null;
	getInitials: (name: string) => string;
	inviteUrl: string | null;
	loading: boolean;
	notice: string | null;
	onRevokePermission: (
		permissionId: string,
		type: "user" | "team"
	) => Promise<void>;
	onShareByEmail: (values: ShareFormValues) => Promise<void>;
	onShareWithTeam: (teamId: string, permission: string) => Promise<void>;
	onUpdatePermission: (
		permissionId: string,
		newPermission: string,
		type: "user" | "team"
	) => Promise<void>;
	permissions: PermissionsData | null;
	userTeams: Team[];
}

export function useCasePermissions({
	caseId,
	isOpen,
	form,
}: UseCasePermissionsParams): UseCasePermissionsResult {
	const router = useRouter();

	const [loading, setLoading] = useState(false);
	const [permissions, setPermissions] = useState<PermissionsData | null>(null);
	const [userTeams, setUserTeams] = useState<Team[]>([]);
	const [inviteUrl, setInviteUrl] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const itemName = useSharedItemName();

	const fetchPermissions = useCallback(async () => {
		if (!caseId) {
			return;
		}

		setLoading(true);
		try {
			const response = await fetch(`/api/cases/${caseId}/permissions`);
			if (response.ok) {
				const data = await response.json();
				// Transform snake_case API response to camelCase
				setPermissions({
					userPermissions: data.user_permissions ?? [],
					teamPermissions: data.team_permissions ?? [],
					owner: data.owner,
				});
			}
		} catch (err) {
			log.error("Failed to fetch permissions", { error: err });
			setError("Failed to load permissions");
			toastError("Failed to load permissions");
		} finally {
			setLoading(false);
		}
	}, [caseId]);

	const fetchUserTeams = useCallback(async () => {
		try {
			const response = await fetch("/api/teams");
			if (response.ok) {
				const data = await response.json();
				setUserTeams(data);
			}
		} catch (err) {
			log.error("Failed to fetch teams", { error: err });
			setError("Failed to load teams");
			toastError("Failed to load teams");
		}
	}, []);

	useEffect(() => {
		if (isOpen && caseId) {
			fetchPermissions();
			fetchUserTeams();
			setInviteUrl(null);
			setError(null);
			setNotice(null);
		}
	}, [isOpen, caseId, fetchPermissions, fetchUserTeams]);

	const onShareByEmail = async (values: ShareFormValues) => {
		if (!caseId) {
			return;
		}

		setError(null);
		setNotice(null);
		setInviteUrl(null);

		try {
			const response = await fetch(`/api/cases/${caseId}/permissions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "user",
					email: values.email,
					permission: values.permission,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				setError(data.error || "Failed to share case");
				return;
			}

			if (data.invite_url) {
				setInviteUrl(data.invite_url);
			} else if (data.message === ALREADY_HAS_ACCESS) {
				const existing = describeExistingAccess(
					permissions,
					values.email,
					itemName
				);
				if (existing) {
					setNotice(existing);
				} else {
					setError(ALREADY_HAS_ACCESS);
				}
			} else {
				form.reset();
				fetchPermissions();
				router.refresh();
			}
		} catch (err) {
			setError("An error occurred while sharing");
			log.error("Failed to share case by email", { error: err });
		}
	};

	const onShareWithTeam = async (teamId: string, permission: string) => {
		if (!caseId) {
			return;
		}

		try {
			const response = await fetch(`/api/cases/${caseId}/permissions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "team",
					teamId,
					permission,
				}),
			});

			if (response.ok) {
				fetchPermissions();
				router.refresh();
			}
		} catch (err) {
			log.error("Failed to share with team", { error: err });
			toastError("Failed to share with team");
		}
	};

	const onUpdatePermission = async (
		permissionId: string,
		newPermission: string,
		type: "user" | "team"
	) => {
		if (!caseId) {
			return;
		}

		try {
			const response = await fetch(
				`/api/cases/${caseId}/permissions/${permissionId}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ permission: newPermission, type }),
				}
			);

			if (response.ok) {
				fetchPermissions();
				router.refresh();
			}
		} catch (err) {
			log.error("Failed to update permission", { error: err });
			toastError("Failed to update permission");
		}
	};

	const onRevokePermission = async (
		permissionId: string,
		type: "user" | "team"
	) => {
		if (!caseId) {
			return;
		}

		try {
			const response = await fetch(
				`/api/cases/${caseId}/permissions/${permissionId}?type=${type}`,
				{ method: "DELETE" }
			);

			if (response.ok) {
				fetchPermissions();
				router.refresh();
			}
		} catch (err) {
			log.error("Failed to revoke permission", { error: err });
			toastError("Failed to revoke permission");
		}
	};

	const copyInviteUrl = () => {
		if (inviteUrl) {
			navigator.clipboard.writeText(inviteUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const clearInviteUrl = () => {
		setInviteUrl(null);
		form.reset();
	};

	const getInitials = (name: string) =>
		name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);

	// Teams not already shared with this case
	const availableTeams = userTeams.filter(
		(team) =>
			!permissions?.teamPermissions?.some((tp) => tp.team.id === team.id)
	);

	return {
		loading,
		permissions,
		userTeams,
		availableTeams,
		inviteUrl,
		copied,
		error,
		notice,
		getInitials,
		copyInviteUrl,
		clearInviteUrl,
		onShareByEmail,
		onShareWithTeam,
		onUpdatePermission,
		onRevokePermission,
	};
}
