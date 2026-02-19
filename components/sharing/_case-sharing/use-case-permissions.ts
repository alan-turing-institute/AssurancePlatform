import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import type {
	Team,
	TeamPermission,
	UserPermission,
} from "./permission-components";

export const PERMISSION_LEVELS = ["VIEW", "COMMENT", "EDIT", "ADMIN"] as const;

export const shareFormSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	permission: z.enum(PERMISSION_LEVELS),
});

export type ShareFormValues = z.infer<typeof shareFormSchema>;

export type PermissionsData = {
	userPermissions: UserPermission[];
	teamPermissions: TeamPermission[];
	owner: {
		id: string;
		username: string;
		email: string;
	};
};

type UseCasePermissionsParams = {
	caseId: string | null;
	isOpen: boolean;
	form: UseFormReturn<ShareFormValues>;
};

type UseCasePermissionsResult = {
	loading: boolean;
	permissions: PermissionsData | null;
	userTeams: Team[];
	availableTeams: Team[];
	inviteUrl: string | null;
	copied: boolean;
	error: string | null;
	getInitials: (name: string) => string;
	copyInviteUrl: () => void;
	clearInviteUrl: () => void;
	onShareByEmail: (values: ShareFormValues) => Promise<void>;
	onShareWithTeam: (teamId: string, permission: string) => Promise<void>;
	onUpdatePermission: (
		permissionId: string,
		newPermission: string,
		type: "user" | "team"
	) => Promise<void>;
	onRevokePermission: (
		permissionId: string,
		type: "user" | "team"
	) => Promise<void>;
};

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
			console.error("Failed to fetch permissions:", err);
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
			console.error("Failed to fetch teams:", err);
		}
	}, []);

	useEffect(() => {
		if (isOpen && caseId) {
			fetchPermissions();
			fetchUserTeams();
			setInviteUrl(null);
			setError(null);
		}
	}, [isOpen, caseId, fetchPermissions, fetchUserTeams]);

	const onShareByEmail = async (values: ShareFormValues) => {
		if (!caseId) {
			return;
		}

		setError(null);
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
			} else if (data.message === "User already has access to this case") {
				setError("User already has access to this case");
			} else {
				form.reset();
				fetchPermissions();
				router.refresh();
			}
		} catch (err) {
			setError("An error occurred while sharing");
			console.error(err);
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
			console.error("Failed to share with team:", err);
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
			console.error("Failed to update permission:", err);
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
			console.error("Failed to revoke permission:", err);
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
		getInitials,
		copyInviteUrl,
		clearInviteUrl,
		onShareByEmail,
		onShareWithTeam,
		onUpdatePermission,
		onRevokePermission,
	};
}
