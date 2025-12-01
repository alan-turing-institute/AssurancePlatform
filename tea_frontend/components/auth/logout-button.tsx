"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import ActionTooltip from "../ui/action-tooltip";
import { Button } from "../ui/button";

const USE_PRISMA_AUTH = process.env.NEXT_PUBLIC_USE_PRISMA_AUTH === "true";

const LogoutButton = () => {
	const [_isMounted, setIsMounted] = useState(false);
	const router = useRouter();
	const { data } = useSession();

	useEffect(() => {
		setIsMounted(true);
	}, []);

	const handleLogout = async () => {
		if (USE_PRISMA_AUTH) {
			// For Prisma auth, sign out directly (no Django token to invalidate)
			await signOut({ callbackUrl: "/login" });
			return;
		}

		// Django auth: call Django logout endpoint first
		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/auth/logout/`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Token ${data?.key}`,
					},
				}
			);
			if (response.status === 200) {
				await signOut();
				router.push("/login");
			}
		} catch (error) {
			console.error("Logout failed:", error);
			// Fallback: sign out anyway
			await signOut({ callbackUrl: "/login" });
		}
	};

	return (
		<ActionTooltip label="Logout">
			<Button onClick={handleLogout} size={"sm"} variant={"ghost"}>
				<LogOutIcon className="h-4 w-4" />
				<span className="sr-only">Logout</span>
			</Button>
		</ActionTooltip>
	);
};

export default LogoutButton;
