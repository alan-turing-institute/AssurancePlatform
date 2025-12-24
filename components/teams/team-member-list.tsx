"use client";

import { MoreVertical, Shield, ShieldCheck, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { AlertModal } from "@/components/modals/alert-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInviteMemberModal } from "@/hooks/use-invite-member-modal";

type TeamMember = {
	id: string;
	role: string;
	user: {
		id: string;
		username: string;
		email: string;
	};
};

type TeamMemberListProps = {
	teamId: string;
	members: TeamMember[];
	currentUserRole: string;
	currentUserId: string;
};

export function TeamMemberList({
	teamId,
	members,
	currentUserRole,
	currentUserId,
}: TeamMemberListProps) {
	const { data: session } = useSession();
	const router = useRouter();
	const inviteMemberModal = useInviteMemberModal();

	const [removeModalOpen, setRemoveModalOpen] = useState(false);
	const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
	const [loading, setLoading] = useState(false);

	const isAdmin = currentUserRole === "ADMIN" || currentUserRole === "OWNER";

	const handleRemoveMember = async () => {
		// Check user.id for JWT-only mode compatibility (key may not exist in JWT-only mode)
		if (!(memberToRemove && session?.user?.id)) {
			return;
		}

		setLoading(true);
		try {
			const response = await fetch(
				`/api/teams/${teamId}/members/${memberToRemove.user.id}`,
				{
					method: "DELETE",
				}
			);

			if (response.ok) {
				router.refresh();
			}
		} finally {
			setLoading(false);
			setRemoveModalOpen(false);
			setMemberToRemove(null);
		}
	};

	const handleChangeRole = async (memberId: string, newRole: string) => {
		try {
			const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ role: newRole }),
			});

			if (response.ok) {
				router.refresh();
			}
		} catch (error) {
			console.error("Failed to update role:", error);
		}
	};

	const getInitials = (username: string) =>
		username
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);

	return (
		<>
			<div className="rounded-lg border bg-card">
				<div className="flex items-center justify-between border-b p-4">
					<div>
						<h3 className="font-semibold text-lg">Team Members</h3>
						<p className="text-muted-foreground text-sm">
							{members.length} {members.length === 1 ? "member" : "members"}
						</p>
					</div>
					{isAdmin && (
						<Button onClick={() => inviteMemberModal.onOpen(teamId)} size="sm">
							Add Member
						</Button>
					)}
				</div>
				<div className="divide-y">
					{members.map((member) => {
						const isCurrentUser = member.user.id === currentUserId;
						const canManage = isAdmin && !isCurrentUser;

						return (
							<div
								className="flex items-center justify-between p-4"
								key={member.id}
							>
								<div className="flex items-center gap-3">
									<Avatar>
										<AvatarImage
											alt={member.user.username}
											src={`https://avatar.vercel.sh/${member.user.email}`}
										/>
										<AvatarFallback>
											{getInitials(member.user.username)}
										</AvatarFallback>
									</Avatar>
									<div>
										<p className="font-medium">
											{member.user.username}
											{isCurrentUser && (
												<span className="ml-2 text-muted-foreground text-sm">
													(you)
												</span>
											)}
										</p>
										<p className="text-muted-foreground text-sm">
											{member.user.email}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<span
										className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
											member.role === "ADMIN" || member.role === "OWNER"
												? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
												: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
										}`}
									>
										{member.role === "ADMIN" || member.role === "OWNER" ? (
											<ShieldCheck className="h-3 w-3" />
										) : (
											<Shield className="h-3 w-3" />
										)}
										{member.role}
									</span>
									{canManage && (
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													size="icon"
													title="More options"
													variant="ghost"
												>
													<MoreVertical className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												{member.role === "MEMBER" ? (
													<DropdownMenuItem
														onClick={() =>
															handleChangeRole(member.user.id, "ADMIN")
														}
													>
														<ShieldCheck className="mr-2 h-4 w-4" />
														Make Admin
													</DropdownMenuItem>
												) : (
													<DropdownMenuItem
														onClick={() =>
															handleChangeRole(member.user.id, "MEMBER")
														}
													>
														<Shield className="mr-2 h-4 w-4" />
														Remove Admin
													</DropdownMenuItem>
												)}
												<DropdownMenuSeparator />
												<DropdownMenuItem
													className="text-destructive"
													onClick={() => {
														setMemberToRemove(member);
														setRemoveModalOpen(true);
													}}
												>
													<UserMinus className="mr-2 h-4 w-4" />
													Remove from Team
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
			<AlertModal
				confirmButtonText="Remove"
				isOpen={removeModalOpen}
				loading={loading}
				onClose={() => {
					setRemoveModalOpen(false);
					setMemberToRemove(null);
				}}
				onConfirm={handleRemoveMember}
			/>
		</>
	);
}
