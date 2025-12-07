"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader, MoreVertical, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCaseSharingModal } from "@/hooks/use-case-sharing-modal";

const PERMISSION_LEVELS = ["VIEW", "COMMENT", "EDIT", "ADMIN"] as const;

const shareFormSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	permission: z.enum(PERMISSION_LEVELS),
});

type ShareFormValues = z.infer<typeof shareFormSchema>;

type UserPermission = {
	id: string;
	permission: string;
	user: {
		id: string;
		username: string;
		email: string;
	};
};

type TeamPermission = {
	id: string;
	permission: string;
	team: {
		id: string;
		name: string;
		slug: string;
	};
};

type PermissionsData = {
	userPermissions: UserPermission[];
	teamPermissions: TeamPermission[];
	owner: {
		id: string;
		username: string;
		email: string;
	};
};

type Team = {
	id: string;
	name: string;
	slug: string;
};

function PermissionSelect({
	value,
	onValueChange,
	className,
}: {
	value: string;
	onValueChange: (value: string) => void;
	className?: string;
}) {
	return (
		<Select defaultValue={value} onValueChange={onValueChange}>
			<SelectTrigger className={className ?? "h-8 w-28 text-xs"}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="VIEW">Can view</SelectItem>
				<SelectItem value="COMMENT">Can comment</SelectItem>
				<SelectItem value="EDIT">Can edit</SelectItem>
				<SelectItem value="ADMIN">Admin</SelectItem>
			</SelectContent>
		</Select>
	);
}

function UserPermissionRow({
	permission,
	onUpdate,
	onRevoke,
	getInitials,
}: {
	permission: UserPermission;
	onUpdate: (permissionId: string, newPermission: string) => void;
	onRevoke: (permissionId: string) => void;
	getInitials: (name: string) => string;
}) {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-3">
				<Avatar className="h-8 w-8">
					<AvatarImage
						alt={permission.user.username}
						src={`https://avatar.vercel.sh/${permission.user.email}`}
					/>
					<AvatarFallback>
						{getInitials(permission.user.username)}
					</AvatarFallback>
				</Avatar>
				<div>
					<p className="font-medium text-sm">{permission.user.username}</p>
					<p className="text-muted-foreground text-xs">
						{permission.user.email}
					</p>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<PermissionSelect
					onValueChange={(value) => onUpdate(permission.id, value)}
					value={permission.permission}
				/>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="h-8 w-8"
							size="icon"
							title="More options"
							variant="ghost"
						>
							<MoreVertical className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							className="text-destructive"
							onClick={() => onRevoke(permission.id)}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Remove access
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

function TeamPermissionRow({
	permission,
	onUpdate,
	onRevoke,
}: {
	permission: TeamPermission;
	onUpdate: (permissionId: string, newPermission: string) => void;
	onRevoke: (permissionId: string) => void;
}) {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-3">
				<div className="flex h-8 w-8 items-center justify-center rounded bg-indigo-500 font-medium text-sm text-white">
					<Users className="h-4 w-4" />
				</div>
				<div>
					<p className="font-medium text-sm">{permission.team.name}</p>
					<p className="text-muted-foreground text-xs">Team</p>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<PermissionSelect
					onValueChange={(value) => onUpdate(permission.id, value)}
					value={permission.permission}
				/>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="h-8 w-8"
							size="icon"
							title="More options"
							variant="ghost"
						>
							<MoreVertical className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							className="text-destructive"
							onClick={() => onRevoke(permission.id)}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Remove access
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

function AvailableTeamsList({
	teams,
	userTeamsCount,
	onShareWithTeam,
}: {
	teams: Team[];
	userTeamsCount: number;
	onShareWithTeam: (teamId: string, permission: string) => void;
}) {
	if (teams.length === 0) {
		return (
			<p className="py-4 text-center text-muted-foreground text-sm">
				{userTeamsCount === 0
					? "You are not a member of any teams"
					: "This case is already shared with all your teams"}
			</p>
		);
	}

	return (
		<div className="space-y-2">
			{teams.map((team) => (
				<div
					className="flex items-center justify-between rounded-md border p-3"
					key={team.id}
				>
					<div className="flex items-center gap-2">
						<div className="flex h-8 w-8 items-center justify-center rounded bg-indigo-500 font-medium text-sm text-white">
							{team.name.charAt(0).toUpperCase()}
						</div>
						<span>{team.name}</span>
					</div>
					<Select onValueChange={(value) => onShareWithTeam(team.id, value)}>
						<SelectTrigger className="w-32">
							<SelectValue placeholder="Share" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="VIEW">Can view</SelectItem>
							<SelectItem value="COMMENT">Can comment</SelectItem>
							<SelectItem value="EDIT">Can edit</SelectItem>
							<SelectItem value="ADMIN">Admin</SelectItem>
						</SelectContent>
					</Select>
				</div>
			))}
		</div>
	);
}

export function CaseSharingDialog() {
	const sharingModal = useCaseSharingModal();
	const router = useRouter();

	const [loading, setLoading] = useState(false);
	const [permissions, setPermissions] = useState<PermissionsData | null>(null);
	const [userTeams, setUserTeams] = useState<Team[]>([]);
	const [inviteUrl, setInviteUrl] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const form = useForm<ShareFormValues>({
		resolver: zodResolver(shareFormSchema),
		defaultValues: {
			email: "",
			permission: "VIEW",
		},
	});

	const fetchPermissions = useCallback(async () => {
		if (!sharingModal.caseId) {
			return;
		}

		setLoading(true);
		try {
			const response = await fetch(
				`/api/cases/${sharingModal.caseId}/permissions`
			);
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
	}, [sharingModal.caseId]);

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
		if (sharingModal.isOpen && sharingModal.caseId) {
			fetchPermissions();
			fetchUserTeams();
			setInviteUrl(null);
			setError(null);
		}
	}, [
		sharingModal.isOpen,
		sharingModal.caseId,
		fetchPermissions,
		fetchUserTeams,
	]);

	const onShareByEmail = async (values: ShareFormValues) => {
		if (!sharingModal.caseId) {
			return;
		}

		setError(null);
		setInviteUrl(null);

		try {
			const response = await fetch(
				`/api/cases/${sharingModal.caseId}/permissions`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: "user",
						email: values.email,
						permission: values.permission,
					}),
				}
			);

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
		if (!sharingModal.caseId) {
			return;
		}

		try {
			const response = await fetch(
				`/api/cases/${sharingModal.caseId}/permissions`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: "team",
						teamId,
						permission,
					}),
				}
			);

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
		if (!sharingModal.caseId) {
			return;
		}

		try {
			const response = await fetch(
				`/api/cases/${sharingModal.caseId}/permissions/${permissionId}`,
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
		if (!sharingModal.caseId) {
			return;
		}

		try {
			const response = await fetch(
				`/api/cases/${sharingModal.caseId}/permissions/${permissionId}?type=${type}`,
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

	const getInitials = (name: string) =>
		name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);

	const _getPermissionLabel = (permission: string) => {
		switch (permission) {
			case "VIEW":
				return "Can view";
			case "COMMENT":
				return "Can comment";
			case "EDIT":
				return "Can edit";
			case "ADMIN":
				return "Admin";
			default:
				return permission;
		}
	};

	// Get teams not already shared with
	const availableTeams = userTeams.filter(
		(team) =>
			!permissions?.teamPermissions?.some((tp) => tp.team.id === team.id)
	);

	return (
		<Dialog
			onOpenChange={() => sharingModal.onClose()}
			open={sharingModal.isOpen}
		>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Share Case</DialogTitle>
					<DialogDescription>
						Share this case with individuals or teams
					</DialogDescription>
				</DialogHeader>

				{loading ? (
					<div className="flex items-center justify-center py-8">
						<Loader className="h-8 w-8 animate-spin" />
					</div>
				) : (
					<Tabs className="w-full" defaultValue="email">
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="email">Share by Email</TabsTrigger>
							<TabsTrigger value="team">Share with Team</TabsTrigger>
						</TabsList>

						<TabsContent className="space-y-4" value="email">
							{error && (
								<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
									{error}
								</div>
							)}

							{inviteUrl ? (
								<div className="space-y-3">
									<p className="text-muted-foreground text-sm">
										User not found. Share this invite link with them:
									</p>
									<div className="flex gap-2">
										<Input readOnly value={inviteUrl} />
										<Button
											onClick={copyInviteUrl}
											size="icon"
											title={copied ? "Copied" : "Copy invite link"}
											variant="outline"
										>
											{copied ? (
												<Check className="h-4 w-4" />
											) : (
												<Copy className="h-4 w-4" />
											)}
										</Button>
									</div>
									<Button
										className="w-full"
										onClick={() => {
											setInviteUrl(null);
											form.reset();
										}}
										variant="outline"
									>
										Share with someone else
									</Button>
								</div>
							) : (
								<Form {...form}>
									<form
										className="space-y-4"
										onSubmit={form.handleSubmit(onShareByEmail)}
									>
										<FormField
											control={form.control}
											name="email"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Email Address</FormLabel>
													<FormControl>
														<Input
															placeholder="colleague@example.com"
															type="email"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="permission"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Permission Level</FormLabel>
													<Select
														defaultValue={field.value}
														onValueChange={field.onChange}
													>
														<FormControl>
															<SelectTrigger>
																<SelectValue />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															<SelectItem value="VIEW">Can view</SelectItem>
															<SelectItem value="COMMENT">
																Can comment
															</SelectItem>
															<SelectItem value="EDIT">Can edit</SelectItem>
															<SelectItem value="ADMIN">Admin</SelectItem>
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>
										<Button className="w-full" type="submit">
											Share
										</Button>
									</form>
								</Form>
							)}
						</TabsContent>

						<TabsContent className="space-y-4" value="team">
							<AvailableTeamsList
								onShareWithTeam={onShareWithTeam}
								teams={availableTeams}
								userTeamsCount={userTeams.length}
							/>
						</TabsContent>
					</Tabs>
				)}

				{permissions && (
					<>
						<Separator />
						<div className="space-y-3">
							<h4 className="font-medium text-sm">People with access</h4>

							{/* Owner */}
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<Avatar className="h-8 w-8">
										<AvatarImage
											alt={permissions.owner.username}
											src={`https://avatar.vercel.sh/${permissions.owner.email}`}
										/>
										<AvatarFallback>
											{getInitials(permissions.owner.username)}
										</AvatarFallback>
									</Avatar>
									<div>
										<p className="font-medium text-sm">
											{permissions.owner.username}
										</p>
										<p className="text-muted-foreground text-xs">
											{permissions.owner.email}
										</p>
									</div>
								</div>
								<span className="text-muted-foreground text-sm">Owner</span>
							</div>

							{/* User permissions */}
							{permissions.userPermissions.map((up) => (
								<UserPermissionRow
									getInitials={getInitials}
									key={up.id}
									onRevoke={(id) => onRevokePermission(id, "user")}
									onUpdate={(id, value) =>
										onUpdatePermission(id, value, "user")
									}
									permission={up}
								/>
							))}

							{/* Team permissions */}
							{permissions.teamPermissions.length > 0 && (
								<>
									<h4 className="mt-4 font-medium text-sm">
										Teams with access
									</h4>
									{permissions.teamPermissions.map((tp) => (
										<TeamPermissionRow
											key={tp.id}
											onRevoke={(id) => onRevokePermission(id, "team")}
											onUpdate={(id, value) =>
												onUpdatePermission(id, value, "team")
											}
											permission={tp}
										/>
									))}
								</>
							)}
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
