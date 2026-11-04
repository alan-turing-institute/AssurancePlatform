"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import useStore from "@/store/store";

/**
 * What the editor shows, for as long as the browser takes to leave, once the
 * server has ended the live stream because the viewer's session has ended with
 * a password change or reset. The case is dropped from the store and the
 * browser goes to the sign-in page, as it does when any request is answered
 * with 401.
 */
export function CaseSignedOut() {
	const router = useRouter();
	const setAssuranceCase = useStore((state) => state.setAssuranceCase);

	useEffect(() => {
		setAssuranceCase(null);
		router.replace("/login");
	}, [router, setAssuranceCase]);

	return (
		<div className="flex min-h-[60vh] items-center justify-center gap-2 px-4 text-muted-foreground">
			<Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
			<p>Your session has ended. Taking you to the sign-in page.</p>
		</div>
	);
}
