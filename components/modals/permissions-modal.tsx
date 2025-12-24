"use client";

import {
	Eye,
	MessageCircleMore,
	PencilRuler,
	Trash2,
	User2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import useStore from "@/data/store";
import { usePermissionsModal } from "@/hooks/use-permissions-modal";

type Member = {
	id: number | string;
	email: string;
	username: string;
	permissionId?: string;
};

import { useToast } from "@/lib/toast";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

export const PermissionsModal = () => {
	const {
		assuranceCase,
		viewMembers,
		setViewMembers,
		editMembers,
		setEditMembers,
		reviewMembers,
		setReviewMembers,
	} = useStore();
	const permissionModal = usePermissionsModal();

	const [adminMembers, setAdminMembers] = useState<Member[]>([]);
	const [_loading, setLoading] = useState(false);

	const params = useParams();
	const router = useRouter();
	const { caseId } = params;

	const { toast } = useToast();

	const fetchCaseMembers = useCallback(async () => {
		// Use Next.js API route which handles Prisma auth
		const response = await fetch(`/api/cases/${caseId}/permissions`);

		if (response.status === 401) {
			router.replace("/login");
			return null;
		}

		if (!response.ok) {
			return null;
		}

		const result = await response.json();
		return result;
	}, [caseId, router]);

	const handleRemovePermissions = async (member: Member, level: string) => {
		if (!member.permissionId) {
			toast({
				variant: "destructive",
				title: "Error",
				description: "Cannot remove permission - no permission ID",
			});
			return;
		}

		try {
			setLoading(true);

			// Use Next.js API route for revoking permissions
			const response = await fetch(
				`/api/cases/${caseId}/permissions/${member.permissionId}?type=user`,
				{ method: "DELETE" }
			);

			if (!response.ok) {
				toast({
					variant: "destructive",
					title: "Error",
					description: "Something went wrong",
				});
				setLoading(false);
				return;
			}

			// Update local state based on permission level
			if (level === "VIEW") {
				setViewMembers(viewMembers.filter((m) => m.email !== member.email));
			} else if (level === "EDIT") {
				setEditMembers(editMembers.filter((m) => m.email !== member.email));
			} else if (level === "COMMENT") {
				setReviewMembers(reviewMembers.filter((m) => m.email !== member.email));
			} else if (level === "ADMIN") {
				setAdminMembers(adminMembers.filter((m) => m.email !== member.email));
			}
		} catch (_err) {
			toast({
				variant: "destructive",
				title: "Error",
				description: "Something went wrong",
			});
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (assuranceCase && assuranceCase.permissions === "manage") {
			fetchCaseMembers().then((result) => {
				if (result?.user_permissions) {
					// Map Prisma permission levels to UI categories
					const view: Member[] = [];
					const edit: Member[] = [];
					const comment: Member[] = [];
					const admin: Member[] = [];

					for (const perm of result.user_permissions) {
						const member: Member = {
							id: perm.user.id,
							email: perm.user.email,
							username: perm.user.username,
							permissionId: perm.id,
						};

						switch (perm.permission) {
							case "VIEW":
								view.push(member);
								break;
							case "EDIT":
								edit.push(member);
								break;
							case "COMMENT":
								comment.push(member);
								break;
							case "ADMIN":
								admin.push(member);
								break;
							default:
								break;
						}
					}

					setViewMembers(view);
					setEditMembers(edit);
					setReviewMembers(comment);
					setAdminMembers(admin);
				}
			});
		}
	}, [
		assuranceCase,
		fetchCaseMembers,
		setEditMembers,
		setReviewMembers,
		setViewMembers,
	]);

	return (
		<Modal
			description="Manage who has access to the current assurance case."
			isOpen={permissionModal.isOpen}
			onClose={permissionModal.onClose}
			title="Permissions"
		>
			<p className="mb-2 flex items-center justify-start gap-2 text-slate-300 text-xs uppercase">
				<PencilRuler className="h-4 w-4" />
				Edit members
			</p>
			<Separator />

			<div className="my-4">
				{editMembers.length > 0 ? (
					editMembers.map((member: Member) => (
						<div
							className="group flex items-center justify-start gap-4 rounded-md p-1 px-3 hover:cursor-pointer"
							key={member.id}
						>
							<User2 className="h-4 w-4" />
							<div className="flex-1">
								<p>{member.email}</p>
							</div>
							<Button
								className="hover:bg-rose-500 hover:text-white dark:hover:bg-rose-700/50"
								onClick={() => handleRemovePermissions(member, "EDIT")}
								size={"icon"}
								title="Remove edit access"
								variant={"ghost"}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					))
				) : (
					<p className="text-muted-foreground text-sm">No members found.</p>
				)}
			</div>

			<p className="mb-2 flex items-center justify-start gap-2 text-slate-300 text-xs uppercase">
				<MessageCircleMore className="h-4 w-4" />
				Review members
			</p>
			<Separator />

			<div className="my-4">
				{reviewMembers.length > 0 ? (
					reviewMembers.map((member: Member) => (
						<div
							className="group flex items-center justify-start gap-4 rounded-md p-1 px-3 hover:cursor-pointer"
							key={member.id}
						>
							<User2 className="h-4 w-4" />
							<div className="flex-1">
								<p>{member.email}</p>
							</div>
							<Button
								className="hover:bg-rose-500 hover:text-white dark:hover:bg-rose-700/50"
								onClick={() => handleRemovePermissions(member, "COMMENT")}
								size={"icon"}
								title="Remove review access"
								variant={"ghost"}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					))
				) : (
					<p className="text-muted-foreground text-sm">No members found.</p>
				)}
			</div>

			<p className="mb-2 flex items-center justify-start gap-2 text-slate-300 text-xs uppercase">
				<Eye className="h-4 w-4" />
				View members
			</p>
			<Separator />

			<div className="my-4">
				{viewMembers.length > 0 ? (
					viewMembers.map((member: Member) => (
						<div
							className="group flex items-center justify-start gap-4 rounded-md p-1 px-3 hover:cursor-pointer"
							key={member.id}
						>
							<User2 className="h-4 w-4" />
							<div className="flex-1">
								<p>{member.email}</p>
							</div>
							<Button
								className="hover:bg-rose-500 hover:text-white dark:hover:bg-rose-700/50"
								onClick={() => handleRemovePermissions(member, "VIEW")}
								size={"icon"}
								title="Remove view access"
								variant={"ghost"}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					))
				) : (
					<p className="text-muted-foreground text-sm">No members found.</p>
				)}
			</div>
		</Modal>
	);
};
