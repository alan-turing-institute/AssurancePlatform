"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { AlertModal } from "@/components/modals/alert-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

// Minimal user data needed for this form
type UserData = {
	id: number | string;
};

type DeleteFormProps = {
	user: UserData | null | undefined;
};

export const DeleteForm = ({ user }: DeleteFormProps) => {
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
	const [password, setPassword] = useState<string>("");
	const { toast } = useToast();

	const notifyError = (message: string) => {
		toast({
			variant: "destructive",
			title: "Uh oh! Something went wrong.",
			description: message,
		});
	};

	const handleCloseDialog = () => {
		setDeleteOpen(false);
		setPassword("");
	};

	const handleDeleteUser = async () => {
		if (!user) {
			return;
		}

		if (!password) {
			notifyError("Please enter your password to confirm deletion");
			return;
		}

		setDeleteLoading(true);
		try {
			// Use internal Prisma API route
			const response = await fetch("/api/users/me", {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ password }),
			});

			if (!response.ok) {
				const errorData = await response.json();
				notifyError(errorData.error || "Something went wrong");
				setDeleteLoading(false);
				return;
			}

			// Sign out the user after successful deletion
			await signOut({ callbackUrl: "/login" });
		} catch (_error) {
			notifyError("Failed to delete account");
		}
		setDeleteLoading(false);
		handleCloseDialog();
	};

	return (
		<div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
			<div>
				<h2 className="font-semibold text-base text-foreground leading-7">
					Delete account
				</h2>
				<p className="mt-1 text-gray-400 text-sm leading-6">
					No longer want to use our service? You can delete your account here.
					This action is not reversible. All information related to this account
					will be deleted permanently.
				</p>
			</div>

			<form className="flex items-start md:col-span-2">
				<button
					className="rounded-md bg-red-500 px-3 py-2 font-semibold text-sm text-white shadow-xs hover:bg-red-400"
					onClick={(e) => {
						e.preventDefault();
						setDeleteOpen(true);
					}}
					type="submit"
				>
					Yes, delete my account
				</button>
			</form>

			<AlertModal
				cancelButtonText={"No, keep my account"}
				confirmButtonText={"Yes, delete my account!"}
				isOpen={deleteOpen}
				loading={deleteLoading}
				message={
					"Are you sure you want to delete your account? This will sign you out immediately."
				}
				onClose={handleCloseDialog}
				onConfirm={handleDeleteUser}
			>
				<div className="mt-4 space-y-2">
					<Label htmlFor="confirm-password">
						Enter your password to confirm
					</Label>
					<Input
						id="confirm-password"
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Your password"
						type="password"
						value={password}
					/>
				</div>
			</AlertModal>
		</div>
	);
};
