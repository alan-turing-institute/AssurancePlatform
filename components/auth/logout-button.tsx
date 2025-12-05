"use client";

import { LogOutIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import ActionTooltip from "../ui/action-tooltip";
import { Button } from "../ui/button";

const LogoutButton = () => {
	const [_isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	const handleLogout = async () => {
		// For Prisma auth, sign out directly (no Django token to invalidate)
		await signOut({ callbackUrl: "/login" });
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
