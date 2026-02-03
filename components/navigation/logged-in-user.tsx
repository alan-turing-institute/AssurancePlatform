"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCurrentUser } from "@/actions/users";
import { Skeleton } from "../ui/skeleton";

type UserData = {
	username: string;
	email: string;
	firstName?: string;
	lastName?: string;
};

const LoggedInUser = () => {
	const [currentUser, setCurrentUser] = useState<UserData | null>(null);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		const loadUser = async () => {
			try {
				const result = await fetchCurrentUser("");
				if (result) {
					setCurrentUser({
						username: result.username,
						email: result.email,
						firstName: result.firstName ?? undefined,
						lastName: result.lastName ?? undefined,
					});
				} else {
					setCurrentUser(null);
				}
				setLoading(false);
			} catch {
				// Handle error silently - user will see loading state
				setCurrentUser(null);
				setLoading(false);
			}
		};

		loadUser();
	}, []);

	const displayName =
		[currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(" ") ||
		currentUser?.username ||
		"";

	return (
		<>
			{loading ? (
				<div className="p-4">
					<div className="flex items-center gap-3">
						<Skeleton className="aspect-square h-10 w-10 rounded-full" />
						<div className="flex w-full flex-col gap-2">
							<Skeleton className="h-2 w-32" />
							<Skeleton className="h-2 w-24" />
						</div>
					</div>
				</div>
			) : (
				<Link
					className="group block shrink-0 rounded-md p-4 hover:bg-sidebar-accent/40"
					href="/dashboard/settings"
				>
					<div className="flex items-center gap-3">
						<span className="inline-flex size-10 items-center justify-center rounded-full bg-sidebar-accent/60">
							<span className="font-medium text-sidebar-accent-foreground text-sm capitalize">
								{displayName.charAt(0)}
							</span>
						</span>
						<div>
							<p className="font-medium text-sidebar-accent-foreground text-sm capitalize group-hover:text-sidebar-accent-foreground">
								{displayName}
							</p>
							<p className="font-medium text-sidebar-foreground/70 text-xs group-hover:text-sidebar-accent-foreground">
								{currentUser?.email}
							</p>
						</div>
					</div>
				</Link>
			)}
		</>
	);
};

export default LoggedInUser;
