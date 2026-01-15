"use client";

import { Github } from "lucide-react";
import { useState } from "react";
import type { ConnectedAccountsData } from "@/actions/connected-accounts";
import { unlinkProvider } from "@/actions/connected-accounts";
import { AlertModal } from "@/components/modals/alert-modal";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/lib/toast";

type ConnectedAccountsFormProps = {
	data: ConnectedAccountsData | null;
};

/**
 * Google icon component
 */
function GoogleIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-label="Google"
			className={className}
			role="img"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
		>
			<title>Google</title>
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

/**
 * Provider card component for displaying connection status
 */
function ProviderCard({
	name,
	icon,
	connected,
	details,
	canUnlink,
	unlinkReason,
	onConnect,
	onDisconnect,
	loading,
}: {
	name: string;
	icon: React.ReactNode;
	connected: boolean;
	details?: string;
	canUnlink: boolean;
	unlinkReason?: string;
	onConnect: () => void;
	onDisconnect: () => void;
	loading: boolean;
}) {
	return (
		<div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
			<div className="flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
					{icon}
				</div>
				<div>
					<div className="flex items-center gap-2">
						<span className="font-medium">{name}</span>
						<span
							className={`inline-flex h-2 w-2 rounded-full ${
								connected ? "bg-green-500" : "bg-gray-400"
							}`}
						/>
					</div>
					{connected && details ? (
						<p className="text-muted-foreground text-sm">{details}</p>
					) : (
						<p className="text-muted-foreground text-sm">
							{connected ? "Connected" : "Not connected"}
						</p>
					)}
				</div>
			</div>
			<div>
				{connected ? (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button
										className="text-red-500 hover:text-red-600"
										disabled={!canUnlink || loading}
										onClick={onDisconnect}
										size="sm"
										variant="ghost"
									>
										{loading ? "Disconnecting..." : "Disconnect"}
									</Button>
								</span>
							</TooltipTrigger>
							{!canUnlink && unlinkReason && (
								<TooltipContent className="max-w-xs">
									<p>{unlinkReason}</p>
								</TooltipContent>
							)}
						</Tooltip>
					</TooltipProvider>
				) : (
					<Button onClick={onConnect} size="sm" variant="outline">
						Connect
					</Button>
				)}
			</div>
		</div>
	);
}

export function ConnectedAccountsForm({ data }: ConnectedAccountsFormProps) {
	const [loading, setLoading] = useState<"github" | "google" | null>(null);
	const [disconnectModal, setDisconnectModal] = useState<{
		isOpen: boolean;
		provider: "github" | "google" | null;
	}>({ isOpen: false, provider: null });
	const { toast } = useToast();

	if (!data) {
		return null;
	}

	const handleConnect = (provider: "github" | "google") => {
		// Redirect to the link API endpoint
		window.location.href = `/api/auth/link/${provider}`;
	};

	const handleDisconnectClick = (provider: "github" | "google") => {
		setDisconnectModal({ isOpen: true, provider });
	};

	const handleDisconnectConfirm = async () => {
		const provider = disconnectModal.provider;
		if (!provider) {
			return;
		}

		setLoading(provider);
		try {
			const result = await unlinkProvider(provider);
			if (result.success) {
				toast({
					description: `${provider === "github" ? "GitHub" : "Google"} account disconnected successfully.`,
				});
			} else {
				toast({
					description: result.error,
					variant: "destructive",
				});
			}
		} catch {
			toast({
				description: "Failed to disconnect account. Please try again.",
				variant: "destructive",
			});
		} finally {
			setLoading(null);
			setDisconnectModal({ isOpen: false, provider: null });
		}
	};

	const providerName =
		disconnectModal.provider === "github" ? "GitHub" : "Google";
	const disconnectMessage =
		disconnectModal.provider === "github"
			? "Disconnecting your GitHub account will remove the ability to sign in with GitHub and revoke access to import from private repositories."
			: "Disconnecting your Google account will remove the ability to sign in with Google and revoke access to Google Drive backups.";

	return (
		<>
			<div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
				<div>
					<h2 className="font-semibold text-base text-foreground leading-7">
						Connected accounts
					</h2>
					<p className="mt-1 text-gray-400 text-sm leading-6">
						Link external accounts to your TEA Platform profile. These allow
						sign-in and access to external services like GitHub repositories and
						Google Drive.
					</p>
				</div>

				<div className="space-y-4 md:col-span-2">
					{/* GitHub */}
					<ProviderCard
						canUnlink={data.canUnlinkGitHub}
						connected={data.github.connected}
						details={
							data.github.username ? `@${data.github.username}` : undefined
						}
						icon={<Github className="h-5 w-5" />}
						loading={loading === "github"}
						name="GitHub"
						onConnect={() => handleConnect("github")}
						onDisconnect={() => handleDisconnectClick("github")}
						unlinkReason="You cannot disconnect GitHub because it is your only way to sign in. Connect another provider first."
					/>

					{/* Google */}
					<ProviderCard
						canUnlink={data.canUnlinkGoogle}
						connected={data.google.connected}
						details={data.google.email}
						icon={<GoogleIcon className="h-5 w-5" />}
						loading={loading === "google"}
						name="Google"
						onConnect={() => handleConnect("google")}
						onDisconnect={() => handleDisconnectClick("google")}
						unlinkReason="You cannot disconnect Google because it is your only way to sign in. Connect another provider first."
					/>

					{/* Password status info */}
					<div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
						<div className="flex items-center gap-2">
							<span
								className={`inline-flex h-2 w-2 rounded-full ${
									data.hasPassword ? "bg-green-500" : "bg-gray-400"
								}`}
							/>
							<span className="text-sm">
								{data.hasPassword
									? "Password authentication is enabled"
									: "No password set - sign in with connected accounts only"}
							</span>
						</div>
						{!data.hasPassword && (
							<p className="mt-2 text-muted-foreground text-xs">
								Keep at least one connected account to maintain access to your
								profile.
							</p>
						)}
					</div>
				</div>
			</div>

			{/* Disconnect confirmation modal */}
			<AlertModal
				cancelButtonText="Cancel"
				confirmButtonText={`Disconnect ${providerName}`}
				isOpen={disconnectModal.isOpen}
				loading={loading !== null}
				message={disconnectMessage}
				onClose={() => setDisconnectModal({ isOpen: false, provider: null })}
				onConfirm={handleDisconnectConfirm}
			/>
		</>
	);
}
