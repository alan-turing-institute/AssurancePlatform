"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { saveAs } from "file-saver";
import {
	Cloud,
	Download,
	FileIcon,
	ImageIcon,
	Loader2,
	Share2,
	User2,
	UserCheck,
	UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
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
import { exportDiagramImage } from "@/lib/case/image-export";
import { useToast } from "@/lib/toast";
import type { User } from "@/types";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { Separator } from "../ui/separator";

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

/**
 * Google icon SVG component
 */
function GoogleIcon({ className }: { className?: string }) {
	return (
		<svg aria-hidden="true" className={className} viewBox="0 0 24 24">
			<path
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
				fill="#4285F4"
			/>
			<path
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				fill="#34A853"
			/>
			<path
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
				fill="#FBBC05"
			/>
			<path
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				fill="#EA4335"
			/>
		</svg>
	);
}

export const ShareModal = () => {
	const {
		assuranceCase,
		viewMembers,
		setViewMembers,
		editMembers,
		setEditMembers,
		reviewMembers,
		setReviewMembers,
		nodes,
	} = useStore();
	const shareModal = useShareModal();

	const [loading, setLoading] = useState(false);
	const [_isDisabled, _setIsDisabled] = useState(false);
	const [error, _setError] = useState<string>("");
	const [successMessage, _setSuccessMessage] = useState<string>("");
	const [_users, _setUsers] = useState<User[]>([]);
	const [_selectedUsers, _setSelectedUsers] = useState<User[]>([]);

	const [exportWithComments, setExportWithComments] = useState(true);

	// Google Drive backup state
	const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
	const [backupLoading, setBackupLoading] = useState(false);

	// Image export state
	const [imageFormat, setImageFormat] = useState<"svg" | "png">("png");
	const [imageScale, setImageScale] = useState<"1" | "2" | "3">("2");
	const [imageExportLoading, setImageExportLoading] = useState(false);

	const _router = useRouter();
	const { toast } = useToast();

	const form = useForm<z.infer<typeof FormSchema>>({
		resolver: zodResolver(FormSchema),
		defaultValues: {
			email: "",
			accessLevel: "Read",
		},
	});

	// Check Google connection status when modal opens
	useEffect(() => {
		if (shareModal.isOpen && googleConnected === null) {
			fetch("/api/cases/backup/gdrive")
				.then((res) => res.json())
				.then((data) => setGoogleConnected(data.connected ?? false))
				.catch(() => setGoogleConnected(false));
		}
	}, [shareModal.isOpen, googleConnected]);

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

	const handleBackupToDrive = async () => {
		if (!assuranceCase?.id) {
			return;
		}

		setBackupLoading(true);

		try {
			const response = await fetch("/api/cases/backup/gdrive", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					caseId: assuranceCase.id,
					includeComments: exportWithComments,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				toast({
					variant: "destructive",
					title: "Backup failed",
					description:
						data.message || data.error || "Unable to backup to Google Drive",
				});
				return;
			}

			toast({
				variant: "success",
				title: "Backup successful",
				description: `Saved as ${data.fileName} to Google Drive`,
			});
		} catch {
			toast({
				variant: "destructive",
				title: "Backup failed",
				description: "An error occurred while backing up to Google Drive",
			});
		} finally {
			setBackupLoading(false);
		}
	};

	const handleImageExport = async () => {
		if (!assuranceCase?.name) {
			toast({
				variant: "destructive",
				title: "Export failed",
				description: "No assurance case loaded",
			});
			return;
		}

		setImageExportLoading(true);

		try {
			await exportDiagramImage({
				format: imageFormat,
				scale:
					imageFormat === "png" ? (Number(imageScale) as 1 | 2 | 3) : undefined,
				caseName: assuranceCase.name,
				nodes,
			});

			toast({
				variant: "success",
				title: "Export complete",
				description: `Diagram exported as ${imageFormat.toUpperCase()}`,
			});
		} catch (exportError) {
			toast({
				variant: "destructive",
				title: "Export failed",
				description:
					exportError instanceof Error
						? exportError.message
						: "An error occurred",
			});
		} finally {
			setImageExportLoading(false);
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
					disabled={loading}
					onClick={() => handleExport(exportWithComments)}
				>
					<Download className="mr-2 h-4 w-4" />
					Download File
				</Button>
			</div>
			<Separator />
			<div className="my-4">
				<h2 className="mb-2 flex items-center justify-start gap-2">
					<ImageIcon className="h-4 w-4" />
					Export as Image
				</h2>
				<p className="text-muted-foreground text-sm">
					Download the diagram as an image file.
				</p>
				<div className="my-3 space-y-3">
					<div className="flex items-center gap-4">
						<Label className="text-sm">Format</Label>
						<RadioGroup
							className="flex items-center gap-4"
							onValueChange={(value) => setImageFormat(value as "svg" | "png")}
							value={imageFormat}
						>
							<div className="flex items-center space-x-2">
								<RadioGroupItem id="format-png" value="png" />
								<Label className="font-normal" htmlFor="format-png">
									PNG
								</Label>
							</div>
							<div className="flex items-center space-x-2">
								<RadioGroupItem id="format-svg" value="svg" />
								<Label className="font-normal" htmlFor="format-svg">
									SVG
								</Label>
							</div>
						</RadioGroup>
					</div>
					{imageFormat === "png" && (
						<div className="flex items-center gap-4">
							<Label className="text-sm" htmlFor="scale-select">
								Resolution
							</Label>
							<Select
								onValueChange={(v) => setImageScale(v as "1" | "2" | "3")}
								value={imageScale}
							>
								<SelectTrigger className="w-24" id="scale-select">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="1">1x</SelectItem>
									<SelectItem value="2">2x</SelectItem>
									<SelectItem value="3">3x</SelectItem>
								</SelectContent>
							</Select>
						</div>
					)}
				</div>
				<Button
					className="my-2"
					disabled={imageExportLoading}
					onClick={handleImageExport}
					variant="outline"
				>
					{imageExportLoading ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<Download className="mr-2 h-4 w-4" />
					)}
					{imageExportLoading
						? "Exporting..."
						: `Download ${imageFormat.toUpperCase()}`}
				</Button>
			</div>
			<Separator />
			<div className="my-4">
				<h2 className="mb-2 flex items-center justify-start gap-2">
					<Cloud className="h-4 w-4" />
					Backup to Google Drive
				</h2>
				{googleConnected === null && (
					<p className="text-muted-foreground text-sm">
						Checking Google connection...
					</p>
				)}
				{googleConnected === false && (
					<div className="space-y-2">
						<p className="text-muted-foreground text-sm">
							Connect your Google account to backup cases to Google Drive.
						</p>
						<Button onClick={() => signIn("google")} variant="outline">
							<GoogleIcon className="mr-2 h-4 w-4" />
							Sign in with Google
						</Button>
					</div>
				)}
				{googleConnected === true && (
					<div className="space-y-2">
						<p className="text-muted-foreground text-sm">
							Save this case to your TEA Platform Backups folder in Google
							Drive.
						</p>
						<Button
							disabled={backupLoading}
							onClick={handleBackupToDrive}
							variant="outline"
						>
							{backupLoading ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Cloud className="mr-2 h-4 w-4" />
							)}
							{backupLoading ? "Backing up..." : "Backup to Google Drive"}
						</Button>
					</div>
				)}
			</div>
		</Modal>
	);
};
