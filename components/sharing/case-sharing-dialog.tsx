"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader } from "lucide-react";
import { useForm } from "react-hook-form";
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
import {
	AvailableTeamsList,
	TeamPermissionRow,
	UserPermissionRow,
} from "./_case-sharing/permission-components";
import {
	type ShareFormValues,
	shareFormSchema,
	useCasePermissions,
} from "./_case-sharing/use-case-permissions";

export function CaseSharingDialog() {
	const sharingModal = useCaseSharingModal();

	const form = useForm<ShareFormValues>({
		resolver: zodResolver(shareFormSchema),
		defaultValues: {
			email: "",
			permission: "VIEW",
		},
	});

	const {
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
	} = useCasePermissions({
		caseId: sharingModal.caseId,
		isOpen: sharingModal.isOpen,
		form,
	});

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
										onClick={clearInviteUrl}
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
