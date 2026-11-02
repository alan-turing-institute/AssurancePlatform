"use client";

import { CopyPlusIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useCreateCaseModal } from "@/hooks/modal-hooks";

/** The query flag that asks a signed-in visitor's page to open the new-case dialog. */
const OPEN_DIALOG_FLAG = "use";
const OPEN_DIALOG_VALUE = "1";

interface UsePatternButtonProps {
	description: string;
	slug: string;
	title: string;
}

/**
 * "Use this pattern" on a published pattern's Discover page. Signed in, it
 * opens the new-case dialog with this pattern chosen. Signed out, it goes to
 * sign-in, which returns to this page with the flag set; the page then opens
 * the dialog the same way. The flag only opens the dialog and is removed from
 * the address once it has: no case is created until the visitor confirms one
 * in the dialog. The pattern is re-checked when the case is created.
 */
const UsePatternButton = ({
	description,
	slug,
	title,
}: UsePatternButtonProps) => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { data: session, status } = useSession();
	const { onOpenWith } = useCreateCaseModal();
	const signedIn = Boolean(session?.user?.id);
	const asked = searchParams.get(OPEN_DIALOG_FLAG) === OPEN_DIALOG_VALUE;
	const handled = useRef(false);
	const pagePath = `/discover/${slug}`;

	useEffect(() => {
		if (!(asked && signedIn) || handled.current) {
			return;
		}
		handled.current = true;
		onOpenWith({ description, slug, title });
		router.replace(pagePath, { scroll: false });
	}, [asked, signedIn, description, onOpenWith, pagePath, router, slug, title]);

	const handleClick = () => {
		if (signedIn) {
			onOpenWith({ description, slug, title });
			return;
		}
		const backHere = `${pagePath}?${OPEN_DIALOG_FLAG}=${OPEN_DIALOG_VALUE}`;
		router.push(`/login?redirect=${encodeURIComponent(backHere)}`);
	};

	return (
		<div className="mt-4 flex shrink-0 flex-col items-start gap-2">
			<Button
				disabled={status === "loading"}
				onClick={handleClick}
				variant="default"
			>
				Use this pattern
				<CopyPlusIcon className="ml-2 size-4" />
			</Button>
			{!(signedIn || status === "loading") && (
				<p className="text-muted-foreground text-sm">
					You will be asked to sign in first.
				</p>
			)}
		</div>
	);
};

export default UsePatternButton;
