"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { saveAs } from "file-saver";
import {
	Download,
	FileIcon,
	Share2,
	User2,
	UserCheck,
	UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import useStore from "@/data/store";
import { useShareModal } from "@/hooks/use-share-modal";
// import { unauthorized, useLoginToken } from ".*/use-auth";
import type { User } from "@/types";
import { Button } from "../ui/button";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Separator } from "../ui/separator";
import { useToast } from "../ui/use-toast";

type ShareItem = {
	email: string;
	view?: boolean;
	edit?: boolean;
	review?: boolean;
};

const FormSchema = z.object({
	email: z
		.string()
		.min(2, {
			message: "Email must be at least 2 characters.",
		})
		.email(),
	accessLevel: z.string().min(1),
});

export const ShareModal = () => {
	const {
		assuranceCase,
		viewMembers,
		setViewMembers,
		editMembers,
		setEditMembers,
		reviewMembers,
		setReviewMembers,
	} = useStore();
	const shareModal = useShareModal();

	const [loading, setLoading] = useState(false);
	const [_isDisabled, _setIsDisabled] = useState(false);
	const [error, _setError] = useState<string>("");
	const [successMessage, _setSuccessMessage] = useState<string>("");
	const [_users, _setUsers] = useState<User[]>([]);
	const [_selectedUsers, _setSelectedUsers] = useState<User[]>([]);

	const [exportWithComments, setExportWithComments] = useState(true);

	const _router = useRouter();
	const { toast } = useToast();

	const form = useForm<z.infer<typeof FormSchema>>({
		resolver: zodResolver(FormSchema),
		defaultValues: {
			email: "",
			accessLevel: "Read",
		},
	});

	const mapAccessLevelToPermission = (accessLevel: string): string => {
		const permissionMap: Record<string, string> = {
			Read: "VIEW",
			Edit: "EDIT",
			Reviewer: "REVIEW",
		};
		return permissionMap[accessLevel] || "VIEW";
	};

	const updateMemberState = (accessLevel: string, email: string) => {
		const newShareItem: ShareItem = { email };
		if (accessLevel === "Read") {
			newShareItem.view = true;
			setViewMembers([...viewMembers, newShareItem as unknown as User]);
		} else if (accessLevel === "Edit") {
			newShareItem.edit = true;
			setEditMembers([...editMembers, newShareItem as unknown as User]);
		} else if (accessLevel === "Reviewer") {
			newShareItem.review = true;
			setReviewMembers([...reviewMembers, newShareItem as unknown as User]);
		}
	};

	const handlePrismaShare = async (data: z.infer<typeof FormSchema>) => {
		const permission = mapAccessLevelToPermission(data.accessLevel);

		const response = await fetch(
			`/api/cases/${assuranceCase?.id}/permissions`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ type: "user", email: data.email, permission }),
			}
		);

		const result = await response.json();

		if (!response.ok) {
			toast({
				variant: "destructive",
				title: "Unable to share case",
				description:
					result.error ||
					"The email is not registered to an active user of the TEA platform.",
			});
			return false;
		}

		if (result.invite_url) {
			toast({
				variant: "success",
				title: "Invite sent",
				description: `An invite has been created for ${data.email}`,
			});
		} else if (result.message === "User already has access to this case") {
			toast({
				variant: "default",
				title: "Already shared",
				description: `${data.email} already has access to this case`,
			});
		} else {
			toast({
				variant: "success",
				title: "Shared Case with:",
				description: `${data.email}`,
			});
		}

		updateMemberState(data.accessLevel, data.email);
		return true;
	};

	const onSubmit = async (data: z.infer<typeof FormSchema>) => {
		setLoading(true);

		try {
			const success = await handlePrismaShare(data);

			if (success) {
				form.reset();
			}
		} catch (_error) {
			toast({
				variant: "destructive",
				title: "Error",
				description: "Something went wrong",
			});
		}

		setLoading(false);
	};

	const handleExport = async (includeComments = true) => {
		setLoading(true);

		if (assuranceCase?.id) {
			// Use v2 export API
			try {
				const params = new URLSearchParams({
					id: String(assuranceCase.id),
					includeComments: String(includeComments),
				});
				const response = await fetch(`/api/cases/export?${params}`);

				if (!response.ok) {
					toast({
						variant: "destructive",
						title: "Export failed",
						description: "Unable to export case",
					});
					setLoading(false);
					return;
				}

				// Get the blob and download
				const blob = await response.blob();
				const name = assuranceCase.name || "assurance-case";
				const now = new Date();
				const datestr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}T${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
				const filename = `${name}-${datestr}.json`;
				saveAs(blob, filename);
			} catch {
				toast({
					variant: "destructive",
					title: "Export failed",
					description: "An error occurred while exporting",
				});
			} finally {
				setLoading(false);
			}
		}
	};

	return (
		<Modal
			description="How would you like the share your assurance case?"
			isOpen={shareModal.isOpen}
			onClose={shareModal.onClose}
			title="Share / Export Case"
		>
			{error && (
				<div className="flex w-full items-center justify-start gap-2 rounded-md border-2 border-rose-700 bg-rose-500/20 px-3 py-1 text-rose-600">
					<UserX className="h-4 w-4" />
					{error}
				</div>
			)}
			{successMessage && (
				<div className="flex w-full items-center justify-start gap-2 rounded-md border-2 border-emerald-700 bg-emerald-500/20 px-3 py-1 text-emerald-600">
					<UserCheck className="h-4 w-4" />
					{successMessage}
				</div>
			)}
			{assuranceCase && assuranceCase.permissions === "manage" && (
				<div className="my-4 space-y-2">
					<h2 className="flex items-center justify-start gap-2">
						<User2 className="h-4 w-4" /> Share with users
					</h2>
					<Form {...form}>
						<form
							className="w-full space-y-6"
							onSubmit={form.handleSubmit(onSubmit)}
						>
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="hidden">Email</FormLabel>
										<FormControl>
											<Input
												placeholder="Enter email address"
												{...field}
												autoComplete="off"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="accessLevel"
								render={({ field }) => (
									<FormItem className="pb-2">
										<FormLabel>Access Level</FormLabel>
										<FormControl>
											<RadioGroup
												className="flex items-center justify-start space-x-2"
												onValueChange={field.onChange}
												value={field.value}
											>
												<FormItem
													className="flex items-center space-x-3 space-y-0"
													key={crypto.randomUUID()}
												>
													<FormControl>
														<RadioGroupItem value={"Read"} />
													</FormControl>
													<FormLabel className="font-normal">Read</FormLabel>
												</FormItem>
												<FormItem
													className="flex items-center space-x-3 space-y-0"
													key={crypto.randomUUID()}
												>
													<FormControl>
														<RadioGroupItem value={"Edit"} />
													</FormControl>
													<FormLabel className="font-normal">Edit</FormLabel>
												</FormItem>
												<FormItem
													className="flex items-center space-x-3 space-y-0"
													key={crypto.randomUUID()}
												>
													<FormControl>
														<RadioGroupItem value={"Reviewer"} />
													</FormControl>
													<FormLabel className="font-normal">
														Reviewer
													</FormLabel>
												</FormItem>
											</RadioGroup>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button disabled={loading} type="submit">
								<Share2 className="mr-2 h-4 w-4" />
								Share
							</Button>
						</form>
					</Form>
				</div>
			)}
			<Separator />
			<div className="my-4">
				<h2 className="mb-2 flex items-center justify-start gap-2">
					<FileIcon className="h-4 w-4" />
					Export as JSON
				</h2>
				<p className="text-muted-foreground text-sm">
					Select the button below to download a JSON file.
				</p>
				<div className="my-2 flex items-center space-x-2">
					<input
						checked={exportWithComments}
						className="h-4 w-4 rounded border-gray-300"
						id="export-comments"
						onChange={(e) => setExportWithComments(e.target.checked)}
						type="checkbox"
					/>
					<label className="text-sm" htmlFor="export-comments">
						Include comments
					</label>
				</div>
				<Button
					className="my-2"
					onClick={() => handleExport(exportWithComments)}
				>
					<Download className="mr-2 h-4 w-4" />
					Download File
				</Button>
			</div>
		</Modal>
	);
};
