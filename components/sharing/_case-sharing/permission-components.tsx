"use client";

import { MoreVertical, Trash2, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface UserPermission {
	id: string;
	permission: string;
	user: {
		id: string;
		username: string;
		email: string;
	};
}

export interface TeamPermission {
	id: string;
	permission: string;
	team: {
		id: string;
		name: string;
		slug: string;
	};
}

export interface Team {
	id: string;
	name: string;
	slug: string;
}

interface PermissionSelectProps {
	className?: string;
	onValueChange: (value: string) => void;
	value: string;
}

export function PermissionSelect({
	value,
	onValueChange,
	className,
}: PermissionSelectProps) {
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

interface UserPermissionRowProps {
	className?: string;
	getInitials: (name: string) => string;
	onRevoke: (permissionId: string) => void;
	onUpdate: (permissionId: string, newPermission: string) => void;
	permission: UserPermission;
}

export function UserPermissionRow({
	permission,
	onUpdate,
	onRevoke,
	getInitials,
}: UserPermissionRowProps) {
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

interface TeamPermissionRowProps {
	className?: string;
	onRevoke: (permissionId: string) => void;
	onUpdate: (permissionId: string, newPermission: string) => void;
	permission: TeamPermission;
}

export function TeamPermissionRow({
	permission,
	onUpdate,
	onRevoke,
}: TeamPermissionRowProps) {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-3">
				<div className="flex h-8 w-8 items-center justify-center rounded bg-primary font-medium text-primary-foreground text-sm">
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

interface AvailableTeamsListProps {
	className?: string;
	onShareWithTeam: (teamId: string, permission: string) => void;
	teams: Team[];
	userTeamsCount: number;
}

export function AvailableTeamsList({
	teams,
	userTeamsCount,
	onShareWithTeam,
}: AvailableTeamsListProps) {
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
						<div className="flex h-8 w-8 items-center justify-center rounded bg-primary font-medium text-primary-foreground text-sm">
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
