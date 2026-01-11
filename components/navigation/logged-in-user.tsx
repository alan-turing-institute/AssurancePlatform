"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCurrentUser } from "@/actions/users";
import { Skeleton } from "../ui/skeleton";

type UserData = {
	username: string;
	email: string;
};

const LoggedInUser = () => {
	const [currentUser, setCurrentUser] = useState<UserData | null>(null);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		const loadUser = async () => {
			try {
				const result = await fetchCurrentUser("");
				if (result) {
					setCurrentUser({ username: result.username, email: result.email });
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
					className="group block shrink-0 rounded-md p-4 hover:bg-indigo-900/40 dark:hover:bg-indigo-600"
					href="/dashboard/settings"
				>
					<div className="flex items-center gap-3">
						<span className="inline-flex size-10 items-center justify-center rounded-full bg-indigo-900/40 dark:bg-indigo-500">
							<span className="font-medium text-sm text-white capitalize">
								{currentUser?.username.charAt(0)}
							</span>
						</span>
						<div>
							<p className="font-medium text-sm text-white capitalize group-hover:text-white">
								{currentUser?.username}
							</p>
							<p className="font-medium text-gray-300 text-xs group-hover:text-white">
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
